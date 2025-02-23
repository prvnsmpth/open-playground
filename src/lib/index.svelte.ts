import { browser } from '$app/environment'

export type AppState = {
    model?: string,
    systemPrompt?: string
}

class LocalStore<T> {
    public value = $state<T>()
    public key

    constructor(key: string, value: T) {
        this.key = key
        this.value = value

        if (browser) {
            const item = localStorage.getItem(key)
            if (item) this.value = this.deserialize(item)
        }

        $effect.root(() => {
            $effect(() => {
                if (this.value) {
                    console.log('Saving state to localStorage:', this.value)
                    localStorage.setItem(this.key, this.serialize(this.value))
                }
            })
            return () => {}
        })
    }

    serialize(value: T): string {
        return JSON.stringify(value)
    }

    deserialize(item: string): T {
        return JSON.parse(item)
    }
}

export function localStore(key: string, value: AppState) {
    return new LocalStore<AppState>(key, value)
}

export const appState = localStore('state', {})