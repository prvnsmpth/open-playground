import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

export const load: PageServerLoad = async ({ params }) => {
    const chatId = parseInt(params.chatId)
    const chat = await db.getChat(chatId)
    const messages = await db.getMessages(chatId)

    return {
        chatId,
        chat,
        messages
    } 
}