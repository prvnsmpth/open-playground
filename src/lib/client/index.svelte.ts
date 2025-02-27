import { browser } from '$app/environment'
import { DefaultPreset, DefaultProject, type Preset, type Project } from '$lib'

class LocalStore<T> {
    public value = $state<T>() as T
    public key

    constructor(key: string, initValue: T) {
        this.key = key
        this.value = initValue

        if (browser) {
            const item = localStorage.getItem(key)
            if (item) {
                this.value = this.deserialize(item)
            }
        }

        $effect.root(() => {
            $effect(() => {
                if (this.value) {
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

export function localStore<T>(key: string, defaultValue: T) {
    return new LocalStore<T>(key, defaultValue)
}

export const presetStore = localStore<Preset>('preset', DefaultPreset)
export const loadPreset = (preset: Preset) => {
    presetStore.value = preset
}

export const selectedProject = localStore<Project>('project', DefaultProject)