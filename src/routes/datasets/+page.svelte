<script lang="ts">
    import { Button } from '$lib/components/ui/button'
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import * as Table from '$lib/components/ui/table';
    import * as Dialog from '$lib/components/ui/dialog';
    import * as Select from '$lib/components/ui/select';
    import { Plus, Pencil, Trash2 } from 'lucide-svelte';
    import { onMount } from 'svelte'
    import { toast } from 'svelte-sonner'
    import { invalidateAll } from '$app/navigation';
    import { selectedProject } from '$lib/client/index.svelte';
    import type { Dataset, Project } from '$lib';

    let { data, form } = $props()
    let newDatasetDialogOpen = $state(false);
    let newDatasetName = $state('');
    
    // Edit dataset state
    let editDatasetDialogOpen = $state(false);
    let editDatasetId = $state('');
    let editDatasetName = $state('');
    
    // Delete dataset state
    let deleteDatasetDialogOpen = $state(false);
    let deleteDatasetId = $state('');
    let deleteDatasetName = $state('');

    // Project selection state
    let currentProjectId = $state(selectedProject.value.id);
    const filteredDatasets = $derived(data.datasets.filter(d => d.projectId === currentProjectId))

    // Function to open edit dialog
    function openEditDialog(dataset: Dataset) {
        editDatasetId = dataset.id || '';
        editDatasetName = dataset.name;
        editDatasetDialogOpen = true;
    }
    
    // Function to open delete dialog
    function openDeleteDialog(dataset: Dataset) {
        deleteDatasetId = dataset.id || '';
        deleteDatasetName = dataset.name;
        deleteDatasetDialogOpen = true;
    }

    // Function to handle project selection change
    async function handleProjectChange(projectId: string) {
        currentProjectId = projectId;
    }

    onMount(() => {
        if (form?.success) {
            toast.success('Dataset created successfully')
        } else if (form?.updated) {
            toast.success('Dataset updated successfully')
        } else if (form?.deleted) {
            toast.success('Dataset deleted successfully')
        }
    })
</script>

{#snippet projectSelector(projects: Project[], currentId: string, width = 'w-full md:w-64')}
    <Select.Root type="single" value={currentId} onValueChange={handleProjectChange}>
        <Select.Trigger id="project-select" class={width}>
            <span>{projects.find((p: Project) => p.id === currentId)?.name || 'Select a project'}</span>
        </Select.Trigger>
        <Select.Content>
            {#if projects && projects.length > 0}
                {#each projects as project}
                    <Select.Item value={project.id}>{project.name}</Select.Item>
                {/each}
            {/if}
        </Select.Content>
    </Select.Root>
{/snippet}

<div class="bg-yellow-200 p-1 text-center text-yellow-800 border-b border-yellow-300 text-xs font-semibold">
    This page is a work in progress. You will be able to create datasets to fine-tune models here.
</div>

<div class="container mx-auto py-16 px-4">
    <div class="flex justify-between items-center mb-2">
        <div class="flex flex-col gap-1">
            <h1 class="text-xl font-bold">Datasets</h1>
            <p class="text-sm text-muted-foreground">
                Build and manage datasets for fine-tuning your own models.
            </p>
        </div>
        <div class="flex items-center gap-2">
            {@render projectSelector(data.projects, currentProjectId)}
            <Button onclick={() => newDatasetDialogOpen = true} class="self-end flex items-center gap-2">
                <Plus class="w-4 h-4" />
                New Dataset
            </Button>
        </div>
    </div>

    {#if filteredDatasets.length === 0}
        <div class="flex flex-col items-center justify-center h-64 text-center border border-muted rounded-lg">
            <p class="text-muted-foreground mb-4">No datasets found</p>
            <Button variant="secondary" onclick={() => newDatasetDialogOpen = true} class="flex items-center gap-2">
                <Plus class="w-4 h-4" />
                Create your first dataset
            </Button>
        </div>
    {:else}
        <div class="w-full overflow-hidden rounded-lg border">
            <Table.Root class="border-collapse">
                <Table.Header>
                    <Table.Row>
                        <Table.Head>Dataset Name</Table.Head>
                        <Table.Head>Created Date</Table.Head>
                        <Table.Head class="text-right"></Table.Head>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {#each filteredDatasets as dataset}
                        <Table.Row>
                            <Table.Cell class="py-2 font-semibold">{dataset.name}</Table.Cell>
                            <Table.Cell class="py-2">{new Date(dataset.createdAt).toLocaleDateString()}</Table.Cell>
                            <Table.Cell class="py-2 text-right">
                                <div class="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onclick={() => openEditDialog(dataset)}>
                                        <Pencil class="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onclick={() => openDeleteDialog(dataset)}>
                                        <Trash2 class="h-4 w-4" />
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

<!-- Create Dataset Dialog -->
<Dialog.Root bind:open={newDatasetDialogOpen}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>New Dataset</Dialog.Title>
            <Dialog.Description>
                Create a new dataset.
            </Dialog.Description>
        </Dialog.Header>
        <form class="flex flex-col gap-3" method="POST" action="?/create">
            <input type="hidden" name="projectId" value={currentProjectId} />
            <Label for="name">Name</Label>
            <Input
                id="name"
                name="name"
                type="text"
                bind:value={newDatasetName}
                placeholder="Dataset name" />
            <Dialog.Footer>
                <Button variant="outline" onclick={() => newDatasetDialogOpen = false} type="button">Cancel</Button>
                <Button type="submit">Create</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- Edit Dataset Dialog -->
<Dialog.Root bind:open={editDatasetDialogOpen}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>Edit Dataset</Dialog.Title>
            <Dialog.Description>
                Update dataset name.
            </Dialog.Description>
        </Dialog.Header>
        <form class="flex flex-col gap-3" method="POST" action="?/update">
            <input type="hidden" name="id" value={editDatasetId} />
            <Label for="edit-name">Name</Label>
            <Input
                id="edit-name"
                name="name"
                type="text"
                bind:value={editDatasetName}
                placeholder="Dataset name" />
            <Dialog.Footer>
                <Button variant="outline" onclick={() => editDatasetDialogOpen = false} type="button">Cancel</Button>
                <Button type="submit">Update</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- Delete Dataset Dialog -->
<Dialog.Root bind:open={deleteDatasetDialogOpen}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>Delete Dataset</Dialog.Title>
            <Dialog.Description>
                Are you sure you want to delete this dataset? This action cannot be undone.
            </Dialog.Description>
        </Dialog.Header>
        <form class="flex flex-col gap-3" method="POST" action="?/delete">
            <input type="hidden" name="id" value={deleteDatasetId} />
            <p class="text-sm text-muted-foreground">
                You are about to delete the dataset: <span class="font-semibold">{deleteDatasetName}</span>
            </p>
            <Dialog.Footer>
                <Button variant="outline" onclick={() => deleteDatasetDialogOpen = false} type="button">Cancel</Button>
                <Button variant="destructive" type="submit">Delete</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>