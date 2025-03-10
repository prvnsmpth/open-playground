import { Ollama, type ChatRequest, type ModelResponse, type Tool as OllamaTool, type ToolCall as OllamaToolCall } from "ollama"
import { connect, DbService } from "./db"
import type { Chat, ChatMessage, OutputFormat, Tool, Usage } from '$lib'
import { execSync } from "child_process"
import { BuiltinTool, isBuiltinTool, type StreamMessage } from "$lib"
import { CodeInterpreter } from "./tools"
import { env } from '$env/dynamic/private'
import logger from '$lib/server/logger'
import { Cache } from "./cache"

const TITLE_INSTRUCTIONS = `
You are given the first few messages between a human and an AI assistant. Your task is to come up with a nice short title for the conversation.
Keep it only a few words long, and make sure it captures the essence of the conversation.
Return the title in <title></title> tags.
E.g., <title>How to win friends</title>.
`

class OllamaClient {
    private client: Ollama
    private db: DbService
    private codeInterpreter: CodeInterpreter
    private includeFewShotExamples: boolean = false

    private CTX_LEN = 32_000 // TODO: This should be updated when models are changed

    private modelCache: Cache<ModelResponse[]>

    constructor() {
        if (!env.OLLAMA_HOST) {
            throw new Error("OLLAMA_HOST environment variable is not set")
        }
        logger.info(`Connecting to Ollama at ${env.OLLAMA_HOST}`)
        this.client = new Ollama({ host: env.OLLAMA_HOST })
        this.db = connect()
        this.codeInterpreter = new CodeInterpreter()
        this.modelCache = new Cache()
    }

    async listModels() {
        if (this.modelCache.has('models')) {
            return this.modelCache.get('models')?.map(m => m.name) as string[]
        }

        const resp = await this.client.list()
        const existingModels = new Set(await this.db.listModels())
        for (const m of resp.models) {
            if (!existingModels.has(m.name)) {
                await this.db.addModel(m.name)
            }
        }
        this.modelCache.put('models', resp.models)
        return resp.models.map(m => m.name)
    }

    clearModelCache() {
        this.modelCache.clear()
    }

    async generateTitle(chatId: string): Promise<string> {
        const messages = await this.db.getMessages(chatId)
        const conversation = 
            messages
                .filter(m => m.message.role === 'user' || m.message.role === 'assistant')
                .map(m => `${m.message.role}: ${m.message.content}`)
                .join('\n')
        const runningModels = await this.client.ps()
        const model = runningModels.models[0]?.name || 'llama3.2:3b'
        const resp = await this.client.chat({
            model,
            messages: [
                { role: 'system', content: TITLE_INSTRUCTIONS },
                { role: 'user', content: `Here is the conversation:\n${conversation}` }
            ],
            options: {
                num_ctx: this.CTX_LEN
            }
        })
        const response = resp.message.content
        const match = response.match(/<title>(.*?)<\/title>/)
        const title = match ? match[1] : 'Untitled Chat'
        await this.db.updateChat(chatId, { title })
        return title
    }

    async ensureModel(model: string) {
        const resp = await this.client.ps()
        const otherModels = resp.models.map(m => m.name).filter(m => m !== model)

        for (const m of otherModels) {
            execSync(`ollama stop ${m}`)
        }
    }

    // TODO: large portions of this are duplicated from sendMessage
    async regenerateResponse(chatId: string, messageId: string, model: string, modelConfig: any, tools: Tool[] = []) {
        await this.ensureModel(model)

        const chat = await this.db.getChat(chatId)
        if (!chat) {
            throw new Error('Chat not found')
        }

        const messages = await this.db.getMessages(chatId)
        const targetMsg = messages.find(m => m.id === messageId)
        if (!targetMsg || !targetMsg.id) {
            throw new Error('Target message not found')
        }

        if (targetMsg.message.role !== 'assistant') {
            throw new Error('Target message is not an assistant message')
        }

        const targetMsgIdx = messages.findIndex(m => m.id === messageId)

        const systemPrompt = chat.systemPrompt ?? ''
        const resp = await this.client.chat({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...(messages
                    .map(cm => cm.message)
                    .slice(0, targetMsgIdx))
            ],
            tools: tools.filter(t => !isBuiltinTool(t)) as OllamaTool[],
            stream: true,
            options: {
                num_ctx: this.CTX_LEN,
                temperature: modelConfig.temperature,
                num_predict: modelConfig.maxTokens,
                top_p: modelConfig.topP
            }
        })

        let responseTxt = ''
        let toolCalls: OllamaToolCall[] | undefined
        const db = this.db
        const encoder = new TextEncoder()

        let streamCancelled = false
        const stream = new ReadableStream({
            async start(controller) {
                function sendJson(json: StreamMessage) {
                    controller.enqueue(encoder.encode(JSON.stringify(json)))
                    controller.enqueue(encoder.encode('\n'))
                }

                try {
                    for await (const chunk of resp) {
                        responseTxt += chunk.message.content
                        if (chunk.message.tool_calls) {
                            if (!toolCalls) {
                                toolCalls = []
                            }
                            toolCalls.push(...chunk.message.tool_calls)
                        }
                        if (chunk.done) {
                            const usage = {
                                promptTokens: chunk.prompt_eval_count,
                                completionTokens: chunk.eval_count,
                            }
                            sendJson({ type: 'usage', content: usage }) 
                        }
                        sendJson({ type: 'asst_response', content: chunk.message })
                    }
                } catch (err) {
                    console.error('Error reading response:', err)
                } finally {
                    if (responseTxt.length > 0 || (toolCalls?.length || 0) > 0) {
                        await db.updateMessage(chat.id!, targetMsg.id!, { content: responseTxt, toolCalls })
                    }
                    controller.close()
                }
            },
            cancel() {
                resp.abort()
                streamCancelled = true
            }
        })
        return stream
    }

    private getOutputFormat(outputFormat?: OutputFormat) {
        if (!outputFormat || outputFormat.type === 'text') {
            return undefined
        }

        if (outputFormat?.type === 'json') {
            return 'json'
        }

        if (outputFormat?.type === 'json_schema') {
            return outputFormat.schema.schema
        }

        throw new Error(`Invalid output format: ${outputFormat?.type}`)
    }

    private async buildSystemPrompt(chat: Chat) {
        logger.info('Building system prompt for chat: ' + chat.id)
        const baseSystemPrompt = chat.systemPrompt
        if (!this.includeFewShotExamples) {
            return baseSystemPrompt
        }

        const recentGoldenChats = await this.db.listChats(chat.projectId, true, 0, 5)
        const fewShotExamples = recentGoldenChats.map(async c => {
            const messages = await this.db.getMessages(c.id!)
            return messages.map(m => `${m.message.role}: ${m.message.content}`).join('\n')
        })
        const examples = (await Promise.all(fewShotExamples)).map((e, i) => `Example chat #${i + 1}:\n${e}`).join('\n\n')

        return `${baseSystemPrompt}\n\nExamples of good agent responses:\n\n${examples}\n\n`
    }

    async sendMessage(
        chatId: string, 
        role: 'user' | 'tool',
        msg: string | null, 
        model: string, 
        modelConfig: any, 
        tools: Tool[] = [], 
        outputFormat?: OutputFormat
    ) {
        await this.ensureModel(model)
        const id = msg ? await this.db.addMessage(chatId, model, { role, content: msg }) : null
        const chat = await this.db.getChat(chatId)
        if (!chat) {
            throw new Error('Chat not found')
        }

        const messages = await this.db.getMessages(chatId)
        const systemPrompt = (await this.buildSystemPrompt(chat)) || ''
        const ollamaReq: ChatRequest = {
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages.map(cm => {
                    const toolCalls = cm.message.toolCalls
                    return {
                        ...cm.message,
                        toolCalls: undefined,
                        tool_calls: toolCalls
                    }
                })
            ],
            tools: tools.filter(t => !isBuiltinTool(t)) as OllamaTool[],
            format: this.getOutputFormat(outputFormat),
            options: {
                num_ctx: this.CTX_LEN,
                temperature: modelConfig.temperature,
                num_predict: modelConfig.maxTokens,
                top_p: modelConfig.topP
            }
        }
        logger.info({ message: 'ollama req', req: ollamaReq})
        const resp = await this.client.chat({
            ...ollamaReq,
            stream: true
        })

        function sendJson(controller: ReadableStreamDefaultController<any>, json: StreamMessage) {
            controller.enqueue(encoder.encode(JSON.stringify(json)))
            controller.enqueue(encoder.encode('\n'))
        }

        const runEvalLoop = async (
            controller: ReadableStreamDefaultController<any>, 
            asstResponse: string, 
            maxIters: number = 5
        ) => {
            let numIters = 0
            let currResp = asstResponse
            while (numIters < maxIters) {
                const codeInterpreterRequired = this.codeInterpreter.check(currResp)
                if (!codeInterpreterRequired) {
                    break
                }

                sendJson(controller, { type: 'tool_exec_start', content: 'Executing code...' })
                const codeOutput = await this.codeInterpreter.handle(currResp)
                if (codeOutput === null) {
                    break
                }
                const toolOutputId = await this.db.addMessage(chatId, model, { role: 'tool', content: codeOutput })
                sendJson(controller, { type: 'tool_response', content: codeOutput })
                sendJson(controller, { type: 'tool_msg_id', content: toolOutputId })

                const messages = await this.db.getMessages(chatId)
                const resp = await this.client.chat({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...messages.map(cm => cm.message)
                    ],
                    stream: true,
                    options: {
                        num_ctx: this.CTX_LEN
                    }
                })

                currResp = ''
                for await (const chunk of resp) {
                    currResp += chunk.message.content
                    sendJson(controller, { type: 'asst_response', content: chunk.message })
                    if (chunk.done) {
                        const usage: Usage = {
                            promptTokens: chunk.prompt_eval_count,
                            completionTokens: chunk.eval_count,
                        }
                        sendJson(controller, { type: 'usage', content: usage })
                    }
                }

                const asstRespId = await this.db.addMessage(chatId, model, { role: 'assistant', content: currResp })
                sendJson(controller, { type: 'asst_msg_id', content: asstRespId })
                numIters++
            }
        }

        let responseTxt = ''
        const lastMsg = messages[messages.length - 1]
        if (lastMsg?.message.role === 'assistant') {
            // We are continuing the last assistant message
            responseTxt = lastMsg.message.content
        }

        let toolCalls: OllamaToolCall[] | undefined
        if (lastMsg?.message.toolCalls) {
            toolCalls = lastMsg.message.toolCalls
        }

        const encoder = new TextEncoder()
        const generateTitle = async () => await this.generateTitle(chatId)
        let streamCancelled = false
        let asstIdSent = false
        const db = this.db
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    if (id) {
                        sendJson(controller, { type: 'user_msg_id', content: id })
                    }
                    for await (const chunk of resp) {
                        responseTxt += chunk.message.content
                        logger.info({ message: 'response chunk', chunk: chunk.message })
                        if (chunk.message.tool_calls) {
                            if (!toolCalls) {
                                toolCalls = []
                            }
                            toolCalls.push(...chunk.message.tool_calls)
                        }

                        if (chunk.done) {
                            const usage: Usage = {
                                promptTokens: chunk.prompt_eval_count,
                                completionTokens: chunk.eval_count,
                            }
                            sendJson(controller, { type: 'usage', content: usage })
                        }
                        sendJson(controller, { type: 'asst_response', content: chunk.message })

                        // Send message ID right after the first chunk
                        if (!asstIdSent) {
                            let asstMsgId
                            if (lastMsg?.message.role === 'assistant') {
                                asstMsgId = lastMsg.id!
                            } else {
                                asstMsgId = await db.addMessage(chatId, model, { role: 'assistant', content: responseTxt, toolCalls })
                            }
                            sendJson(controller, { type: 'asst_msg_id', content: asstMsgId })
                            asstIdSent = true
                        }
                    }
                } catch (err) {
                    if (err instanceof DOMException && err.name === 'AbortError') {
                        logger.info({ message: 'Stream aborted', chatId, messageId: id })
                    } else {
                        logger.error({ message: 'Error reading response', error: JSON.stringify(err, Object.getOwnPropertyNames(err)) })
                    }
                } finally {
                    const finalMessages = await db.getMessages(chatId)
                    const lastMsg = finalMessages[finalMessages.length - 1]
                    if (responseTxt.length > 0) {
                        if (lastMsg?.message.role === 'assistant') {
                            await db.updateMessage(chatId, lastMsg.id!, { content: responseTxt, toolCalls })
                        } else {
                            await db.addMessage(chatId, model, { role: 'assistant', content: responseTxt, toolCalls })
                        }

                        const codeInterpreterEnabled = tools.includes(BuiltinTool.CodeInterpreter)
                        if (codeInterpreterEnabled) {
                            try {
                                await runEvalLoop(controller, responseTxt)
                            } catch (err) {
                                console.error('Error running eval loop:', err)
                            }
                        } else {
                            logger.info('Code interpreter not enabled, ignoring code.')
                        }
                    }

                    // Generate title if required
                    if (!chat.title) {
                        const title = await generateTitle()
                        if (!streamCancelled) {
                            sendJson(controller, { type: 'chat_title', content: title })
                        }
                    }

                    controller.close()
                }
            },

            cancel() {
                streamCancelled = true
                resp.abort() 
            }
        })
        return stream
    }

    async pullModel(model: string) {
        logger.info({ message: 'Pulling model', model })
        return this.client.pull({ model, stream: true })
    }
}

let ollamaClient: OllamaClient
function createOllamaClient() {
    if (!ollamaClient) {
        ollamaClient = new OllamaClient()
    }
    return ollamaClient
}

export { createOllamaClient, OllamaClient }