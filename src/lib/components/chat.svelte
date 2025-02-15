<script lang="ts">
    import { goto } from '$app/navigation';
    import Button from '$lib/components/ui/button/button.svelte';
    import { page } from '$app/state';
    import { cn } from '$lib/utils';
    import { Trash2, EllipsisVertical, Snowflake, Copy } from 'lucide-svelte';
    import * as Popover from '$lib/components/ui/popover'
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import type { Chat } from '$lib/server/db';
	import { GoogleGenerativeAI } from '@google/generative-ai';

    type Props = {
        chat: Chat
    }

    let { chat }: Props = $props()

	async function deleteChat() {
		const resp = await fetch(`/api/chat/${chat.id}`, {
			method: 'DELETE'
		})
		if (resp.ok) {
			goto('/', { invalidateAll: true })
		}
        dropdownOpen = false
	}

	async function freezeChat() {
		const resp = await fetch(`/api/chat/${chat.id}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ frozen: true })
		})

        if (resp.ok) {
            goto(window.location.pathname, { invalidateAll: true })
        }

		dropdownOpen = false
	}

    async function cloneChat() {

        dropdownOpen = false
    }

    let dropdownOpen = $state(false)
</script>

<div class={cn("group flex items-center m-2 hover:bg-gray-200/70 rounded-lg", parseInt(page.params.chatId) === chat.id && 'bg-gray-200')}>
    <a href={`/chat/${chat.id}`} class="flex-1 py-3 pl-3 flex gap-1 items-center">
        <div class="text-sm">{chat.title ?? "Untitled chat"}</div>	
        {#if chat.frozen}
            <Snowflake class="w-3 h-3 text-blue-500" />
        {/if}
        <!-- <div class="text-xs">{formatTime(chat.createdAt, "MMMM dd, yyyy HH:mm:ss")}</div> -->
    </a>
    <DropdownMenu.Root bind:open={dropdownOpen}>
        <DropdownMenu.Trigger class="invisible group-hover:visible">
            <Button size="icon" variant="link">
                <EllipsisVertical />
            </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" class="w-fit p-1 flex flex-col gap-1">
            <DropdownMenu.Item onclick={freezeChat}>
                <Snowflake />
                Freeze
            </DropdownMenu.Item>
            <DropdownMenu.Item>
                <Copy />
                Clone
            </DropdownMenu.Item>
            <DropdownMenu.Item class="text-red-500" onclick={deleteChat}>
                <Trash2 />
                Delete
            </DropdownMenu.Item>
        </DropdownMenu.Content>
    </DropdownMenu.Root>
</div>