import { error, json, type RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ request, locals }) => {
    const { name, config } = await request.json();
    try {
        const id = await locals.db.savePreset(name, config)
        return json({ id })
    } catch (err) {
        console.error('Failed to save preset:', err)
        throw error(500, 'Failed to save preset')
    }
}