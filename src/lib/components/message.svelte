<script lang="ts">
	import type { ChatMessage } from "$lib";
	import { cn, debounce } from "$lib/utils";
    import SvelteMarkdown from '@humanspeak/svelte-markdown'
	import { Pencil, Trash2, Bot, RefreshCcw, Wrench } from "lucide-svelte";
	import type { FormEventHandler } from "svelte/elements";
	import { Button } from "$lib/components/ui/button/";
    import * as Accordion from '$lib/components/ui/accordion'
    import Tooltip from '$lib/components/basic-tooltip.svelte'
    import type { ToolCall as OllamaToolCall } from "ollama";
    import AutoTextarea from "./auto-textarea.svelte"

    interface Props {
        chatMessage: ChatMessage
        editable?: boolean
        initEditMode?: boolean
        onMessageDelete?: () => void
        onMessageRegenerate?: (msgId: string) => void
        onToolResponse?: (r: string) => void
    }

    let { chatMessage, editable = true, initEditMode = false, onMessageDelete, onMessageRegenerate, onToolResponse }: Props = $props();

    let editMode = $state(initEditMode)
    let editedContent: string = $state(chatMessage.message.content)

    const toolCalls = $derived(chatMessage.message.toolCalls)

    const handleInput: FormEventHandler<HTMLDivElement> = debounce((e: Event) => {
        console.log('handleInput')
        const target = e.target as HTMLElement;
        console.log('target', target)
        const firstChild = target.childNodes[0]
        let textContent = ''
        if (firstChild.nodeName === 'PRE') {
            for (const node of firstChild.childNodes) {
                if (node.nodeName === 'BR') {
                    textContent += '\n'
                } else if (node.nodeType === Node.TEXT_NODE) {
                    textContent += node.textContent
                }
            }
        } else {
            textContent = target.textContent || ''
        }

        console.log('setting edited content', textContent)
        editedContent = textContent
    }, 100)

    async function updateMessage() {
        if (!editedContent || editedContent === chatMessage.message.content) {
            console.log('No update required.')
            return
        }

        console.log('Updating comment content...')
        await fetch(`/api/chat/${chatMessage.chatId}/message/${chatMessage.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: editedContent })
        })

        chatMessage.message.content = editedContent
    }

    async function deleteMessage() {
        if (chatMessage.id) {
            const resp = await fetch(`/api/chat/${chatMessage.chatId}/message/${chatMessage.id}`, {
                method: 'DELETE'
            })
            if (!resp.ok) {
                console.error('Failed to delete message:', await resp.text())
            }
        }
        onMessageDelete?.()
    }

    function cancelEdit() {
        editMode = false
    }

    let saving = $state(false)
    async function saveEdit() {
        saving = true
        await updateMessage()
        saving = false

        editMode = false
    }

    function splitReasoning() {
        const message = chatMessage.message
        if (!message.content.startsWith('<think>')) {
            return [null, message.content]
        }

        const endIdx = message.content.indexOf('</think>')
        if (endIdx === -1) {
            return [message.content.slice('<think>'.length), null]
        } else {
            return [
                message.content.slice('<think>'.length, endIdx),
                message.content.slice(endIdx + '</think>'.length)
            ]
        }
    }

    function formatToolCall(toolCall: OllamaToolCall) {
        const args = toolCall.function.arguments
        return `${toolCall.function.name}(${Object.entries(args).map(([k, v]) => `${k}='${v}'`).join(', ')})`
    }

    async function submitToolResponse(e: SubmitEvent) {
        e.preventDefault()
        if (chatMessage.message.content) {
            // We are updating an older tool response, so here we can simply update the message contents
            await saveEdit()
        } else {
            chatMessage.message.content = editedContent
            onToolResponse?.(editedContent)
        }
        editMode = false
    }
</script>

{#if chatMessage.message.role === 'user'}
    <div class="group flex gap-2 justify-end items-center">
        {#if editable && !editMode}
            <div class="flex gap-1 py-2 text-muted-foreground invisible group-hover:visible">
                <Tooltip tooltip="Edit">
                    <Button variant="ghost" size="icon" class="rounded h-6 w-6 p-3" onclick={() => editMode = true}>
                        <Pencil />
                    </Button>
                </Tooltip>
                <Tooltip tooltip="Delete">
                    <Button variant="ghost" size="icon" class="rounded h-6 w-6 p-3" onclick={deleteMessage}>
                        <Trash2 />
                    </Button>
                </Tooltip>
            </div>
        {/if}
        <div class={cn("p-4 rounded-xl self-end bg-gray-100 flex flex-col gap-1", editMode ? "w-full" : "max-w-lg")}>
            {#if editMode}
                <!-- <div contenteditable={editMode} class="outline-none">{chatMessage.message.content}</div> -->
                <AutoTextarea 
                    placeholder="Tool response..."
                    class="bg-muted resize-none p-2 px-4 rounded-lg w-full outline-none"
                    rows={3} minRows={3}
                    bind:value={editedContent} />
                <div class="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onclick={cancelEdit}>Cancel</Button>
                    <Button size="sm" onclick={saveEdit} disabled={saving}>
                        {#if saving}
                            <span>Saving...</span>
                        {:else}
                            Save
                        {/if}
                    </Button>
                </div>
            {:else}
                <SvelteMarkdown source={chatMessage.message.content} />
            {/if}
        </div>
    </div>
{:else if chatMessage.message.role === 'assistant'}
    <div class="flex gap-4 items-start">
        <div class="rounded-full bg-muted p-2">
            <Bot class="w-6 h-6 text-muted-foreground" />
        </div>
        <div class="flex-1 flex flex-col items-start group py-1.5">
            <div class="self-start prose">
                {#if editMode}
                    <div contenteditable="true" oninput={handleInput}>
                        <pre class="whitespace-pre-wrap my-0">{chatMessage.message.content}</pre>
                    </div>
                    <div class="flex gap-2 justify-end mt-1">
                        <Button variant="ghost" size="sm" onclick={cancelEdit}>Cancel</Button>
                        <Button size="sm" onclick={saveEdit} disabled={saving}>
                            {#if saving}
                                <span>Saving...</span>
                            {:else}
                                Save
                            {/if}
                        </Button>
                    </div>
                {:else}
                    {@const [reasoning, answer] = splitReasoning()}
                    {#if reasoning}
                        <div class="text-muted-foreground text-xs border-l-4 pl-2">
                            <Accordion.Root type="single">
                                <Accordion.Item value="reasoning" class="border-none">
                                    <Accordion.Trigger class="hover:no-underline border-b-none text-base justify-start gap-2 py-0">
                                        {#if answer !== null}
                                            Reasoning
                                        {:else}
                                            Thinking...
                                        {/if}
                                    </Accordion.Trigger>
                                    <Accordion.Content>
                                        <SvelteMarkdown source={reasoning} />
                                    </Accordion.Content>
                                </Accordion.Item>
                            </Accordion.Root>
                        </div>
                    {/if}
                    {#if answer}
                        <SvelteMarkdown source={answer} />
                    {/if}
                    {#if toolCalls}
                        <div class="flex flex-col gap-2">
                            {#each toolCalls as toolCall}
                                <div class="bg-muted py-2 rounded-lg flex flex-col gap-1">
                                    <div class ="px-4 text-muted-foreground font-bold text-xs uppercase">Tool call</div>
                                    <div class="px-4 font-mono">{formatToolCall(toolCall)}</div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                {/if}
            </div>
            {#if editable}
                <div class="flex gap-1 py-2 text-muted-foreground invisible group-hover:visible">
                    <Tooltip tooltip="Edit">
                        <Button variant="ghost" size="icon" class="rounded h-6 w-6 p-3" onclick={() => editMode = true}>
                            <Pencil />
                        </Button>
                    </Tooltip>
                    <Tooltip tooltip="Delete">
                        <Button variant="ghost" size="icon" class="rounded h-6 w-6 p-3" onclick={deleteMessage}>
                            <Trash2 />
                        </Button>
                    </Tooltip>
                    <Tooltip tooltip="Regenerate">
                        <Button variant="ghost" size="icon" class="rounded h-6 w-6 p-3" onclick={() => onMessageRegenerate?.(chatMessage.id!)}>
                            <RefreshCcw />
                        </Button>
                    </Tooltip>
                </div>
            {/if}
        </div>
    </div>
{:else}
    <!-- Tool response -->
    <div class="flex gap-4 items-start">
        <div class="rounded-full bg-muted p-2">
            <Wrench class="w-6 h-6 text-muted-foreground" />
        </div>
        <div class="flex-1 flex flex-col items-start group py-0">
            <div class={cn("self-start prose", editMode && "w-full")}>
                {#if editMode}
                    <form onsubmit={submitToolResponse}>
                        <AutoTextarea 
                            placeholder="Tool response..."
                            class="bg-muted resize-none p-2 px-4 rounded-lg w-full"
                            rows={2} minRows={2}
                            bind:value={editedContent} />
                        <div class="flex gap-2 justify-end py-2">
                            <Button variant="ghost" size="sm" onclick={cancelEdit}>Cancel</Button>
                            <Button type="submit" size="sm" disabled={saving}>
                                {#if saving}
                                    <span>Saving...</span>
                                {:else}
                                    Save
                                {/if}
                            </Button>
                        </div>
                    </form>
                {:else}
                    <SvelteMarkdown source={`\`\`\`\n${chatMessage.message.content || 'No output'}\n\`\`\``} />
                {/if}
            </div>
            {#if editable && !editMode}
                <div class="flex gap-1 py-2 text-muted-foreground invisible group-hover:visible">
                    <Tooltip tooltip="Edit">
                        <Button variant="ghost" size="icon" class="rounded h-6 w-6 p-3" onclick={() => editMode = true}>
                            <Pencil />
                        </Button>
                    </Tooltip>
                    <Tooltip tooltip="Delete">
                        <Button variant="ghost" size="icon" class="rounded h-6 w-6 p-3" onclick={deleteMessage}>
                            <Trash2 />
                        </Button>
                    </Tooltip>
                </div>
            {/if}
        </div>
    </div>
{/if}