<script lang="ts">
    import type { PageProps } from './$types'
	import MessageInput from "$lib/components/message-input.svelte";
	import { onMount } from 'svelte';
	import Message from '$lib/components/message.svelte';
	import { goto } from '$app/navigation';
    import { page } from '$app/state'
    import { localStore, type AppState } from '$lib/index.svelte';
	import type { StreamMessage } from '$lib';
	import type { ChatMessage } from '$lib/server/db';

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
    let streamingResponse = $state(false)

    let controller: AbortController | undefined = $state()
    let responseReader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>> | undefined = $state()

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
                        id: 0,
                        chatId: data.chat.id,
                        role: 'assistant',
                        content: response,
                        createdAt: Date.now()
                    }
                ]
            }
        }
    }

    async function onSubmit() {
        awaitingResponse = true
        const model = appState.value.model
        const req = { message: chatMsg, model }
        chatMsg = ''
        addMessage({
            chatId: data.chat.id,
            role: 'user',
            content: req.message,
            createdAt: Date.now()
        })
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


        if (resp.ok) {
            responseReader = resp.body?.getReader()
            const decoder = new TextDecoder()
            if (!responseReader) {
                console.error('Failed to get response body reader')
                awaitingResponse = false
                return
            }

            let response = ''
            let partialChunk = ''
            while (true) {
                const { done, value } = await responseReader.read()
                if (done) {
                    streamingResponse = false
                    break
                }
                if (awaitingResponse) {
                    awaitingResponse = false
                    streamingResponse = true
                }

                const chunk = decoder.decode(value)
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
                            updateLastMessageId(sm.content as number)
                            break
                        case 'response':
                            response += sm.content as string
                            break
                        case 'chat_title':
                            console.log('Chat title:', sm.content)
                            break
                        default:
                            console.error('Unexpected stream message type:', sm.type)
                    }
                }

                updateAsstResponse(response)
                scrollToBottom()
            }
        } else {
            console.error('Failed while receiving response', resp)
            awaitingResponse = false
        }
    }

    let { data }: PageProps = $props()

    let scrollAnchor: HTMLDivElement | undefined = $state()

    function onMessageDelete() {
        goto(`/chat/${data.chatId}`, { invalidateAll: true })
    }

    const scrollToBottom = () => setTimeout(() => scrollAnchor?.scrollIntoView({ behavior: 'smooth' }), 0)

    function onStreamingStop() {
        controller?.abort()
        responseReader?.cancel()

        awaitingResponse = false
        streamingResponse = false
    }
</script>

<div class="flex-1 min-h-0 flex flex-col items-center">
    <div class="flex-1 flex flex-col items-center py-8 w-full overflow-y-auto">
        <div class="max-w-screen-md flex flex-col gap-8 pb-20 w-full">
            {#each data.messages as message}
                <Message {message} {onMessageDelete} editable={!data.chat.frozen} />
            {/each}
            {#if awaitingResponse}
                <Message 
                    message={{ chatId: data.chatId, role: 'assistant', content: 'Waiting...', createdAt: Date.now() }} 
                    editable={false} />
            {/if}
            <div bind:this={scrollAnchor}></div>
        </div>
    </div>
    <MessageInput bind:chatMsg bind:chatMsgInput 
        {onSubmit} 
        disabled={data.chat.frozen} 
        showStopButton={streamingResponse} 
        onStop={onStreamingStop}
    />
</div>