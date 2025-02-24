<script lang="ts">
    import '../app.css';
    import ChatComponent from '$lib/components/chat.svelte';
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Select from '$lib/components/ui/select';
    import { SquarePen } from 'lucide-svelte';
    import { presetStore } from '$lib/client/index.svelte'
    import { Tool } from '$lib'
    import Tooltip from '$lib/components/basic-tooltip.svelte'
    import { onMount } from 'svelte';
    import * as Dialog from '$lib/components/ui/dialog'
    import { Input } from '$lib/components/ui/input'
    import { invalidateAll } from '$app/navigation';
    import { Checkbox } from '$lib/components/ui/checkbox'
    import { Label } from '$lib/components/ui/label'
    import { Slider } from '$lib/components/ui/slider'
	import Combobox from '$lib/components/combobox.svelte';

    let { data, children } = $props();

    let preset = $derived(presetStore.value.config)

    onMount(() => {
        if (!preset.model && data.models.length > 0) {
            preset.model = data.models[0]
        }
        if (presetStore.value.id) {
            fetchAndLoadPreset(presetStore.value.id)
        }
    })

    let dropdownOpen = $state(false)

    function handleModelChange(value: string) {
        preset.model = value
        dropdownOpen = false
    }

    let newChatTitle = $state('')
    let renameChatDialogOpen = $state(false)
    let renameChatId = $state<string | null>(null)
    function onRenameChat(chatId: string) {
        renameChatId = chatId
        renameChatDialogOpen = true
    }

    async function renameChat() {
        if (!newChatTitle || !renameChatId) {
            return
        }

        const resp = await fetch(`/api/chat/${renameChatId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: newChatTitle
            })
        })

        if (!resp.ok) {
            console.error('Failed to rename chat', await resp.text())
            return
        }

        renameChatDialogOpen = false
        renameChatId = null
        newChatTitle = ''
        invalidateAll()
    }

    let codeInterpreterEnabled = {
        get value() {
            return preset.tools?.includes(Tool.CodeInterpreter) ?? false
        },
        set value(value: boolean) {
            if (!preset.tools) {
                preset.tools = []
            }
            if (value) {
                preset.tools.push(Tool.CodeInterpreter)
            } else {
                preset.tools = preset.tools.filter((tool) => tool !== Tool.CodeInterpreter)
            }
        }
    }

    let savePresetDialogOpen = $state(false)
    let presetName = $state('')
    async function savePreset() {
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
    }

    async function fetchAndLoadPreset(presetId: string) {
        const resp = await fetch(`/api/preset/${presetId}`)
        if (!resp.ok) {
            console.error('Failed to load preset', await resp.text())
            return
        }

        const preset = await resp.json()
        presetStore.value = preset
    }
</script>

<main class="grid h-screen grid-cols-1 lg:grid-cols-[280px_1fr_320px]">
    <div class="flex flex-col h-full border-r bg-muted overflow-y-auto">
        <div class="flex w-full justify-between items-center p-2 h-14 border-b">
            <div class="ml-2 p-1 pb-0 font-mono">
                [open-playground]
            </div>
            <Tooltip tooltip="New Chat">
                <Button variant="ghost" size="sm" href="/" class="hover:bg-gray-200">
                    <SquarePen />
                </Button>
            </Tooltip>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto pb-10">
            {#each data.chats as chat}
                <ChatComponent {chat} {onRenameChat} />
            {:else}
                <p class="text-muted-foreground text-xs uppercase text-center font-bold mt-4">
                    No chats found
                </p>
            {/each}
        </div>
    </div>
    <div class="flex h-screen flex-col">
        <div class="border-b h-14 flex items-center px-2">
            <div class="font-bold px-4 text-lg">Chat</div>
            <div class="flex-1"></div>
            <div class="block md:hidden">
                <Button variant="ghost" size="sm" href="/" class="hover:bg-gray-200">
                    <SquarePen />
                </Button>
            </div>
        </div>
        {@render children()}
    </div>
    <div class="flex flex-col h-full border-l overflow-y-auto">
        <div class="flex w-full justify-start items-center p-2 h-14 border-b">
            <Combobox 
                value={presetStore.value.id}
                placeholder="Select preset" 
                emptyMessage="No presets found" 
                items={data.presets.map(p => ({ value: p.id, label: p.name }))} 
                onItemSelect={fetchAndLoadPreset}
            />
        </div>
        <div class="flex-1 flex flex-col gap-12 min-h-0 overflow-y-auto p-6">
            <div class="prose">
                <p class="uppercase font-bold text-xs">Model</p>
                <div class="flex flex-col gap-1">
                    <div class="flex items-top gap-1.5">
                        <Select.Root type="single" name="model" bind:open={dropdownOpen} onValueChange={handleModelChange}>
                            <Select.Trigger class="w-fit flex gap-2 text-foreground">
                                {preset.model ?? "Select a model"}
                            </Select.Trigger>
                            <Select.Content align="start">
                                {#each data.models as model}
                                    <Select.Item value={model} label={model}>{model}</Select.Item>
                                {/each}
                            </Select.Content>
                        </Select.Root>
                    </div>
                </div>
            </div>

            <div class="prose">
                <p class="uppercase font-bold text-xs">Tools</p>
                <div class="flex flex-col gap-1">
                    <div class="flex items-top gap-1.5">
                        <Checkbox id="code-interpreter" bind:checked={codeInterpreterEnabled.value} />
                        <div class="flex flex-col gap-1.5">
                            <Label for="code-interpreter" class="flex flex-col gap-1">
                                Code Interpreter
                            </Label>
                            <p class="text-xs text-muted-foreground m-0">Execute any generated Python code</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="prose">
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

            <Button variant="secondary" onclick={() => savePresetDialogOpen = true}>Save as preset</Button>
        </div>
    </div>
</main>

<Dialog.Root bind:open={renameChatDialogOpen}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>Rename chat</Dialog.Title>
        </Dialog.Header>
        <Input type="text" 
            bind:value={newChatTitle} 
            placeholder="Enter new chat title..." />
        <Dialog.Footer>
            <Button variant="outline" onclick={() => renameChatDialogOpen = false}>Cancel</Button>
            <Button type="submit" onclick={renameChat}>Rename</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={savePresetDialogOpen}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>Save preset</Dialog.Title>
        </Dialog.Header>
        <Input type="text" 
            bind:value={presetName} 
            placeholder="Enter preset name..." />
        <Dialog.Footer>
            <Button variant="outline" onclick={() => savePresetDialogOpen = false}>Cancel</Button>
            <Button type="submit" onclick={savePreset}>Save</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
