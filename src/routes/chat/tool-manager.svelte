<script lang="ts">
    import { Checkbox } from '$lib/components/ui/checkbox'
    import { Label } from '$lib/components/ui/label'
    import { presetStore } from '$lib/client/index.svelte'
    import { Button } from '$lib/components/ui/button'
    import { Pencil, Plus, Trash2 } from 'lucide-svelte'
    import * as Dialog from '$lib/components/ui/dialog'
    import AutoTextarea from '$lib/components/auto-textarea.svelte'
    import { cn } from '$lib/utils'
    import { toast } from 'svelte-sonner'
    import { type Tool as OllamaTool } from 'ollama'
    import { isBuiltinTool } from '$lib'

    let { codeInterpreterEnabled } = $props()
    let mode = $state<'add' | 'edit' | null>(null)
    let schema = $state('')
    let schemaError = $state('')
    let toolDialogOpen = $state(false)

    const userDefinedTools = $derived(presetStore.value.config.tools?.filter(t => !isBuiltinTool(t)) as OllamaTool[] || [])

    // Func to validate OpenAPI schema
    // TODO: ollama probably has a validation func for this, use that
    function validateSchema(): OllamaTool | null {
        let parsedSchema
        try {
            parsedSchema = JSON.parse(schema)
            if (!parsedSchema.function?.name) {
                schemaError = 'Function name is required'
                return null
            }
            schemaError = ''
            return parsedSchema
        } catch (e) {
            schemaError = 'Invalid JSON'
            return null
        }
    }

    function handleSubmit(e: SubmitEvent) {
        e.preventDefault()

        const parsedSchema = validateSchema()
        if (!parsedSchema) {
            return
        }

        // TODO: validate schema against ollama's schema
        const existingToolIdx = userDefinedTools.findIndex(t => t.function?.name === parsedSchema.function?.name)
        if (mode === 'add' && existingToolIdx !== -1) {
            toast.error(`Function ${parsedSchema.function?.name} already exists.`)
            return
        }

        if (mode === 'edit' && existingToolIdx !== -1) {
            presetStore.value.config.tools = presetStore.value.config.tools?.map(t => {
                if (isBuiltinTool(t)) {
                    return t
                }
                if (t.function?.name === parsedSchema.function?.name) {
                    return parsedSchema
                }
                return t
            })
        } else {
            presetStore.value.config.tools?.push(parsedSchema)
        }

        toolDialogOpen = false
        schema = ''
    }

    function deleteTool(funcName: string) {
        presetStore.value.config.tools = 
            presetStore.value.config.tools?.filter(t => {
                if (isBuiltinTool(t)) {
                    return t
                }
                return t.function?.name !== funcName
            })
    }

    function editTool(funcName: string) {
        const tool = presetStore.value.config.tools?.find(t => {
            if (isBuiltinTool(t)) {
                return false
            }
            return t.function?.name === funcName
        })
        if (!tool) {
            return
        }
        schema = JSON.stringify(tool, null, 4)
        mode = 'edit'
        toolDialogOpen = true
    }

    const sampleTool = JSON.stringify({
        type: 'function',
        function: {
            name: 'get_current_weather',
            description: 'Get the current weather for a location',
            parameters: {
                type: 'object',
                properties: {
                    location: {
                        type: 'string',
                        description: 'The location to get the weather for, e.g. San Francisco, CA'
                    },
                    format: {
                        type: 'string',
                        description:
                            "The format to return the weather in, e.g. 'celsius' or 'fahrenheit'",
                        enum: ['celsius', 'fahrenheit']
                    }
                },
                required: ['location', 'format']
            }
        }
    }, null, 4)
</script>

<div class="flex flex-col gap-2">
    <p class="text-xs font-bold uppercase">Tools</p>
    <div class="flex flex-col gap-4">
        <div class="items-top flex gap-1.5">
            <Checkbox id="code-interpreter" bind:checked={codeInterpreterEnabled.value} />
            <div class="flex flex-col gap-1.5">
                <Label for="code-interpreter" class="flex flex-col gap-1">Code Interpreter</Label>
                <p class="m-0 text-xs text-muted-foreground">Execute any generated Python code</p>
            </div>
        </div>
        <div class="flex flex-col gap-2">
            {#each userDefinedTools as tool}
                <div class="flex justify-between items-center gap-1.5 border border-dashed rounded-lg p-2">
                    <span class="font-mono text-sm">{tool.function.name}</span>
                    <div class="flex gap-1">
                        <Button variant="ghost" size="icon" class="rounded h-6 w-6 p-3" onclick={() => deleteTool(tool.function.name)}>
                            <Trash2 />
                        </Button>
                        <Button variant="ghost" size="icon" class="rounded h-6 w-6 p-3" onclick={() => editTool(tool.function.name)}>
                            <Pencil />
                        </Button>
                    </div>
                </div>
            {/each}
        </div>
    </div>

    <Button variant="outline" size="sm" class="mt-2 flex items-center" onclick={() => {
        schema = ''
        mode = 'add'
        toolDialogOpen = true
    }}>
        <Plus class="h-4 w-4" />
        Add tool
    </Button>
</div>

<Dialog.Root bind:open={toolDialogOpen}>
    <Dialog.Content class="max-w-screen-md">
        <Dialog.Header>
            <Dialog.Title>
                {#if mode === 'edit'}
                    Edit tool
                {:else}
                    Add tool
                {/if}
            </Dialog.Title>
            <Dialog.Description>
                {#if mode === 'edit'}
                    Edit tool definition. Changing the name will create a new tool.
                {:else}
                    Add a tool to the model's toolkit.
                {/if}
            </Dialog.Description>
        </Dialog.Header>
        <form onsubmit={handleSubmit} class="flex flex-col gap-3">
            <Label for="name">Tool Definition (OpenAPI style)</Label>
            <AutoTextarea
                bind:value={schema}
                class={cn(
                    'resize-none rounded-lg border bg-card p-2 font-mono text-sm outline-none ring-0',
                    schemaError && 'border-red-500'
                )}
                minRows={30}
                maxRows={30}
                placeholder={sampleTool}
            />
            {#if schemaError}
                <p class="text-sm text-red-500">{schemaError}</p>
            {/if}
            <Dialog.Footer>
                <Button variant="outline" onclick={() => (toolDialogOpen = false)}>Cancel</Button>
                <Button type="submit">Save</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
