import { db } from "$lib/server/db"
import { error, type RequestHandler } from "@sveltejs/kit"

export const DELETE: RequestHandler = async ({ params }) => {
    const { chatId } = params
    if (!chatId) {
        throw error(400, 'Invalid chatId')
    }

    try {
        await db.deleteChat(parseInt(chatId))
        return new Response("OK", { status: 200 })
    } catch (err) {
        console.error('Failed to delete chat', err)
        throw error(500, 'Failed to delete chat')
    }
}

export const PATCH: RequestHandler = async ({ request, params }) => {
    const { chatId: chatIdStr } = params
    if (!chatIdStr) {
        throw error(400, 'Invalid chatId')
    }

    const chatId = parseInt(chatIdStr)
    const chat = await db.getChat(chatId)
    const reqBody = await request.json()
    const updatedChat = { ...chat, ...reqBody }

    try {
        await db.updateChat(chatId, updatedChat)
        return new Response("OK", { status: 200 })
    } catch (err) {
        console.error('Failed to update chat', err)
        throw error(500, 'Failed to update chat')
    }
}