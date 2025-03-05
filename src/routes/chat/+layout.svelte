<script lang="ts">
    import { invalidateAll } from '$app/navigation'
    import { DefaultPreset, BuiltinTool, type Preset } from '$lib'
    import { presetStore } from '$lib/client/index.svelte'
    import Tooltip from '$lib/components/basic-tooltip.svelte'
    import CircularLoader from '$lib/components/circular-loader.svelte'
    import Combobox from '$lib/components/combobox.svelte'
    import Button from '$lib/components/ui/button/button.svelte'
    import * as Dialog from '$lib/components/ui/dialog'
    import { Input } from '$lib/components/ui/input'
    import { Label } from '$lib/components/ui/label'
    import * as Select from '$lib/components/ui/select'
    import { Slider } from '$lib/components/ui/slider'
    import { Toaster } from '$lib/components/ui/sonner'
    import { ExternalLink, SquarePen, TriangleAlert, X } from 'lucide-svelte'
    import type { ProgressResponse } from 'ollama'
    import { onMount } from 'svelte'
    import { toast } from "svelte-sonner"
    import ChatListView from './chat-list-view.svelte'
    import OutputFormatComponent from './output-format.svelte'
    import ToolManager from './tool-manager.svelte'

    let { data, children } = $props();

    // Preset that is persisted to db.
    let persistedPreset = $state<Preset | null>(null) 
    let preset = $derived(presetStore.value.config)
    let presetModified = $derived.by(() => {
        return JSON.stringify(presetStore.value) !== JSON.stringify(persistedPreset)
    })

    onMount(() => {
        if (!preset.model && data.models.length > 0) {
            preset.model = data.models[0]
        }

        if (presetStore.value.id) {
            fetchPreset(presetStore.value.id).then(preset => {
                if (preset) {
                    persistedPreset = preset
                }
            })
        }
    })

    let presetSelectOpen = $state(false)

    function handleModelChange(model: string) {
        presetStore.value.config.model = model
    }

    let codeInterpreterEnabled = {
        get value() {
            return preset.tools?.includes(BuiltinTool.CodeInterpreter) ?? false
        },
        set value(value: boolean) {
            if (!preset.tools) {
                preset.tools = []
            }
            if (value) {
                preset.tools.push(BuiltinTool.CodeInterpreter)
            } else {
                preset.tools = preset.tools.filter((tool) => tool !== BuiltinTool.CodeInterpreter)
            }
        }
    }

    let savePresetDialogOpen = $state(false)
    let presetName = $state('')
    async function savePreset(e: SubmitEvent) {
        e.preventDefault()

        if (!presetName) {
            return
        }

        const resp = await fetch('/api/preset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: presetName,
                config: preset
            })
        })

        if (!resp.ok) {
            console.error('Failed to save preset', await resp.text())
            return
        }

        savePresetDialogOpen = false

        const { id } = await resp.json()
        await fetchAndLoadPreset(id)

        invalidateAll()
    }
    async function updatePreset() {
        if (!presetStore.value.id) {
            return
        }

        const resp = await fetch(`/api/preset/${presetStore.value.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                config: preset
            })
        })
        if (!resp.ok) {
            toast.error('Failed to update preset')
            return
        }

        toast.success('Preset updated')
        persistedPreset = await fetchPreset(presetStore.value.id)
        invalidateAll()
    }

    async function fetchPreset(presetId: string): Promise<Preset | null> {
        const resp = await fetch(`/api/preset/${presetId}`)
        if (!resp.ok) {
            console.error('Failed to load preset', await resp.text())
            return null
        }
        return await resp.json()
    }

    async function fetchAndLoadPreset(presetId: string): Promise<Preset | null> {
        const preset = await fetchPreset(presetId)
        if (!preset) {
            return null
        }
        presetStore.value = preset
        presetSelectOpen = false
        return preset
    }

    let modelPullDialogOpen = $state(false)
    let modelName = $state('')
    let pullingModel = $state(false)
    let pullProgress = $state<ProgressResponse | null>(null)
    async function pullModel() {
        if (!modelName) {
            return
        }

        pullingModel = true
        const resp = await fetch('/api/ollama', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'pull',
                model: modelName
            })
        })

        if (!resp.ok) {
            toast.error('Failed to pull model')
            return
        }

        const reader = resp.body?.getReader()
        if (!reader) {
            toast.error('Failed to read response from Ollama')
            return
        }

        const decoder = new TextDecoder()
        let partialChunk = ''
        while (true) {
            let chunk: string
            try {
                const { done, value } = await reader.read()
                if (done) {
                    break
                }
                chunk = decoder.decode(value)
            } catch (err) {
                console.error(err)
                break
            }

            const events = (partialChunk + chunk).split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => {
                    try {
                        console.log('Attempting to parse:', line)
                        return JSON.parse(line)
                    } catch (err) {
                        partialChunk = line
                        return null
                    }
                })
                .filter(m => m !== null)
            
            for (const event of events) {
                console.log(event)
                pullProgress = event
            }
        }

        pullingModel = false
        modelPullDialogOpen = false
        toast.success('Model pulled successfully')
        invalidateAll()
    }
</script>

<Toaster position="top-center" />

<div class="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] h-full overflow-hidden">
    <div class="flex flex-col border-r bg-muted overflow-y-auto">
        <ChatListView 
            projects={data.projects}
            onProjectCreate={(p) => {
                data = {
                    ...data,
                    projects: [p, ...data.projects]
                }
            }}
        />
    </div>

    <!-- Middle column-->
    <div class="flex flex-col overflow-hidden">
        <div class="border-b h-14 flex items-center px-2 shrink-0">
            <div class="font-bold px-4 text-lg">Chat</div>
            <div class="flex-1"></div>
            <Tooltip tooltip="New Chat">
                <Button variant="ghost" size="sm" href="/">
                    <SquarePen />
                    New chat
                </Button>
            </Tooltip>
        </div>
        {#if data.models.length === 0}
            <div class="m-2 w-full flex justify-center">
                <div class="flex items-center gap-2 bg-yellow-200 border border-yellow-500 text-yellow-800 text-sm p-2 rounded-lg w-fit shadow-lg">
                    <TriangleAlert class="w-4 h-4" />
                    <span>
                        You do not have any local models yet.
                        <button class="underline" onclick={() => modelPullDialogOpen = true}>Pull a model</button>
                        on ollama to get started.
                    </span>
                </div>
            </div>
        {/if}
        <div class="flex-1 overflow-y-auto flex flex-col">
            {@render children()}
        </div>
    </div>

    <div class="flex flex-col border-l overflow-hidden">
        <div class="flex w-full justify-start items-center p-2 h-14 border-b shrink-0">
            <Select.Root type="single" name="model" bind:open={presetSelectOpen} value={presetStore.value.id} onValueChange={fetchAndLoadPreset}>
                <Select.Trigger class="w-full flex items-start gap-2 text-foreground">
                    <div class="flex gap-2 items-center justify-between w-full">
                        {presetStore.value.name ?? 'Select a preset'}
                        {#if presetStore.value.id}
                            <Button variant="ghost" size="icon" class="w-4 h-4 p-1" onclick={(e) => { presetStore.value = DefaultPreset; e.stopPropagation(); }}>
                                <X class="w-3 h-3" />
                            </Button>
                        {/if}
                    </div>
                </Select.Trigger>
                <Select.Content align="start">
                    {#each data.presets as preset}
                        <Select.Item value={preset.id!} label={preset.name}>{preset.name}</Select.Item>
                    {:else}
                        <div class="text-xs text-muted-foreground p-4 text-center">No presets found</div>
                    {/each}
                </Select.Content>
            </Select.Root>
        </div>
        <div class="flex-1 flex flex-col gap-12 min-h-0 overflow-y-auto p-6">
            <div class="flex flex-col gap-2">
                <p class="uppercase font-bold text-xs">Model</p>
                <div class="flex flex-col gap-1">
                    <div class="flex items-top gap-1.5">
                        <Combobox 
                            value={preset.model ?? ''}
                            placeholder="Select a model" 
                            emptyMessage="No models found" 
                            items={data.models.map((m: any) => ({ value: m, label: m }))} 
                            onItemSelect={handleModelChange} />
                    </div>
                    <button class="underline text-xs" onclick={() => modelPullDialogOpen = true}>Pull model</button>
                </div>
            </div>

            <OutputFormatComponent />

            <ToolManager {codeInterpreterEnabled} />

            <div class="flex flex-col gap-2">
                <p class="uppercase font-bold text-xs">Model Config</p>
                <div class="flex flex-col gap-8">
                    <div class="flex flex-col gap-1">
                        <Label class="flex items-center justify-between">
                            Temperature
                            <span class="text-xs text-muted-foreground p-1 border rounded">{preset.temperature}</span>
                        </Label>
                        <Slider type="single" bind:value={preset.temperature} max={2.0} min={0.0} step={0.1} />
                    </div>
                    <div class="flex flex-col gap-1">
                        <Label class="flex items-center justify-between">
                            Max Tokens
                            <span class="text-xs text-muted-foreground p-1 border rounded">{preset.maxTokens}</span>
                        </Label>
                        <Slider type="single" bind:value={preset.maxTokens} max={16_000} min={0} step={100} />
                    </div>
                    <div class="flex flex-col gap-1">
                        <Label class="flex items-center justify-between">
                            Top P
                            <span class="text-xs text-muted-foreground p-1 border rounded">{preset.topP}</span>
                        </Label>
                        <Slider type="single" bind:value={preset.topP} max={1.0} min={0.0} step={0.01} />
                    </div>
                </div>
            </div>

            <!-- If the current preset is saved (i.e., id is defined) and it has been modified, show the save button instead -->
            {#if presetStore.value.id}
                {#if presetModified}
                    <Button variant="secondary" onclick={updatePreset}>Save changes</Button>
                {/if}
            {:else}
                <Button variant="secondary" onclick={() => savePresetDialogOpen = true}>Save as preset</Button>
            {/if}
        </div>
    </div>
</div>

<Dialog.Root bind:open={savePresetDialogOpen}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>Save preset</Dialog.Title>
        </Dialog.Header>
        <form class="flex flex-col gap-4" onsubmit={savePreset}>
            <Input type="text" 
                bind:value={presetName} 
                placeholder="Enter preset name..." />
            <Dialog.Footer>
                <Button variant="outline" onclick={() => savePresetDialogOpen = false}>Cancel</Button>
                <Button type="submit">Save</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={modelPullDialogOpen}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>Pull model</Dialog.Title>
            <Dialog.Description>
                Choose a model from the 
                <a href="https://ollama.com/library" target="_blank" class="underline inline-flex items-center gap-1">
                    Ollama Library
                    <ExternalLink class="w-4 h-4" />
                </a>
            </Dialog.Description>
        </Dialog.Header>
        <Label for="model">Model name</Label>
        <Input id="model" type="text" 
            bind:value={modelName} 
            placeholder="E.g., llama3.2:1b" />
        {#if pullProgress}
            <div class="text-xs text-muted-foreground">
                status: {pullProgress.status}
                {#if pullProgress.total}
                    ({pullProgress.completed}/{pullProgress.total})
                {/if}
            </div>
        {/if}
        <Dialog.Footer>
            <Button variant="outline" onclick={() => modelPullDialogOpen = false}>Cancel</Button>
            <Button type="submit" onclick={pullModel} disabled={pullingModel || !modelName}>
                {#if pullingModel}
                    <CircularLoader />
                    Pulling...
                {:else}
                    Pull
                {/if}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
