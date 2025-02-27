<script lang="ts">
    import * as Select from '$lib/components/ui/select'
    import { NotebookText } from 'lucide-svelte'
    import { selectedProject } from '$lib/client/index.svelte';
    import { toast } from 'svelte-sonner'
    import type { Chat, Project } from '$lib'
    import { Button } from '$lib/components/ui/button'
    import { Label } from '$lib/components/ui/label'
    import { Input } from '$lib/components/ui/input'
    import { Plus } from 'lucide-svelte'
    import ChatComponent from '$lib/components/chat.svelte'
    import * as Dialog from '$lib/components/ui/dialog'
    import CircularLoader from '$lib/components/circular-loader.svelte';
    import { onMount } from 'svelte'
    import { invalidateAll } from '$app/navigation'

    type Props = {
        projects: Project[],
        onProjectCreate: (project: Project) => void,
    }

    let { projects = $bindable(), onProjectCreate }: Props = $props()

    let projectSelectOpen = $state(false)
    let newProjectDialogOpen = $state(false)
    let newProjectName = $state('')
    let creatingProject = $state(false)
    let loadingChats = $state(true)
    let chats = $state<Chat[]>([])
    let newChatTitle = $state('')
    let renameChatDialogOpen = $state(false)
    let renameChatId = $state<string | null>(null)

    onMount(async () => {
        loadingChats = true
        await fetchChats(selectedProject.value.id)
    })

    async function createProject(e: SubmitEvent) {
        e.preventDefault()
        if (!newProjectName) {
            toast.error('Project name cannot be empty')
            return
        }

        creatingProject = true
        const resp = await fetch('/api/project', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: newProjectName
            })
        })
        creatingProject = false

        if (!resp.ok) {
            toast.error('Failed to create project')
            return
        }

        const { id } = await resp.json()
        const newProject = {
            id,
            name: newProjectName,
            createdAt: Date.now()
        }

        onProjectCreate(newProject)

        newProjectDialogOpen = false
        projectSelectOpen = false
        selectedProject.value = newProject
        await fetchChats(id)
    }

    async function onProjectSelect(id: string) {
        const project = projects.filter(p => p.id === id)[0]
        if (!project) {
            return
        }
        selectedProject.value = project
        await fetchChats(id)
    }

    async function fetchChats(projectId: string) {
        loadingChats = true
        const resp = await fetch(`/api/chat?projectId=${projectId}`)
        loadingChats = false
        if (!resp.ok) {
            toast.error('Failed to fetch chats')
            return null
        }
        const data = await resp.json()
        chats = data.chats
    }

    function onRenameChat(chatId: string, chatTitle: string) {
        renameChatId = chatId
        newChatTitle = chatTitle
        renameChatDialogOpen = true
    }

    function onDeleteChat(chatId: string) {
        chats = chats.filter(c => c.id !== chatId)
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

<div class="flex w-full justify-center items-center p-2 h-14 border-b">
    <Select.Root type="single" name="model" bind:open={projectSelectOpen} value={selectedProject.value.id} onValueChange={onProjectSelect}>
        <Select.Trigger class="w-full flex items-center justify-center gap-2 text-muted-foreground font-semibold bg-muted border-none">
            <NotebookText class="w-4 h-4 text-muted-foreground" />
            {selectedProject.value.name}
        </Select.Trigger>
        <Select.Content align="start">
            <Select.Group>
                <Select.GroupHeading class="text-xs text-muted-foreground uppercase">Projects</Select.GroupHeading>
                {#each projects as project}
                    <Select.Item value={project.id} label={project.name} class="rounded-lg my-1 cursor-pointer">{project.name}</Select.Item>
                {/each}
            </Select.Group>
            <hr>
            <Select.Group class="mt-1">
                <Button variant="ghost" class="w-full justify-start gap-2 cursor-pointer" onclick={() => newProjectDialogOpen = true}>
                    <Plus class="w-4 h-4" />
                    New Project
                </Button>
            </Select.Group>
        </Select.Content>
    </Select.Root>
</div>
<div class="flex-1 min-h-0 overflow-y-auto pb-10">
    {#if loadingChats}
        <div class="h-full flex justify-center pt-8">
            <p class="text-muted-foreground text-xs uppercase text-center font-bold">
                Loading chats...
            </p>
        </div>
    {:else}
        {#each chats as chat}
            <ChatComponent {chat} {onRenameChat} {onDeleteChat} />
        {:else}
            <div class="h-full flex justify-center pt-8">
                <p class="text-muted-foreground text-xs uppercase text-center font-bold">
                    No chats found
                </p>
            </div>
        {/each}
    {/if}
</div>

<Dialog.Root bind:open={newProjectDialogOpen}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>New Project</Dialog.Title>
            <Dialog.Description>
                Projects help you group conversations together. Create a new project for each task, and then build conversation datasets to fine-tune models for that task.
            </Dialog.Description>
        </Dialog.Header>
        <form onsubmit={createProject} class="flex flex-col gap-3">
            <Label for="name">Name</Label>
            <Input 
                id="name" 
                type="text" 
                bind:value={newProjectName} 
                placeholder="E.g., Data Analytics Bot" />
            <Dialog.Footer>
                <Button variant="outline" onclick={() => newProjectDialogOpen = false}>Cancel</Button>
                <Button type="submit" disabled={creatingProject}>
                    {#if creatingProject}
                        <CircularLoader />
                        Creating...
                    {:else}
                        Create
                    {/if}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={renameChatDialogOpen}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>Rename chat</Dialog.Title>
        </Dialog.Header>
        <form onsubmit={renameChat} class="flex flex-col gap-4">
            <Input type="text" 
                bind:value={newChatTitle} 
                placeholder="Enter new chat title..." />
            <Dialog.Footer>
                <Button variant="outline" onclick={() => renameChatDialogOpen = false}>Cancel</Button>
                <Button type="submit">Rename</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>