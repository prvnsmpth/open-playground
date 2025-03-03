import { error, json, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ locals }) => {
    try {
        const projects = await locals.db.listProjects();
        return json({ projects });
    } catch (err) {
        console.error('Error listing projects:', err);
        throw error(500, 'Failed to list projects');
    }
};

export const POST: RequestHandler = async ({ request, locals }) => {
    const { name } = await request.json();
    if (!name) {
        throw error(400, 'Name is required');
    }

    const id = await locals.db.createProject(name);
    return json({ id });
};