import { error, type RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ params, request, locals })  => {
    const { chatId } = params
    if (!chatId) {
        throw error(400, 'Invalid chatId')
    }

    const { message, model, modelConfig, tools, outputFormat } = await request.json()

    try {
        const stream = 
            await locals.ollama.sendMessage(
                chatId, 
                message, 
                model, 
                modelConfig, 
                tools, 
                outputFormat)
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    } catch (err) {
        console.error('Error sending message', err)
        throw error(500, 'Error sending message')
    }
}
