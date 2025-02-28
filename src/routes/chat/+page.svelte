<script lang="ts">
	import { goto } from '$app/navigation';
    import MessageInput from '$lib/components/message-input.svelte'
    import AutoTextarea from '$lib/components/auto-textarea.svelte';
    import * as Accordion from '$lib/components/ui/accordion'
	import { debounce } from '$lib/utils';
	import { presetStore, selectedProject } from '$lib/client/index.svelte';
    import { chatList } from './index.svelte'
	import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
	import type { Chat } from '$lib';

    const preset = $derived(presetStore.value)

    let chatMsg = $state('')
    let chatMsgInput: HTMLTextAreaElement | undefined = $state()
    let chatMsgInputError: string | null = $state(null)

    async function onSubmit() {
        console.log(`Creating chat in project: ${selectedProject.value.name}`)
        if (!chatMsg) {
            chatMsgInputError = 'Please enter a message'
            chatMsgInput?.focus()
            return
        }

        if (!preset.config.model) {
            toast.error('Please select a model')
            return
        }

        const resp = await fetch('/api/chat', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                projectId: selectedProject.value.id,
                systemPrompt: systemPrompt.value 
            })
        })
        if (!resp.ok) {
            console.error('Failed to create chat:', await resp.text())
            return
        }

        const { chatId } = await resp.json()
        
        // Add the new chat to the chat list store
        const newChat: Chat = {
            id: chatId,
            projectId: selectedProject.value.id,
            title: 'Untited Chat',
            systemPrompt: systemPrompt.value,
            createdAt: Date.now()
        }
        chatList.value.unshift(newChat)
        
        goto(`/chat/${chatId}`, {
            invalidateAll: true,
            state: {
                message: chatMsg
            }
        })
    }

    const saveSysPrompt = debounce(async (prompt: string) => {
        if (systemPrompt === null) {
            return
        }
        preset.config.systemPrompt = prompt
    }, 300)

    let systemPrompt = $derived({
        prompt: preset.config.systemPrompt || '',

        get value() {
            return this.prompt
        },

        set value(value: string) {
            this.prompt = value
            saveSysPrompt(value)
        }
    })

    let initializing = $state(true)
    onMount(() => {
        initializing = false
    })
</script>

<div class="flex-1 min-h-0 flex flex-col gap-4 items-center justify-center px-8">
    <div class="prose pt-8">
        <h2>Start a new chat</h2>
    </div>
    {#if !initializing}
        <div class="flex border prose w-full max-w-screen-md rounded-2xl p-4">
            <Accordion.Root type="single" class="w-full" value={systemPrompt.value ? 'systemPrompt' : undefined}>
                <Accordion.Item value="systemPrompt" class="border-none">
                    <Accordion.Trigger class="hover:no-underline border-b-none text-sm py-0 w-full font-bold">
                        System prompt
                    </Accordion.Trigger>
                    <Accordion.Content class="w-full pt-4">
                        <AutoTextarea 
                            bind:value={systemPrompt.value} 
                            class="w-full resize-none outline-none ring-0 text-base bg-card" 
                            placeholder="You are a helpful AI agent..." />
                    </Accordion.Content>
                </Accordion.Item>
            </Accordion.Root>
        </div>
    {/if}
    <div class="flex-1"></div>
    <MessageInput bind:chatMsg bind:chatMsgInput {onSubmit} error={chatMsgInputError} />
</div>
