import type { LayoutServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { ollamaClient } from "$lib/server/ollama";

export const load: LayoutServerLoad = async () => {
    const chats = await db.listChats()
    const models = await ollamaClient.listModels()
    return {
        chats,
        models
    }
}