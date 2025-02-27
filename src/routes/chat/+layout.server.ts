import { DefaultProject } from "$lib";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
    const { ollama, db } = locals
    const [ models, presets, projects ] = await Promise.all([
        ollama.listModels(),
        db.listPresets(),
        db.listProjects(),
    ])

    return {
        models,
        presets,
        projects
    }
}