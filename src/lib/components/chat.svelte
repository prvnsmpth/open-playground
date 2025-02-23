<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import Button from '$lib/components/ui/button/button.svelte';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import type { Chat } from '$lib/server/db';
    import { cn } from '$lib/utils';
    import { Copy, EllipsisVertical, Snowflake, Trash2 } from 'lucide-svelte';

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

    async function cloneChat(chatId: string) {
        const resp = await fetch(`/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                clone: true, 
                chatId 
            })
        })
        if (!resp.ok) {
            console.error('Failed to clone chat:', await resp.text())
            return
        }

        const { chatId: newChatId } = await resp.json()
        goto(`/chat/${newChatId}`, { invalidateAll: true })
        dropdownOpen = false
    }

    let dropdownOpen = $state(false)
</script>

<div class={cn("group flex items-center m-2 hover:bg-gray-200/70 rounded-lg transition-colors", page.params.chatId === chat.id && 'bg-gray-200')}>
    <a href={`/chat/${chat.id}`} class="flex-1 py-3 pl-3 flex gap-2 items-center overflow-hidden whitespace-nowrap text-ellipsis">
        <div class={cn("text-sm", chat.frozen ? "text-blue-500" : "text-foreground")}>{chat.title ?? "Untitled chat"}</div>	
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
            <DropdownMenu.Item onclick={() => cloneChat(chat.id!)}>
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