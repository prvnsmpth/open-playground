import { Ollama, type ModelResponse } from "ollama"
import { db, DbService } from "./db"
import { execSync } from "child_process"
import type { StreamMessage } from "$lib"

// const INSTRUCTIONS = `
// You are an expert Google Sheets agent. Your task is to generate Python code using the Google Python library for Sheets to perform the tasks request by the user.

// Make the following assumptions while generating the code:
// 1. Ignore credentials setup, imports etc. Just generate the relevant portion of the code.
// 2. Assume you have access to a SHEET_ID variable that points to the current spreadsheet ID
// 3. Assume you have access to a 'sheet' variable that was obtained by doing:

// service = build("sheets", "v4", credentials=delegated_creds)
// sheet = service.spreadsheets()

// After you respond with code, the user will come back to you with the results of executing said code. You can then use the response to answer/respond to the user's original query.

// If there are any errors running the code you generate, you will be provided with the error message. Correct the error and come back with the fixed code.
// `

const INSTRUCTIONS = 'You are a helpful AI agent.'

const TITLE_INSTRUCTIONS = `
You are given the first few messages between a human and an AI assistant. Your task is to come up with a nice short title for the conversation.
Keep it only a few words long, and make sure it captures the essence of the conversation.
Return only the title and nothing else.
`

class OllamaClient {
    private client: Ollama
    private db: DbService
    public DEFAULT_MODEL = 'mistral-small:24b'

    private models?: ModelResponse[]

    constructor() {
        this.client = new Ollama({ host: 'http://localhost:11434' })
        this.db = db
    }

    async listModels() {
        if (this.models) {
            return this.models.map(m => m.name)
        }
        const resp = await this.client.list()
        this.models = resp.models
        return resp.models.map(m => m.name)
    }

    async createChat() {
        return await this.db.createChat()
    }

    async generateTitle(chatId: number): Promise<string> {
        const chat = await this.db.getChat(chatId)
        const messages = await this.db.getMessages(chatId)
        const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n')
        const resp = await this.client.chat({
            model: this.DEFAULT_MODEL,
            messages: [
                { role: 'system', content: TITLE_INSTRUCTIONS },
                { role: 'user', content: `Here is the conversation:\n${conversation}` }
            ],
            options: {
                num_ctx: 32_000
            }
        })
        const title = resp.message.content
        console.log('Generated title:', title)
        const updatedChat = { ...chat, title }
        await this.db.updateChat(chatId, updatedChat)
        return title
    }

    async ensureModel(model: string) {
        const resp = await this.client.ps()
        const otherModels = resp.models.map(m => m.name).filter(m => m !== model)

        for (const m of otherModels) {
            console.log(`Stopping model ${m}...`)
            execSync(`ollama stop ${m}`)
        }
    }

    async regenerateResponse(chatId: number, messageId: number, model: string = this.DEFAULT_MODEL) {
        await this.ensureModel(model)

        const chat = await this.db.getChat(chatId)
        const messages = await this.db.getMessages(chatId)
        const targetMsg = messages.find(m => m.id === messageId)
        if (!targetMsg || !targetMsg.id) {
            throw new Error('Target message not found')
        }

        if (targetMsg.role !== 'assistant') {
            throw new Error('Target message is not an assistant message')
        }

        const targetMsgIdx = messages.findIndex(m => m.id === messageId)

        const resp = await this.client.chat({
            model,
            messages: [
                { role: 'system', content: INSTRUCTIONS },
                ...messages.slice(0, targetMsgIdx)
            ],
            stream: true,
            options: {
                num_ctx: 32_000
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
                }
                try {
                    for await (const chunk of resp) {
                        if (chunk.message.content) {
                            responseTxt += chunk.message.content
                        }
                        sendJson({ type: 'response', content: chunk.message.content || '' })
                    }
                } catch (err) {
                    console.error('Error reading response:', err)
                } finally {
                    if (responseTxt.length > 0) {
                        await db.updateMessage(chat.id, targetMsg.id!, responseTxt)
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

    async sendMessage(chatId: number, msg: string, model: string = this.DEFAULT_MODEL) {
        await this.ensureModel(model)
        const id = await this.db.addMessage(chatId, 'user', msg)
        const chat = await this.db.getChat(chatId)
        const messages = await this.db.getMessages(chatId)
        const resp = await this.client.chat({
            model,
            messages: [
                { role: 'system', content: INSTRUCTIONS },
                ...messages
            ],
            stream: true,
            options: {
                num_ctx: 32_000
            }
        })

        let responseTxt = ''
        let db = this.db

        const encoder = new TextEncoder()
        const generateTitle = async () => await this.generateTitle(chatId)
        let streamCancelled = false
        const stream = new ReadableStream({
            async start(controller) {
                function sendJson(json: StreamMessage) {
                    controller.enqueue(encoder.encode(JSON.stringify(json)))
                    controller.enqueue(encoder.encode('\n'))
                }

                try {
                    sendJson({ type: 'user_msg_id', content: id })
                    for await (const chunk of resp) {
                        responseTxt += chunk.message.content
                        sendJson({ type: 'response', content: chunk.message.content })
                    }
                } catch (err) {
                    console.error('Error reading response:', err)
                } finally {
                    if (responseTxt.length > 0) {
                        const id = await db.addMessage(chatId, 'assistant', responseTxt)
                        if (!streamCancelled) {
                            sendJson({ type: 'asst_msg_id', content: id })
                        }
                    }

                    // Generate title if required
                    if (!chat.title) {
                        const title = await generateTitle()
                        if (!streamCancelled) {
                            sendJson({ type: 'chat_title', content: title })
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
}

const ollamaClient = new OllamaClient();

export { ollamaClient }