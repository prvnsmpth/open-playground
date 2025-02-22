<script lang="ts">
	import '../app.css';
	import ChatComponent from '$lib/components/chat.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Select from '$lib/components/ui/select';
	import { SquarePen } from 'lucide-svelte';
    import { localStore, type AppState } from '$lib/index.svelte'

	let { data, children } = $props();

	const appState = localStore('state', {} as AppState)

	let dropdownOpen = $state(false)
	const triggerContent = $derived(
		data.models.find(m => m === appState.value.model) ?? "Select a model"
	)

	function handleModelChange(value: string) {
        appState.value.model = value
		dropdownOpen = false
	}

</script>

<main class="grid h-screen grid-cols-1 md:grid-cols-[280px_1fr]">
	<div class="flex flex-col h-full border-r border-muted bg-muted overflow-y-auto">
		<div class="flex w-full justify-start items-center p-2 h-14 border-b">
			<Button variant="ghost" size="sm" href="/" class="hover:bg-gray-200">
				<SquarePen />
				New chat
			</Button>
		</div>
		<div class="flex-1 min-h-0 overflow-y-auto pb-10">
			{#each data.chats as chat}
				<ChatComponent {chat} />
			{:else}
				<p class="text-muted-foreground text-xs uppercase text-center font-bold mt-4">
					No chats found
				</p>
			{/each}
		</div>
	</div>
	<div class="flex h-screen flex-col">
		<div class="border-b h-14 flex items-center px-2">
			<Select.Root type="single" name="model" bind:open={dropdownOpen} onValueChange={handleModelChange}>
				<Select.Trigger class="w-fit border-none hover:bg-gray-100 flex gap-2">
					{triggerContent}
				</Select.Trigger>
				<Select.Content align="start">
					{#each data.models as model}
						<Select.Item value={model} label={model}>{model}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<div class="flex-1"></div>
			<div class="block md:hidden">
				<Button variant="ghost" size="sm" href="/" class="hover:bg-gray-200">
					<SquarePen />
				</Button>
			</div>
		</div>
		{@render children()}
	</div>
</main>

