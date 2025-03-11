import logger from "$lib/server/logger";
import { error, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ request, params, locals }) => {
    const { db } = locals
    const { projectId } = params 
    if (!projectId) {
        throw error(400, 'Missing projectId')
    }

    const chats = await db.listChats(projectId)
    logger.info({ message: `Exporting ${chats.length} chats from project ${projectId}` })

    const dataStream = new ReadableStream({
        async start(controller) {
            for (const chat of chats) {
                const messages = await db.getMessages(chat.id!)
                const chatData = {
                    chat,
                    messages
                }
                controller.enqueue(JSON.stringify(chatData) + '\n')
            }
            controller.close()
        }
    })

    return new Response(dataStream, {
        headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="project-${projectId}.json"`
        }
    })
}