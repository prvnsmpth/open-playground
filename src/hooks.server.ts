import { connect } from '$lib/server/db';
import { createOllamaClient } from '$lib/server/ollama';

export const handle = async ({ event, resolve }) => {
    const db = connect()
    const ollama = createOllamaClient()
    event.locals = {
        db,
        ollama
    }
    return resolve(event);
};