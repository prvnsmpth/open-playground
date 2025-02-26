import { connect } from "$lib/server/db";
import { error, json, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ params, locals }) => {
    const { presetId } = params;
    if (!presetId) {
        throw error(400, 'Preset ID is required');
    }

    const preset = await locals.db.getPreset(presetId);
    if (!preset) {
        throw error(404, 'Preset not found');
    }

    return json(preset)
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
    const { presetId } = params;
    if (!presetId) {
        throw error(400, 'Preset ID is required');
    }
    await locals.db.deletePreset(presetId);
    return new Response("OK", { status: 200 })
}

export const PUT: RequestHandler = async ({ params, locals, request }) => {
    const { presetId } = params;
    if (!presetId) {
        throw error(400, 'Preset ID is required');
    }
    const { config } = await request.json();
    await locals.db.updatePreset(presetId, config);
    return new Response("OK", { status: 200 })
}