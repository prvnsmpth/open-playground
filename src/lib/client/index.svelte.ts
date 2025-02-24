import { browser } from '$app/environment'
import { type Preset, type PresetConfig, Tool } from '$lib'

class LocalStore<T> {
    public value = $state<T>() as T
    public key

    constructor(key: string, value: T) {
        this.key = key
        this.value = value

        if (browser) {
            const item = localStorage.getItem(key)
            if (item) {
                this.value = this.deserialize(item)
            }
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

export function localStore<T>(key: string, value: T) {
    return new LocalStore<T>(key, value)
}

const defaultPreset: Preset = {
    id: 'default',
    name: 'Default',
    config: {
        temperature: 0.7,
        maxTokens: 2048,
        topP: 1,
        tools: [Tool.CodeInterpreter],
    },
    createdAt: Date.now(),
}
export const presetStore = localStore('preset', defaultPreset)
export const loadPreset = (preset: Preset) => {
    presetStore.value = preset
}