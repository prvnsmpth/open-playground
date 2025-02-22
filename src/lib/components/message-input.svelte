<script lang="ts">
    import { SendHorizontal as SendIcon, SquareArrowUp } from 'lucide-svelte';
    import { onMount } from 'svelte';
    import type { FormEventHandler } from 'svelte/elements';
    import { cn } from '$lib/utils'
    import Button from '$lib/components/ui/button/button.svelte'
	import CircularLoader from './circular-loader.svelte';

    export let chatMsgInput: HTMLTextAreaElement | undefined
    export let chatMsg: string;
    export let onSubmit: () => void;
    export let disabled = false;
    export let receivingResponse = false // True when reading a streaming response from the model
    export let onStop: () => void = () => {}

    // Callback when a response is received from the LLM
    export const onResponse = () => {
    };
    let lineHeight: number;

    onMount(() => {
        lineHeight = parseInt(getComputedStyle(chatMsgInput!).lineHeight);
        autoResize();
    });

    function autoResize() {
        if (!lineHeight) {
            return;
        }
        chatMsgInput!.style.height = 'auto';
        const maxHeight = lineHeight * 7; // Max 7 rows of text
        chatMsgInput!.style.height = Math.min(chatMsgInput!.scrollHeight, maxHeight) + 'px';
    }

    const handleInput: FormEventHandler<HTMLTextAreaElement> = (e) => {
        autoResize();
    };

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        onSubmit();
        setTimeout(autoResize, 0);
    }

    async function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
            setTimeout(autoResize, 0);
        }
    }
</script>

<form class="flex rounded-2xl mb-8 mt-0 items-end bg-gray-100 w-full max-w-screen-md" onsubmit={handleSubmit}>
    <textarea
        name="message"
        rows={3}
        class={cn("flex-1 p-4 rounded-2xl focus-visible:ring-0 focus:outline-none resize-none bg-gray-100 text-sm lg:text-base", disabled && "cursor-not-allowed")}
        placeholder={!disabled ? 'Type your message here...' : 'This chat is frozen'}
        {disabled}
        onkeydown={handleKeyDown}
        bind:this={chatMsgInput}
        bind:value={chatMsg}
        oninput={handleInput}
        onpaste={autoResize}
        oncut={autoResize}></textarea>
    {#if receivingResponse}
        <Button
            type="button"
            size="sm"
            onclick={onStop}
            class="text-sm m-2 rounded-xl bg-primary/60"
        >
            <CircularLoader />
            Stop
        </Button>
    {:else}
        <Button
            type="submit"
            size="sm"
            class="text-sm m-2 rounded-xl"
            {disabled}
        >
            Run
        </Button>
    {/if}
</form>
