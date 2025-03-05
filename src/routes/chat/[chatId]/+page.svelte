<script lang="ts">
    import type { PageProps } from './$types'
	import MessageInput from "$lib/components/message-input.svelte";
	import { onMount } from 'svelte';
	import Message from '$lib/components/message.svelte';
	import { afterNavigate, goto } from '$app/navigation';
    import { page } from '$app/state'
    import { presetStore } from '$lib/client/index.svelte';
    import { chatList } from '../index.svelte'
	import type { GenerationConfig, OutputFormat, SendMessageRequest, StreamMessage, Tool } from '$lib';
	import type { ChatMessage, Usage } from '$lib';
    import * as Accordion from '$lib/components/ui/accordion'
    import AutoTextarea from '$lib/components/auto-textarea.svelte';
	import { debounce } from '$lib/utils';
    import { type Tool as OllamaTool, type ToolCall as OllamaToolCall } from 'ollama';
    import { toast } from 'svelte-sonner';

    let chatMsg = $state('') 
    let chatMsgInput: HTMLTextAreaElement | undefined = $state()

    onMount(() => {
        chatMsg = ''
        chatMsgInput?.focus()

        const pageState = page.state as any
        if (data.messages.length === 0 && pageState.message) {
            chatMsg = pageState.message
            onMessageSubmit()
        }
    })

    const preset = $derived(presetStore.value.config)

    let awaitingResponse = $state(false)
    let awaitingRegeneration = $state(false)
    let awaitingToolResponse = $state(false)
    let streamingResponse = $state(false)

    let controller: AbortController | undefined = $state()

    let usage = $state<Usage | null>(null)

    afterNavigate(() => {
        usage = null
    })

    function addMessage(message: ChatMessage) {
        data = {
            ...data,
            messages: [
                ...data.messages,
                message
            ]
        }
    }

    function updateLastMessageId(id: string) {
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

    function updateAsstResponse(response: string, asstMsgId?: string, toolCalls?: OllamaToolCall[]) {
        let targetMsg
        let targetMsgIdx
        if (asstMsgId) {
            targetMsgIdx = data.messages.findIndex(m => m.id === asstMsgId)
            targetMsg = data.messages[targetMsgIdx]
        } else {
            // We will update the last message, or if it's not an assistant message, we will add it
            targetMsg = data.messages[data.messages.length - 1]
            targetMsgIdx = data.messages.length - 1
        }

        if (targetMsg?.message.role === 'assistant') {
            data = {
                ...data,
                messages: [
                    ...data.messages.slice(0, targetMsgIdx),
                    {
                        ...targetMsg, 
                        message: {
                            ...targetMsg.message, 
                            content: response,
                            toolCalls
                        } 
                    },
                    ...data.messages.slice(targetMsgIdx + 1)
                ]
            }
        } else {
            data = {
                ...data,
                messages: [
                    ...data.messages,
                    {
                        chatId: data.chat.id!,
                        messageSeqNum: data.messages.length + 1,
                        message: {
                            role: 'assistant',
                            content: response,
                            toolCalls
                        }
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
                    chatId: data.chat.id!,
                    messageSeqNum: data.messages.length + 1,
                    message: {
                        role: 'tool',
                        content: toolResponse
                    }
                }
            ]
        }
    }

    async function sendMessage(
        role: 'user' | 'tool',
        content: string | null,
        model: string,
        genConfig: GenerationConfig,
        tools?: Tool[],
        outputFormat?: OutputFormat
    ) {
        const req: SendMessageRequest = {
            role,
            content,
            model,
            genConfig,
            tools,
            outputFormat
        }

        if (content) {
            addMessage({
                chatId: data.chat.id!,
                messageSeqNum: data.messages.length + 1,
                message: {
                    role,
                    content
                },
            })
            scrollToBottom()
        }

        controller = new AbortController()
        awaitingResponse = true
        const resp = await fetch(`/api/chat/${data.chat.id}/message`, {
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
            const err = await resp.json()
            throw new Error(err.message)
        }

        const responseReader = resp.body?.getReader()
        if (!responseReader) {
            console.error('Failed to get response body reader')
            awaitingResponse = false
            return
        }

        // The LLM's response
        let response = ''
        let toolCalls: OllamaToolCall[] | undefined
        const lastMsg = data.messages[data.messages.length - 1]
        if (lastMsg.message.role === 'assistant') {
            response = lastMsg.message.content
        }
        if (lastMsg.message.toolCalls) {
            toolCalls = lastMsg.message.toolCalls
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
                        updateLastMessageId(sm.content)
                        break
                    case 'asst_response':
                        console.log('received', sm)
                        response += sm.content.content as string
                        if (sm.content.tool_calls) {
                            if (!toolCalls) {
                                toolCalls = []
                            }
                            toolCalls.push(...sm.content.tool_calls)
                        }
                        break
                    case 'tool_exec_start':
                        awaitingToolResponse = true
                        break
                    case 'tool_response':
                        awaitingToolResponse = false
                        if (response.length > 0) {
                            // Save any response accumulated from the assistant, then reset it 
                            // We do this because as part of one call to the LLM, we can get a stream of assistant text responses,
                            // followed by tool calls/responses, followed by more text responses.
                            updateAsstResponse(response, undefined, toolCalls)
                            response = ''
                            toolCalls = []
                        }
                        addToolResponse(sm.content as string)
                        break
                    case 'usage':
                        usage = sm.content as Usage 
                        break
                    case 'chat_title':
                        chatList.value = chatList.value.map(c => {
                            if (c.id !== data.chat.id) {
                                return c
                            }
                            return {
                                ...c,
                                title: sm.content
                            }
                        })
                        break
                }
            }

            if (response.length > 0 || (toolCalls && toolCalls.length > 0)) {
                updateAsstResponse(response, undefined, toolCalls)
            }
            scrollToBottom()
        }
    }

    async function onMessageSubmit() {
        if (!preset.model) {
            console.error('No model selected')
            return
        }

        const message = chatMsg.trim()
        chatMsg = ''
        try {
            await sendMessage(
                'user',
                message.length > 0 ? message : null,
                preset.model,
                {
                    temperature: preset.temperature,
                    maxTokens: preset.maxTokens,
                    topP: preset.topP,
                },
                preset.tools,
                preset.outputFormat
            )
        } catch (err: any) {
            console.error('Error sending message', err)
            toast.error(err.message)
        }
    }

    let { data }: PageProps = $props()
    let chatContainer: HTMLDivElement | undefined = $state()

    function onMessageDelete() {
        goto(`/chat/${data.chat.id}`, { invalidateAll: true })
    }

    async function onMessageRegenerate(messageId: string) {
        if (!preset.model) {
            toast.error('Please select a model')
            return
        }

        awaitingRegeneration = true
        updateAsstResponse('Regenerating...', messageId, [])
        const resp = await fetch(`/api/chat/${data.chat.id}/message/${messageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                regenerate: true,
                model: preset.model,
                modelConfig: {
                    temperature: preset.temperature,
                    maxTokens: preset.maxTokens,
                    topP: preset.topP,
                },
                tools: preset.tools,
            })
        })

        if (!resp.ok) {
            console.error('Failed to regenerate message')
            return
        }

        const reader = resp.body?.getReader()
        if (!reader) {
            console.error('Failed to get reader')
            return
        } 

        let partialChunk = ''
        let responseTxt = ''
        let toolCalls: OllamaToolCall[] | undefined
        const decoder = new TextDecoder()
        while (true) {
            let chunk: string
            try {
                const { done, value } = await reader.read()
                if (done) {
                    streamingResponse = false
                    break
                }

                if (awaitingResponse) {
                    // On receiving the first chunk, we need to clear the existing content of the message
                    updateAsstResponse('', messageId)
                    awaitingRegeneration = false
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
            
            for (const message of streamMessages) {
                switch (message.type) {
                    case 'asst_response':
                        responseTxt += message.content.content
                        if (message.content.tool_calls) {
                            if (!toolCalls) {
                                toolCalls = []
                            }
                            toolCalls.push(...message.content.tool_calls)
                        }
                        break
                    case 'usage':
                        usage = message.content
                        break
                    default:
                        console.error('Unexpected message type', message)
                        break
                }
            }

            if (responseTxt.length > 0 || toolCalls) {
                updateAsstResponse(responseTxt, messageId, toolCalls)
            }
        }
    }

    async function onToolResponse(toolResponse: string) {
        if (!preset.model) {
            toast.error('Please select a model')
            return
        }

        const resp = toolResponse.trim()
        await sendMessage(
            'tool',
            resp.length > 0 ? resp : null,
            preset.model,
            {
                temperature: preset.temperature,
                maxTokens: preset.maxTokens,
                topP: preset.topP,
            },
            preset.tools,
            preset.outputFormat
        )
    }

    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' })
        })
    }

    async function onStreamingStop() {
        controller?.abort()

        awaitingResponse = false
        streamingResponse = false
    }

    const updateSystemPrompt = debounce(async () => {
        await fetch(`/api/chat/${data.chat.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ systemPrompt: data.chat.systemPrompt })
        })
    }, 500)
</script>

<div class="flex-1 min-h-0 flex flex-col items-center">
    <div class="flex-1 flex flex-col items-center py-8 w-full overflow-y-auto" bind:this={chatContainer}>
        <div class="flex mb-8 border prose w-full max-w-screen-md rounded-lg p-4">
            <Accordion.Root type="single" class="w-full" value={data.chat.systemPrompt ? 'systemPrompt' : undefined}>
                <Accordion.Item value="systemPrompt" class="border-none">
                    <Accordion.Trigger class="hover:no-underline border-b-none text-sm py-0 w-full font-bold">
                        System prompt
                    </Accordion.Trigger>
                    <Accordion.Content class="w-full pt-4">
                        <AutoTextarea 
                            bind:value={data.chat.systemPrompt} 
                            onInput={updateSystemPrompt}
                            class="w-full resize-none outline-none ring-0 bg-card" 
                            placeholder="You are a helpful AI agent..." />
                    </Accordion.Content>
                </Accordion.Item>
            </Accordion.Root>
        </div>
        <div class="max-w-screen-md flex flex-col gap-4 pb-20 w-full">
            {#each data.messages as message, idx}
                <Message 
                    chatMessage={message} 
                    {onMessageDelete} 
                    {onMessageRegenerate}
                    editable={!data.chat.golden} 
                />
            {/each}
            {#if awaitingResponse}
                <Message 
                    chatMessage={{ 
                        chatId: data.chat.id!, 
                        messageSeqNum: data.messages.length + 1,
                        message: { role: 'assistant', content: 'Waiting...', }, 
                        createdAt: Date.now() 
                    }} 
                    editable={false} />
            {/if}

            <!-- 
                If the last message is a tool call, show a message block allowing the 
                user to provide the tool response.
            -->
            {#if data.messages.length > 0}
                {@const lastMessage = data.messages[data.messages.length - 1]?.message}
                {#if lastMessage?.role === 'assistant' && (lastMessage?.toolCalls?.length || 0) > 0}
                    <Message 
                        chatMessage={{ 
                            chatId: data.chat.id!, 
                            messageSeqNum: data.messages.length + 1,
                            message: { role: 'tool', content: '', }, 
                            createdAt: Date.now() 
                        }} 
                        {onToolResponse}
                        editable={true} 
                        initEditMode={true}
                    />
                {/if}
            {/if}

            <!-- For built-in tools, currently only code interpreter -->
            {#if awaitingToolResponse}
               <Message
                    chatMessage={{ 
                        chatId: data.chat.id!, 
                        messageSeqNum: data.messages.length + 1,
                        message: {
                            role: 'assistant', 
                            content: 'Executing code...', 
                        },
                        createdAt: Date.now() 
                    }}
                    editable={false} />
            {/if}
        </div>
    </div>
    <div class="flex flex-col gap-1 self-stretch relative">
        {#if usage}
            <div class="absolute -top-8 self-center flex gap-2 items-center border border-muted p-1 px-2 bg-background shadown-lg rounded-md">
                <span class="text-xs text-muted-foreground font-semibold">Tokens</span>
                <span class="text-xs text-muted-foreground">{usage.promptTokens} prompt</span>
                <span class="text-xs">&middot;</span>
                <span class="text-xs text-muted-foreground">{usage.completionTokens} completion</span>
            </div>
        {/if}
        <div class="flex justify-center">
            <MessageInput bind:chatMsg bind:chatMsgInput 
                onSubmit={onMessageSubmit} 
                disabled={data.chat.golden} 
                receivingResponse={streamingResponse} 
                onStop={onStreamingStop}
            />
        </div>
    </div>
</div>