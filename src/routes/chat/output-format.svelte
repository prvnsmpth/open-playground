<script lang="ts">
    import { type OutputFormat } from '$lib'
    import * as Select from '$lib/components/ui/select'
    import * as Dialog from '$lib/components/ui/dialog'
    import { presetStore } from '$lib/client/index.svelte'
    import AutoTextarea from '$lib/components/auto-textarea.svelte'
    import { Label } from '$lib/components/ui/label'
    import { Button } from '$lib/components/ui/button'
    import { cn } from '$lib/utils'
    import { SquarePen } from 'lucide-svelte'

    const types = [
        'text',
        'json',
        'json_schema'
    ]

    let open = $state(false)
    const outputFormat = presetStore.value.config.outputFormat
    let reOutputFormat = $derived(presetStore.value.config.outputFormat)
    let formatType = $derived(reOutputFormat?.type || 'text')
    function handleValueChange(v: string) {
        if (v === 'json_schema' && !schema) {
            schemaDialogOpen = true
        } else {
            presetStore.value.config.outputFormat = { type: v as OutputFormat['type'] }
        }
    }

    let schemaDialogOpen = $state(false)
    let schema = $state(outputFormat?.type === 'json_schema' ? JSON.stringify(outputFormat.schema, null, 4) : '')
    let schemaError = $state('')
    let sampleSchema = JSON.stringify({
        "title": "Person",
        "type": "object",
        "properties": {
            "name": {
                "type": "string"
            },
            "age": {
                "type": "integer"
            }
        },
        "required": ["name", "age"]
    }, null, 4)
    function handleSubmit(e: SubmitEvent) {
        e.preventDefault()
        try {
            const parsedSchema = JSON.parse(schema)
            presetStore.value.config.outputFormat = { type: 'json_schema', schema: parsedSchema }
            schemaDialogOpen = false
        } catch (err: any) {
            schemaError = `Invalid JSON schema: ${err.message}`
        }
    }
</script>

<div class="flex flex-col gap-2">
    <p class="uppercase font-bold text-xs">Output format</p>
    <div class="flex flex-col gap-1">
        <div class="flex flex-col">
            <Select.Root type="single" name="output-format" bind:open value={formatType} onValueChange={handleValueChange}>
                <Select.Trigger class="w-full flex items-start gap-2 text-foreground">
                    <div class="flex gap-2 items-center justify-between w-full font-mono">
                        {formatType}
                    </div>
                </Select.Trigger>
                <Select.Content align="start">
                    {#each types as type}
                        <Select.Item value={type} label={type} class="font-mono">{type}</Select.Item>
                    {/each}
                </Select.Content>
            </Select.Root>
            {#if reOutputFormat?.type === 'json_schema' && reOutputFormat.schema}
                <div class="flex items-center justify-between">
                <p class="text-xs">
                    schema: 
                    <span class="font-mono">
                        {reOutputFormat.schema.name}
                    </span>
                </p>
                <Button variant="link" onclick={() => schemaDialogOpen = true} class="text-xs p-1">
                    <SquarePen />
                </Button>
                </div>
            {/if}
        </div>
    </div>
</div>

<Dialog.Root bind:open={schemaDialogOpen}>
    <Dialog.Content class="max-w-screen-md">
        <Dialog.Header>
            <Dialog.Title>Add output schema</Dialog.Title>
            <Dialog.Description>
                The model's output will conform to this schema.
            </Dialog.Description>
        </Dialog.Header>
        <form onsubmit={handleSubmit} class="flex flex-col gap-3">
            <Label for="name">Schema</Label>
            <AutoTextarea 
                bind:value={schema}
                class={cn("bg-card ring-0 outline-none border rounded-lg p-2 font-mono text-sm resize-none", schemaError && "border-red-500")}
                minRows={30}
                maxRows={30}
                placeholder={sampleSchema} 
            />
            {#if schemaError}
               <p class="text-red-500 text-sm">{schemaError}</p>
            {/if}
            <Dialog.Footer>
                <Button variant="outline" onclick={() => schemaDialogOpen = false}>Cancel</Button>
                <Button type="submit">Save</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>



