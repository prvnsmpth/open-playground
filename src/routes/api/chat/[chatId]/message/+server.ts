import { error, type RequestHandler } from "@sveltejs/kit";
import { ollamaClient } from "$lib/server/ollama";

export const POST: RequestHandler = async ({ params, request })  => {
    const { chatId } = params
    if (!chatId) {
        throw error(400, 'Invalid chatId')
    }

    const { message, model, modelConfig, tools } = await request.json()

    try {
        const stream = await ollamaClient.sendMessage(chatId, message, model, modelConfig, tools)
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    } catch (err) {
        console.error('Error sending message', err)
        throw error(500, 'Error sending message')
    }
}
