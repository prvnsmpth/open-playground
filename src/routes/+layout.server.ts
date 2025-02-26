import { DefaultProject } from "$lib";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
    const { ollama, db } = locals
    const [ models, presets, projects, chats ] = await Promise.all([
        ollama.listModels(),
        db.listPresets(),
        db.listProjects(),
        db.listChats(DefaultProject.id)
    ])

    return {
        chats,
        models,
        presets,
        projects
    }
}