import { db } from "$lib/server/db"
import { error, type RequestHandler } from "@sveltejs/kit"
import { ollamaClient } from "$lib/server/ollama"

export const PUT: RequestHandler = async ({ request, params }) => {
    const { chatId, messageId } = params
    if (!chatId || !messageId) {
        throw error(400, 'Invalid chatId or messageId')
    }

    const { regenerate = false, content, model, modelConfig, tools } = await request.json()

    if (regenerate) {
        try {
            const stream = await ollamaClient.regenerateResponse(chatId, messageId, model, modelConfig, tools)
            return new Response(stream, { status: 200 })
        } catch (err) {
            console.error('Failed to regenerate message', err)
            throw error(500, 'Failed to regenerate message')
        }
    } else {
        try {
            await db.updateMessage(chatId, messageId, content) 
            return new Response("OK", { status: 200 })
        } catch (err) {
            console.error('Failed to update message', err)
            throw error(500, 'Failed to update message')
        }
    }
}

export const DELETE: RequestHandler = async ({ params }) => {
    const { chatId, messageId } = params
    if (!chatId || !messageId) {
        throw error(400, 'Invalid chatId or messageId')
    }

    try {
        await db.deleteMessage(chatId, messageId)
        return new Response("OK", { status: 200 })
    } catch (err) {
        console.error('Failed to delete message', err)
        throw error(500, 'Failed to delete message')
    }
}