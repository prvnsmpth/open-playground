import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'
import { error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ params }) => {
    if (!params.chatId) {
        throw error(404, 'Chat not found')
    }
    const chat = await db.getChat(params.chatId)
    if (!chat) {
        throw error(404, 'Chat not found')
    }

    const messages = await db.getMessages(params.chatId)

    return {
        chat,
        messages
    } 
}