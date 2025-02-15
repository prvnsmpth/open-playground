<script lang="ts">
	import { SendHorizontal as SendIcon, Square } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import type { FormEventHandler } from 'svelte/elements';
	import { cn } from '$lib/utils'

	export let chatMsgInput: HTMLTextAreaElement | undefined
	export let chatMsg: string;
	export let onSubmit: () => void;
	export let disabled = false;
	export let showStopButton = false
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

<form class="flex rounded-2xl mb-8 mt-0 items-center bg-gray-100 w-full max-w-screen-md" onsubmit={handleSubmit}>
	<textarea
		name="message"
		rows={1}
		class={cn("flex-1 p-4 rounded-2xl focus-visible:ring-0 focus:outline-none resize-none bg-gray-100 text-sm lg:text-base", disabled && "cursor-not-allowed")}
		placeholder={!disabled ? 'Type your message here...' : 'This chat is frozen'}
		{disabled}
		onkeydown={handleKeyDown}
		bind:this={chatMsgInput}
		bind:value={chatMsg}
		oninput={handleInput}
		onpaste={autoResize}
		oncut={autoResize}></textarea>
	{#if showStopButton}
		<button class="disabled:text-primary/40 text-primary font-bold p-2 h-full" onclick={onStop}>
			<Square class="w-8 h-8 bg-primary text-primary-foreground rounded-full p-1.5" />
		</button>
	{/if}
	<button
		type="submit"
		disabled={disabled || (chatMsg?.length || 0) === 0}
		class="disabled:text-primary/40 text-primary font-bold p-4 h-full"
	>
		<SendIcon class="w-5 h-5" />
	</button>
</form>
