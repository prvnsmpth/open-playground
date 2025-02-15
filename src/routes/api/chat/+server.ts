import { error, json, type RequestHandler } from "@sveltejs/kit";
import { db } from "$lib/server/db";

export const POST: RequestHandler = async ({ params, request })  => {
    const chatId = await db.createChat()
    return json({ chatId })
}
