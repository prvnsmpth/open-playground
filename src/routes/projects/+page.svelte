<script lang="ts">
    import { toast } from 'svelte-sonner';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import * as Dialog from '$lib/components/ui/dialog';
    import * as Table from '$lib/components/ui/table';
    import CircularLoader from '$lib/components/circular-loader.svelte';
    import { Plus, Pencil, Trash2 } from 'lucide-svelte';
    import type { Project } from '$lib';
    import { goto, invalidateAll } from '$app/navigation';
    import { selectedProject } from '$lib/client/index.svelte';

    let { data } = $props();
    
    let loading = $state(false);
    let newProjectDialogOpen = $state(false);
    let editProjectDialogOpen = $state(false);
    let deleteProjectDialogOpen = $state(false);
    let newProjectName = $state('');
    let editProjectName = $state('');
    let selectedProjectId = $state<string | null>(null);
    let processingAction = $state(false);

    async function createProject(e: SubmitEvent) {
        e.preventDefault();
        if (!newProjectName) {
            toast.error('Project name cannot be empty');
            return;
        }

        processingAction = true;
        try {
            const response = await fetch('/api/project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newProjectName
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create project');
            }

            const { id } = await response.json();
            
            // Add new project to the list
            const newProject = {
                id,
                name: newProjectName,
                createdAt: Date.now()
            };
            
            // Refresh the projects list
            invalidateAll();
            newProjectDialogOpen = false;
            newProjectName = '';
            toast.success('Project created successfully');
        } catch (error) {
            console.error('Error creating project:', error);
            toast.error('Failed to create project');
        } finally {
            processingAction = false;
        }
    }

    function openEditDialog(project: Project) {
        selectedProjectId = project.id;
        editProjectName = project.name;
        editProjectDialogOpen = true;
    }

    function openDeleteDialog(project: Project) {
        selectedProjectId = project.id;
        deleteProjectDialogOpen = true;
    }

    async function updateProject(e: SubmitEvent) {
        e.preventDefault();
        if (!selectedProjectId || !editProjectName) {
            toast.error('Project name cannot be empty');
            return;
        }

        processingAction = true;
        try {
            const response = await fetch(`/api/project/${selectedProjectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: editProjectName
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update project');
            }

            // If this is the currently selected project, update it
            if (selectedProject.value.id === selectedProjectId) {
                selectedProject.value = {
                    ...selectedProject.value,
                    name: editProjectName
                };
            }
            
            // Refresh the projects list
            invalidateAll();
            editProjectDialogOpen = false;
            toast.success('Project updated successfully');
        } catch (error) {
            console.error('Error updating project:', error);
            toast.error('Failed to update project');
        } finally {
            processingAction = false;
        }
    }

    async function deleteProject() {
        if (!selectedProjectId) {
            return;
        }

        processingAction = true;
        try {
            const response = await fetch(`/api/project/${selectedProjectId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete project');
            }

            // Remove project from the list
            data = {
                ...data,
                projects: data.projects.filter(p => p.id !== selectedProjectId)
            }
            
            // // If this is the currently selected project, switch to default
            // if (selectedProject.value.id === selectedProjectId) {
            //     // Find the first available project or use default
            //     const firstProject = projects[0] || { id: 'p_default', name: 'Default Project', createdAt: Date.now() };
            //     selectedProject.value = firstProject;
            // }
            
            // Refresh the projects list
            invalidateAll();
            deleteProjectDialogOpen = false;
            toast.success('Project deleted successfully');
        } catch (error) {
            console.error('Error deleting project:', error);
            toast.error('Failed to delete project');
        } finally {
            processingAction = false;
        }
    }

    function navigateToChat(projectId: string) {
        // Set the selected project
        const project = data.projects.find(p => p.id === projectId);
        if (project) {
            selectedProject.value = project;
        }
        
        // Navigate to chat page
        goto('/chat');
    }
</script>

<div class="container mx-auto py-16 px-4">
    <div class="flex justify-between items-center mb-2">
        <div class="flex flex-col gap-1">
            <h1 class="text-xl font-bold">Projects</h1>
            <p class="text-sm text-muted-foreground">
                Projects help you organize your conversation data into topics or tasks.
            </p>
        </div>
        <Button size="sm" onclick={() => newProjectDialogOpen = true} class="self-end flex items-center gap-2">
            <Plus class="w-4 h-4" />
            New Project
        </Button>
    </div>

    {#if loading}
        <div class="flex justify-center items-center h-64">
            <CircularLoader />
        </div>
    {:else if data.projects.length === 0}
        <div class="flex flex-col items-center justify-center h-64 text-center">
            <p class="text-muted-foreground mb-4">No projects found</p>
            <Button variant="outline" onclick={() => newProjectDialogOpen = true} class="flex items-center gap-2">
                <Plus class="w-4 h-4" />
                Create your first project
            </Button>
        </div>
    {:else}
        <div class="w-full overflow-hidden rounded-lg border">
            <Table.Root class="border-collapse">
                <Table.Header>
                    <Table.Row>
                        <Table.Head>Project Name</Table.Head>
                        <Table.Head>Created Date</Table.Head>
                        <Table.Head class="text-right"></Table.Head>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {#each data.projects as project}
                        <Table.Row class="hover:cursor-pointer" onclick={() => navigateToChat(project.id)}>
                            <Table.Cell class="py-2 font-semibold">{project.name}</Table.Cell>
                            <Table.Cell class="py-2">{new Date(project.createdAt).toLocaleDateString()}</Table.Cell>
                            <Table.Cell class="py-2 text-right">
                                <div class="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onclick={(e) => {
                                        e.stopPropagation();
                                        openEditDialog(project);
                                    }} title="Edit project">
                                        <Pencil class="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onclick={(e) => {
                                        e.stopPropagation();
                                        openDeleteDialog(project);
                                    }} title="Delete project">
                                        <Trash2 class="w-4 h-4" />
                                    </Button>
                                </div>
                            </Table.Cell>
                        </Table.Row>
                    {/each}
                </Table.Body>
            </Table.Root>
        </div>
    {/if}
</div>

<!-- Create Project Dialog -->
<Dialog.Root bind:open={newProjectDialogOpen}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>New Project</Dialog.Title>
            <Dialog.Description>
                Create a new project to organize your chats.
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
                <Button variant="outline" onclick={() => newProjectDialogOpen = false} type="button">Cancel</Button>
                <Button type="submit" disabled={processingAction}>
                    {#if processingAction}
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

<!-- Edit Project Dialog -->
<Dialog.Root bind:open={editProjectDialogOpen}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>Edit Project</Dialog.Title>
        </Dialog.Header>
        <form onsubmit={updateProject} class="flex flex-col gap-3">
            <Label for="edit-name">Name</Label>
            <Input 
                id="edit-name" 
                type="text" 
                bind:value={editProjectName} 
                placeholder="Project name" />
            <Dialog.Footer>
                <Button variant="outline" onclick={() => editProjectDialogOpen = false} type="button">Cancel</Button>
                <Button type="submit" disabled={processingAction}>
                    {#if processingAction}
                        <CircularLoader />
                        Updating...
                    {:else}
                        Update
                    {/if}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- Delete Project Dialog -->
<Dialog.Root bind:open={deleteProjectDialogOpen}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>Delete Project</Dialog.Title>
            <Dialog.Description>
                Are you sure you want to delete this project? This action cannot be undone and will delete all chats associated with this project.
            </Dialog.Description>
        </Dialog.Header>
        <div class="flex flex-col gap-3">
            <Dialog.Footer>
                <Button variant="outline" onclick={() => deleteProjectDialogOpen = false}>Cancel</Button>
                <Button variant="destructive" onclick={deleteProject} disabled={processingAction}>
                    {#if processingAction}
                        <CircularLoader />
                        Deleting...
                    {:else}
                        Delete
                    {/if}
                </Button>
            </Dialog.Footer>
        </div>
    </Dialog.Content>
</Dialog.Root>