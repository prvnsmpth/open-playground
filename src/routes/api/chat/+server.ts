import { error, json, type RequestHandler } from "@sveltejs/kit";
import { db } from "$lib/server/db";

type CloneChatRequest = {
    clone: true,
    chatId: string
}

type NewChatRequest = {
    clone?: false,
    systemPrompt: string
}

type CreateChatRequest = CloneChatRequest | NewChatRequest

export const POST: RequestHandler = async ({ params, request })  => {
    const req: CreateChatRequest = await request.json();
    let newChatId
    if (req.clone) {
        console.log(`Cloning chat ${req.chatId}`)
        const chat = await db.getChat(req.chatId)
        if (!chat) {
            throw error(404, `Chat ${req.chatId} not found`)
        }

        newChatId = await db.createChat(chat.systemPrompt)
        await db.updateChat(newChatId, { title: `Copy of ${chat.title}` })
        const messages = await db.getMessages(req.chatId)
        for (const m of messages) {
            await db.addMessage(newChatId, m.message.role, m.message.content, m.model!)
        }
    } else {
        newChatId = await db.createChat(req.systemPrompt)
    }
    return json({ chatId: newChatId })
}
