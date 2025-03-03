import { error, json, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ params, locals }) => {
    const projectId = params.projectId;
    if (!projectId) {
        throw error(400, 'Project ID is required');
    }

    try {
        const project = await locals.db.getProject(projectId);
        if (!project) {
            throw error(404, 'Project not found');
        }
        return json(project);
    } catch (err) {
        console.error('Error getting project:', err);
        throw error(500, 'Failed to get project');
    }
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
    const projectId = params.projectId;
    if (!projectId) {
        throw error(400, 'Project ID is required');
    }

    try {
        const { name } = await request.json();
        if (!name) {
            throw error(400, 'Name is required');
        }

        // Check if project exists
        const project = await locals.db.getProject(projectId);
        if (!project) {
            throw error(404, 'Project not found');
        }

        // Update project in database
        await locals.db.updateProject(projectId, { name });
        
        return json({ success: true });
    } catch (err) {
        console.error('Error updating project:', err);
        throw error(500, 'Failed to update project');
    }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    const projectId = params.projectId;
    if (!projectId) {
        throw error(400, 'Project ID is required');
    }

    try {
        // Check if project exists
        const project = await locals.db.getProject(projectId);
        if (!project) {
            throw error(404, 'Project not found');
        }

        // Delete project from database
        await locals.db.deleteProject(projectId);
        
        return json({ success: true });
    } catch (err) {
        console.error('Error deleting project:', err);
        throw error(500, 'Failed to delete project');
    }
};