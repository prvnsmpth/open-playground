import { Ollama, type ModelResponse } from "ollama"
import { db, DbService, type ChatMessage, type Usage } from "./db"
import { execSync } from "child_process"
import { Tool, type StreamMessage } from "$lib"
import { CodeInterpreter } from "./tools"

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

    private CTX_LEN = 32_000 // TODO: This should be updated when models are changed

    private models?: ModelResponse[]

    constructor() {
        this.client = new Ollama({ host: 'http://localhost:11434' })
        this.db = db
        this.codeInterpreter = new CodeInterpreter()

        this.listModels()
    }

    async listModels() {
        if (this.models) {
            return this.models.map(m => m.name)
        }

        const resp = await this.client.list()
        const existingModels = new Set(await this.db.listModels())
        for (const m of resp.models) {
            if (!existingModels.has(m.name)) {
                await this.db.addModel(m.name)
            }
        }
        this.models = resp.models
        return resp.models.map(m => m.name)
    }

    async createChat() {
        return await this.db.createChat()
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
            stream: true,
            options: {
                num_ctx: this.CTX_LEN,
                temperature: modelConfig.temperature,
                num_predict: modelConfig.maxTokens,
                top_p: modelConfig.topP
            }
        })

        let responseTxt = ''
        this.db = db
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
                        if (chunk.done) {
                            const usage = {
                                promptTokens: chunk.prompt_eval_count,
                                completionTokens: chunk.eval_count,
                            }
                            sendJson({ type: 'usage', content: usage }) 
                        }
                        sendJson({ type: 'asst_response', content: chunk.message.content || '' })
                    }
                } catch (err) {
                    console.error('Error reading response:', err)
                } finally {
                    if (responseTxt.length > 0) {
                        await db.updateMessage(chat.id!, targetMsg.id!, responseTxt)
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

    async fetchExamples(): Promise<ChatMessage[][]> {
        const exampleChats = await db.listChats(true, 0, 1)
        return await db.getMessagesBatch(exampleChats.filter(c => c !== null).map(c => c.id!))
    }

    async sendMessage(chatId: string, msg: string | null, model: string, modelConfig: any, tools: Tool[] = []) {
        await this.ensureModel(model)
        const id = msg ? await this.db.addMessage(chatId, 'user', msg, model) : null
        const chat = await this.db.getChat(chatId)
        if (!chat) {
            throw new Error('Chat not found')            
        }

        const messages = await this.db.getMessages(chatId)
        const systemPrompt = chat.systemPrompt ?? ''
        const resp = await this.client.chat({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages.map(cm => cm.message)
            ],
            stream: true,
            options: {
                num_ctx: this.CTX_LEN,
                temperature: modelConfig.temperature,
                num_predict: modelConfig.maxTokens,
                top_p: modelConfig.topP
            }
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
                const toolOutputId = await db.addMessage(chatId, 'tool', codeOutput, model)
                sendJson(controller, { type: 'tool', content: codeOutput })
                sendJson(controller, { type: 'tool_msg_id', content: toolOutputId })

                // const codeBlocks = this.extractCodeBlocks(currResp)
                // if (codeBlocks.length === 0) {
                //     break
                // }

                // const codeStr = codeBlocks.join('\n')
                // sendJson(controller, { type: 'tool_exec_start', content: 'Executing code...' })
                // const output = await this.executeCode(codeStr)

                // const toolOutputId = await db.addMessage(chatId, 'tool', output, model)
                // sendJson(controller, { type: 'tool', content: output })
                // sendJson(controller, { type: 'tool_msg_id', content: toolOutputId })

                const messages = await db.getMessages(chatId)
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
                    sendJson(controller, { type: 'asst_response', content: chunk.message.content })
                    if (chunk.done) {
                        const usage: Usage = {
                            promptTokens: chunk.prompt_eval_count,
                            completionTokens: chunk.eval_count,
                        }
                        sendJson(controller, { type: 'usage', content: usage })
                    }
                }

                const asstRespId = await db.addMessage(chatId, 'assistant', currResp, model)
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

        const encoder = new TextEncoder()
        const generateTitle = async () => await this.generateTitle(chatId)
        let streamCancelled = false
        let asstIdSent = false
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    if (id) {
                        sendJson(controller, { type: 'user_msg_id', content: id })
                    }
                    for await (const chunk of resp) {
                        responseTxt += chunk.message.content
                        if (chunk.done) {
                            const usage: Usage = {
                                promptTokens: chunk.prompt_eval_count,
                                completionTokens: chunk.eval_count,
                            }
                            sendJson(controller, { type: 'usage', content: usage })
                        }
                        sendJson(controller, { type: 'asst_response', content: chunk.message.content })

                        // Send message ID right after the first chunk
                        if (!asstIdSent) {
                            let asstMsgId
                            if (lastMsg?.message.role === 'assistant') {
                                asstMsgId = lastMsg.id!
                            } else {
                                asstMsgId = await db.addMessage(chatId, 'assistant', responseTxt, model)
                            }
                            sendJson(controller, { type: 'asst_msg_id', content: asstMsgId })
                            asstIdSent = true
                        }
                    }
                } catch (err) {
                    if (err instanceof DOMException && err.name === 'AbortError') {
                        console.log('Stream aborted')
                    } else {
                        console.error('Error reading response:', err)
                    }
                } finally {
                    const finalMessages = await db.getMessages(chatId)
                    const lastMsg = finalMessages[finalMessages.length - 1]
                    if (responseTxt.length > 0) {
                        if (lastMsg?.message.role === 'assistant') {
                            await db.updateMessage(chatId, lastMsg.id!, responseTxt)
                        } else {
                            await db.addMessage(chatId, 'assistant', responseTxt, model)
                        }

                        const codeInterpreterEnabled = tools.includes(Tool.CodeInterpreter)
                        if (codeInterpreterEnabled) {
                            try {
                                await runEvalLoop(controller, responseTxt)
                            } catch (err) {
                                console.error('Error running eval loop:', err)
                            }
                        } else {
                            console.log('Code interpreter not enabled, ignoring code.')
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
                console.log('Cancelling stream')
                streamCancelled = true
                resp.abort() 
            }
        })
        return stream
    }
}

const ollamaClient = new OllamaClient();

export { ollamaClient }