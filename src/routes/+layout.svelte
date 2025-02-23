<script lang="ts">
	import '../app.css';
	import ChatComponent from '$lib/components/chat.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Select from '$lib/components/ui/select';
	import { SquarePen } from 'lucide-svelte';
    import { appState } from '$lib/index.svelte'
	import Tooltip from '$lib/components/basic-tooltip.svelte'
	import { onMount } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog'
	import { Input } from '$lib/components/ui/input'
	import { invalidateAll } from '$app/navigation';

	let { data, children } = $props();

	onMount(() => {
		if (!appState.value?.model && data.models.length > 0) {
			console.log('Updating app state with model:', data.models[0])
			appState.value = {
				...appState.value,
				model: data.models[0]
			}
		}
	})

	let dropdownOpen = $state(false)

	function handleModelChange(value: string) {
        appState.value = {
			...appState.value,
			model: value
		}
		dropdownOpen = false
	}

	let newChatTitle = $state('')
	let renameChatDialogOpen = $state(false)
	let renameChatId = $state<string | null>(null)
	function onRenameChat(chatId: string) {
		renameChatId = chatId
		renameChatDialogOpen = true
	}

	async function renameChat() {
		if (!newChatTitle || !renameChatId) {
			return
		}

		const resp = await fetch(`/api/chat/${renameChatId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: newChatTitle
			})
		})

		if (!resp.ok) {
			console.error('Failed to rename chat', await resp.text())
			return
		}

		renameChatDialogOpen = false
		renameChatId = null
		newChatTitle = ''
		invalidateAll()
	}
</script>

<main class="grid h-screen grid-cols-1 md:grid-cols-[280px_1fr]">
	<div class="flex flex-col h-full border-r border-muted bg-muted overflow-y-auto">
		<div class="flex w-full justify-end items-center p-2 h-14 border-b">
			<Tooltip tooltip="New Chat">
				<Button variant="ghost" size="sm" href="/" class="hover:bg-gray-200">
					<SquarePen />
				</Button>
			</Tooltip>
		</div>
		<div class="flex-1 min-h-0 overflow-y-auto pb-10">
			{#each data.chats as chat}
				<ChatComponent {chat} {onRenameChat} />
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
					{appState.value?.model ?? "Select a model"}
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

<Dialog.Root bind:open={renameChatDialogOpen}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Rename chat</Dialog.Title>
		</Dialog.Header>
		<Input type="text" 
			bind:value={newChatTitle} 
			placeholder="Enter new chat title..." />
		<Dialog.Footer>
			<Button variant="outline" onclick={() => renameChatDialogOpen = false}>Cancel</Button>
			<Button type="submit" form="rename-chat-form" onclick={renameChat}>Rename</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
