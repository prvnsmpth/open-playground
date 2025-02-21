<script lang="ts">
    import type { PageProps } from './$types'
	import MessageInput from "$lib/components/message-input.svelte";
	import { onMount } from 'svelte';
	import Message from '$lib/components/message.svelte';
	import { goto, invalidateAll } from '$app/navigation';
    import { page } from '$app/state'
    import { localStore, type AppState } from '$lib/index.svelte';
	import type { StreamMessage } from '$lib';
	import type { ChatMessage, Usage } from '$lib/server/db';

    let chatMsg = $state('') 
    let chatMsgInput: HTMLTextAreaElement | undefined = $state()

    const appState = localStore('state', {} as AppState)

    onMount(() => {
        chatMsg = ''
        chatMsgInput?.focus()

        const pageState = page.state as any
        if (data.messages.length === 0 && pageState.message) {
            console.log('Starting new chat, sending first message...')
            chatMsg = pageState.message
            onSubmit()
        }
    })

    let awaitingResponse = $state(false)
    let awaitingToolResponse = $state(false)
    let streamingResponse = $state(false)

    let controller: AbortController | undefined = $state()

    let usage = $state<Usage | null>(null)

    function addMessage(message: ChatMessage) {
        data = {
            ...data,
            messages: [
                ...data.messages,
                message
            ]
        }
    }

    function updateLastMessageId(id: number) {
        const m = data.messages
        const n = data.messages.length
        data = {
            ...data,
            messages: [
                ...m.slice(0, n - 1),
                { ...m[n - 1], id }
            ]
        }
    }

    function updateAsstResponse(response: string) {
        const lastMsg = data.messages[data.messages.length - 1]
        if (lastMsg?.role === 'assistant') {
            data = {
                ...data,
                messages: [
                    ...data.messages.slice(0, data.messages.length - 1),
                    { ...lastMsg, content: response }
                ]
            }
        } else {
            data = {
                ...data,
                messages: [
                    ...data.messages,
                    {
                        chatId: data.chat.id,
                        role: 'assistant',
                        content: response,
                    }
                ]
            }
        }
    }

    function addToolResponse(toolResponse: string) {
        data = {
            ...data,
            messages: [
                ...data.messages,
                {
                    chatId: data.chat.id,
                    role: 'tool',
                    content: toolResponse,
                }
            ]
        }
    }

    async function onSubmit() {
        awaitingResponse = true
        const model = appState.value.model
        
        chatMsg = chatMsg.trim()
        const req = { message: chatMsg.length > 0 ? chatMsg : undefined, model }
        chatMsg = ''
        if (req.message) {
            addMessage({
                chatId: data.chat.id,
                role: 'user',
                content: req.message,
                createdAt: Date.now()
            })
        }
        scrollToBottom()

        controller = new AbortController()
        const resp = await fetch(`/api/chat/${data.chatId}/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req),
            signal: controller.signal
        })

        if (!resp.ok) {
            console.error('Failed while receiving response:', resp)
            awaitingResponse = false
            return
        }

        const responseReader = resp.body?.getReader()
        if (!responseReader) {
            console.error('Failed to get response body reader')
            awaitingResponse = false
            return
        }

        let response = ''
        const lastMsg = data.messages[data.messages.length - 1]
        if (lastMsg.role === 'assistant') {
            response = lastMsg.content
        }

        let partialChunk = ''
        const decoder = new TextDecoder()
        while (true) {
            let chunk: string
            try {
                const { done, value } = await responseReader.read()
                if (done) {
                    streamingResponse = false
                    break
                }
                if (awaitingResponse) {
                    awaitingResponse = false
                    streamingResponse = true
                }

                chunk = decoder.decode(value)
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    console.log('Stream cancelled')
                }
                break
            }

            const streamMessages: StreamMessage[] = (partialChunk + chunk).split('\n')
                .map(line => {
                    try {
                        return JSON.parse(line)
                    } catch (err) {
                        partialChunk = line
                        return null
                    }
                })
                .filter(m => m !== null)
            
            for (const sm of streamMessages) {
                switch (sm.type) {
                    case 'user_msg_id':
                    case 'asst_msg_id':
                    case 'tool_msg_id':
                        updateLastMessageId(sm.content as number)
                        break
                    case 'asst_response':
                        response += sm.content as string
                        break
                    case 'tool_exec_start':
                        awaitingToolResponse = true
                        break
                    case 'tool':
                        awaitingToolResponse = false
                        if (response.length > 0) {
                            // Save any response accumulated from the assistant, then reset it 
                            updateAsstResponse(response)
                            response = ''
                        }
                        addToolResponse(sm.content as string)
                        break
                    case 'usage':
                        usage = sm.content as Usage 
                        break
                    case 'chat_title':
                        console.log('Chat title:', sm.content)
                        invalidateAll()
                        break
                    default:
                        console.error('Unexpected stream message type:', sm.type)
                }
            }

            if (response.length > 0) {
                updateAsstResponse(response)
            }
            scrollToBottom()
        }
    }

    let { data }: PageProps = $props()

    let scrollAnchor: HTMLDivElement | undefined = $state()

    function onMessageDelete() {
        goto(`/chat/${data.chatId}`, { invalidateAll: true })
    }

    const scrollToBottom = () => setTimeout(() => scrollAnchor?.scrollIntoView({ behavior: 'smooth' }), 0)

    async function onStreamingStop() {
        controller?.abort()

        awaitingResponse = false
        streamingResponse = false
    }
</script>

<div class="flex-1 min-h-0 flex flex-col items-center px-8">
    <div class="flex-1 flex flex-col items-center py-8 w-full overflow-y-auto">
        <div class="max-w-screen-md flex flex-col gap-2 pb-20 w-full">
            {#each data.messages as message, idx}
                <Message 
                    {message} 
                    {onMessageDelete} 
                    editable={!data.chat.frozen} 
                />
            {/each}
            {#if awaitingResponse}
                <Message 
                    message={{ chatId: data.chatId, role: 'assistant', content: 'Waiting...', createdAt: Date.now() }} 
                    editable={false} />
            {/if}
            {#if awaitingToolResponse}
               <Message
                    message={{ chatId: data.chatId, role: 'assistant', content: 'Executing code...', createdAt: Date.now() }}
                    editable={false} />
            {/if}
            <div bind:this={scrollAnchor}></div>
        </div>
    </div>
    <div class="flex flex-col gap-1 self-stretch relative">
        {#if usage}
            <div class="absolute -top-8 self-center flex gap-2 items-center border border-muted p-1 px-2 bg-background shadown-lg rounded-md">
                <span class="text-xs text-muted-foreground font-semibold">Usage</span>
                <span class="text-xs text-muted-foreground">{usage.promptTokens} prompt</span>
                <span class="text-xs">&middot;</span>
                <span class="text-xs text-muted-foreground">{usage.completionTokens} completion</span>
            </div>
        {/if}
        <div class="flex justify-center">
            <MessageInput bind:chatMsg bind:chatMsgInput 
                {onSubmit} 
                disabled={data.chat.frozen} 
                receivingResponse={streamingResponse} 
                onStop={onStreamingStop}
            />
        </div>
    </div>
</div>