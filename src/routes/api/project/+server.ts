import { error, json, type RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ request, locals }) => {
    const { name } = await request.json();
    if (!name) {
        throw error(400, 'Name is required');
    }

    const id = await locals.db.createProject(name);
    return json({ id })
};