<script lang="ts">
    import { cn } from '$lib/utils'
    import Button from '$lib/components/ui/button/button.svelte'
	import CircularLoader from './circular-loader.svelte';
    import AutoTextarea from './auto-textarea.svelte'

    export let chatMsgInput: HTMLTextAreaElement | null = null;
    export let chatMsg: string;
    export let onSubmit: () => void;
    export let disabled = false;
    export let receivingResponse = false // True when reading a streaming response from the model
    export let onStop: () => void = () => {}
    export let error: string | null = null

    // Callback when a response is received from the LLM
    export const onResponse = () => {};

    let inputEl: AutoTextarea | null = null;

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        onSubmit();
        setTimeout(() => inputEl?.autoResize(), 0);
    }

    async function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
            setTimeout(() => inputEl?.autoResize(), 0);
        }
    }
</script>

<div class="flex flex-col gap-1 items-end mb-8 mt-0 w-full max-w-screen-md">
    <form class={cn("flex items-end rounded-2xl bg-gray-100 w-full max-w-screen-md", error && "border border-red-500")} onsubmit={handleSubmit}>
        <AutoTextarea
            class={cn("w-full p-4 rounded-2xl focus-visible:ring-0 focus:outline-none resize-none bg-gray-100 text-sm lg:text-base", disabled && "cursor-not-allowed")}
            placeholder={!disabled ? 'Type user message here...' : 'This chat is marked golden and cannot be modified.'}
            {disabled}
            onkeydown={handleKeyDown}
            bind:value={chatMsg}
            bind:this={inputEl}
            bind:el={chatMsgInput} />
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
    {#if error}
        <p class="text-xs text-red-500">{error}</p>
    {/if}
</div>
