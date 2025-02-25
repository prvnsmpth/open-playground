import { error, type RequestHandler } from "@sveltejs/kit";
import logger from "$lib/server/logger";

export const POST: RequestHandler = async ({ request, locals }) => {
    const req = await request.json()
    if (req.type === 'pull') {
        const { model } = req
        const resp = await locals.ollama.pullModel(model)
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            async start(controller) {
                logger.info('Starting progress stream')
                for await (const chunk of resp) {
                    logger.info('Sending model pull progress:', chunk)
                    controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))
                }
                controller.close()
                locals.ollama.clearModelCache()
            }
        })
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    } else {
        throw error(400, 'Invalid request type')
    }
}