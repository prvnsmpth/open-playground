import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import logger from '$lib/server/logger'

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!params.chatId) {
        throw error(404, 'Chat not found')
    }
    const chat = await locals.db.getChat(params.chatId)
    logger.info({ message: 'Chat', chat })
    if (!chat) {
        throw error(404, 'Chat not found')
    }

    const messages = await locals.db.getMessages(params.chatId)

    return {
        chat,
        messages
    } 
}