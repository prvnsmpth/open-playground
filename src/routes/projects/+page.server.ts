import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    const projects = await locals.db.listProjects();
    
    return {
        projects
    };
};