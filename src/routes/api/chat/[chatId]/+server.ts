import { error, type RequestHandler } from "@sveltejs/kit"

export const DELETE: RequestHandler = async ({ params, locals }) => {
    const db = locals.db
    const { chatId } = params
    if (!chatId) {
        throw error(400, 'Invalid chatId')
    }

    try {
        await db.deleteChat(chatId)
        return new Response("OK", { status: 200 })
    } catch (err) {
        console.error('Failed to delete chat', err)
        throw error(500, 'Failed to delete chat')
    }
}

export const PATCH: RequestHandler = async ({ request, params, locals }) => {
    const db = locals.db
    const { chatId } = params
    if (!chatId) {
        throw error(400, 'Invalid chatId')
    }

    const chat = await db.getChat(chatId)
    if (!chat) {
        throw error(404, 'Chat not found')
    }

    const reqBody = await request.json()

    try {
        await db.updateChat(chatId, reqBody)
        return new Response("OK", { status: 200 })
    } catch (err) {
        console.error('Failed to update chat', err)
        throw error(500, 'Failed to update chat')
    }
}