import { ChatSession, GenerativeModel, GoogleGenerativeAI, type EnhancedGenerateContentResponse } from "@google/generative-ai";
import { env } from '$env/dynamic/private'
import { db, DbService, type ChatMessage } from "./db";

const INSTRUCTIONS = `
You are an expert Google Sheets agent. Your task is to generate Python code using the Google Python library for Sheets to perform the tasks request by the user.

Make the following assumptions while generating the code:
1. Ignore credentials setup, imports etc. Just generate the relevant portion of the code.
2. Assume you have access to a SHEET_ID variable that points to the current spreadsheet ID
3. Assume you have access to a 'sheet' variable that was obtained by doing:

service = build("sheets", "v4", credentials=delegated_creds)
sheet = service.spreadsheets()

After you respond with code, the user will come back to you with the results of executing said code. You can then use the response to answer/respond to the user's original query.

If there are any errors running the code you generate, you will be provided with the error message. Correct the error and come back with the fixed code.
`

class Gemini {
    private model: GenerativeModel
    private db: DbService

    private chatSessions: Map<number, ChatSession> = new Map()

    constructor() {
        const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY) 
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
        this.db = db
    }

    private newSession(messages: ChatMessage[] = []) {
        console.log('Creating new chat session')
        return this.model.startChat({
            systemInstruction: {
                role: 'user',
                parts: [{ text: INSTRUCTIONS }]
            },
            generationConfig: {
                temperature: 0.3 
            },
            history: messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }))
        })
    }

    async createChat(): Promise<number> {
        const chatId = await this.db.createChat()
        const session = this.newSession()
        this.chatSessions.set(chatId, session)
        return chatId
    }

    async sendMessage(chatId: number, message: string) {
        this.db.addMessage(chatId, 'user', message)

        const messages = await this.db.getMessages(chatId)

        if (!this.chatSessions.has(chatId)) {
            this.chatSessions.set(chatId, this.newSession(messages))
        }

        const session = this.chatSessions.get(chatId)
        const result = await session!.sendMessage(message)
        return result.response.text()
    }
}

class GeminiRest {
    private db: DbService
    private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models'
    private modelId: string = 'gemini-2.0-flash'
    private apiKey: string

    constructor() {
        this.db = db
        this.apiKey = env.GEMINI_API_KEY
    }

    async createChat(): Promise<number> {
        return await this.db.createChat()
    }

    async sendMessage(chatId: number, message: string) {
        this.db.addMessage(chatId, 'user', message)
        const messages = await this.db.getMessages(chatId)

        const req = {
            systemInstruction: {
                parts: [{ text: INSTRUCTIONS }]
            },
            contents: messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
            generationConfig: {
                temperature: 0.7
            }
        }

        const url = `${this.baseUrl}/${this.modelId}:generateContent?alt=sse&key=${this.apiKey}`
        console.log('URL:', url)
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req)
        })
        console.log('Response:', resp.status)
        if (!resp.ok) {
            console.error('Error sending message:', resp.statusText)
            throw new Error('Error sending message')
        }

        const body = resp.body

        const db = this.db
        async function* generate() {
            try {
                const decoder = new TextDecoder()
                let responseTxt = ''
                const reader = body!.getReader()
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) {
                        break
                    }
                    const txt = decoder.decode(value)
                    console.log('Text:', txt)
                    responseTxt += txt
                    yield txt
                }
                await db.addMessage(chatId, 'model', responseTxt) 
            } catch (err) {
                console.error('Error:', err)
                throw new Error('Error sending message')
            }
        }

        return generate()
    }
}

const gemini = new Gemini()
const geminiRest = new GeminiRest()

export { gemini, geminiRest }