<script lang="ts">
	import { goto } from '$app/navigation';
    import MessageInput from '$lib/components/message-input.svelte'
    import AutoTextarea from '$lib/components/auto-textarea.svelte';
    import * as Accordion from '$lib/components/ui/accordion'
	import { debounce } from '$lib/utils';
	import { presetStore } from '$lib/client/index.svelte';

    const preset = presetStore.value

    let chatMsg = $state('')
    let chatMsgInput: HTMLTextAreaElement | undefined = $state()

    async function onSubmit() {
        const resp = await fetch('/api/chat', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ systemPrompt: systemPrompt.value })
        })
        if (!resp.ok) {
            console.error('Failed to create chat:', await resp.text())
            return
        }

        const { chatId } = await resp.json()
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

    let systemPrompt = {
        prompt: preset.config.systemPrompt || '',

        get value() {
            return this.prompt
        },

        set value(value: string) {
            this.prompt = value
            saveSysPrompt(value)
        }
    }
</script>

<div class="flex-1 min-h-0 flex flex-col gap-4 items-center justify-center px-8">
    <div class="prose">
        <h2>Start a new chat</h2>
    </div>
    <div class="flex border prose w-full max-w-screen-md rounded-2xl p-4">
        <Accordion.Root type="single" class="w-full">
            <Accordion.Item value="reasoning" class="border-none">
                <Accordion.Trigger class="hover:no-underline border-b-none text-sm py-0 w-full font-bold">
                    System prompt
                </Accordion.Trigger>
                <Accordion.Content class="w-full pt-4">
                    <AutoTextarea 
                        bind:value={systemPrompt.value} 
                        class="w-full resize-none outline-none ring-0 text-base" 
                        placeholder="You are a helpful AI agent..." />
                </Accordion.Content>
            </Accordion.Item>
        </Accordion.Root>
    </div>
    <MessageInput bind:chatMsg bind:chatMsgInput {onSubmit} />
</div>
