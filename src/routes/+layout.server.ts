import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
    const chats = await locals.db.listChats()
    const models = await locals.ollama.listModels()
    const presets = await locals.db.listPresets()
    return {
        chats,
        models,
        presets,
    }
}