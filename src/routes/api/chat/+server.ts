import { error, json, type RequestHandler } from "@sveltejs/kit";
import logger from '$lib/server/logger'
import { DefaultProject } from "$lib";

type CloneChatRequest = {
    clone: true,
    chatId: string
}

type NewChatRequest = {
    clone?: false,
    projectId: string,
    systemPrompt: string
}

type CreateChatRequest = CloneChatRequest | NewChatRequest

export const POST: RequestHandler = async ({ request, locals })  => {
    const { db } = locals
    const req: CreateChatRequest = await request.json();
    let newChatId
    if (req.clone) {
        logger.info({ message: 'Cloning chat', chatId: req.chatId })
        const chat = await db.getChat(req.chatId)
        if (!chat) {
            throw error(404, `Chat ${req.chatId} not found`)
        }

        newChatId = await db.createChat(chat.projectId, chat.systemPrompt)
        await db.updateChat(newChatId, { title: `Copy of ${chat.title}` })
        const messages = await db.getMessages(req.chatId)
        for (const m of messages) {
            await db.addMessage(newChatId, m.message.role, m.message.content, m.model!)
        }
    } else {
        newChatId = await db.createChat(req.projectId, req.systemPrompt)
    }
    return json({ chatId: newChatId })
}

export const GET: RequestHandler = async ({ url, locals }) => {
    const { db } = locals
    const projectId = url.searchParams.get('projectId') ?? DefaultProject.id
    const project = await db.getProject(projectId)
    if (!project) {
        throw error(404, `Project ${projectId} not found`)
    }
    logger.info({ message: 'Listing chats', projectId })
    const chats = await db.listChats(projectId)
    return json({ chats })
}
