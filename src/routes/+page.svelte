<script lang="ts">
	import { goto } from '$app/navigation';
    import MessageInput from '$lib/components/message-input.svelte'

    let chatMsg = $state('')
    let chatMsgInput: HTMLTextAreaElement | undefined = $state()

    async function onSubmit() {
        const resp = await fetch('/api/chat', { method: 'POST' })
        const { chatId } = await resp.json()
        goto(`/chat/${chatId}`, { invalidateAll: true, state: { message: chatMsg } })
    }
</script>

<div class="flex-1 min-h-0 flex flex-col gap-4 items-center justify-center px-8">
    <div class="prose">
        <h2>Start a new thread</h2>
    </div>
    <MessageInput bind:chatMsg bind:chatMsgInput {onSubmit} />
</div>
