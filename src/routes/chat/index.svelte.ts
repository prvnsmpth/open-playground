import type { Chat } from '$lib'

export const chatList = $state({
    value: [] as Chat[]
})