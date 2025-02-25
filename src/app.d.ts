// See https://svelte.dev/docs/kit/types#app.d.ts

import type { DbService } from "$lib/server/db";
import type { OllamaClient } from "$lib/server/ollama"

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			db: DbService,
			ollama: OllamaClient
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
