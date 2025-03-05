import type { SendMessageRequest } from "$lib";
import { error, type RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ params, request, locals })  => {
    const { chatId } = params
    if (!chatId) {
        throw error(400, 'Invalid chatId')
    }

    const { 
        role = 'user', 
        content, 
        model, 
        genConfig, 
        tools, 
        outputFormat 
    }: SendMessageRequest = await request.json()

    try {
        const stream = 
            await locals.ollama.sendMessage(
                chatId, 
                role,
                content, 
                model, 
                genConfig, 
                tools, 
                outputFormat)
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    } catch (err: any) {
        console.error('Error sending message', err)
        throw error(400, err.message)
    }
}
