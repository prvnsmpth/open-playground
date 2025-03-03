import { DefaultProject } from "$lib";
import { fail, type Actions } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import logger from "$lib/server/logger";

export const load: PageServerLoad = async ({ locals, url }) => {
    const { db } = locals
    
    // Load projects and datasets
    const [projects, datasets] = await Promise.all([
        db.listProjects(),
        db.listDatasets()
    ]);
    
    return {
        projects,
        datasets,
    }
}

export const actions = {
    create: async ({ locals, request }) => {
        const { db } = locals
        const formData = await request.formData()
        const name = formData.get('name')
        if (!name) {
            logger.error({ message: 'Attempt to create dataset without name', name })
            return fail(400, {
                error: 'Name is required'
            })
        }
        logger.info({ message: 'Creating dataset', name })
        await db.createDataset(DefaultProject.id, name as string)
        return {
            success: true
        }
    },
    
    update: async ({ locals, request }) => {
        const { db } = locals
        const formData = await request.formData()
        const id = formData.get('id')
        const name = formData.get('name')
        
        if (!id) {
            logger.error({ message: 'Attempt to update dataset without id' })
            return fail(400, {
                error: 'Dataset ID is required'
            })
        }
        
        if (!name) {
            logger.error({ message: 'Attempt to update dataset without name', id })
            return fail(400, {
                error: 'Name is required'
            })
        }
        
        logger.info({ message: 'Updating dataset', id, name })
        await db.updateDataset(id as string, { name: name as string })
        return {
            updated: true
        }
    },
    
    delete: async ({ locals, request }) => {
        const { db } = locals
        const formData = await request.formData()
        const id = formData.get('id')
        
        if (!id) {
            logger.error({ message: 'Attempt to delete dataset without id' })
            return fail(400, {
                error: 'Dataset ID is required'
            })
        }
        
        logger.info({ message: 'Deleting dataset', id })
        await db.deleteDataset(id as string)
        return {
            deleted: true
        }
    }
} satisfies Actions