<script lang="ts">
    import * as Tooltip from '$lib/components/ui/tooltip'

    let { children, tooltip } = $props()
</script>

<Tooltip.Provider delayDuration={300}>
    <Tooltip.Root>
        <Tooltip.Trigger>
            {@render children()}
        </Tooltip.Trigger>
        <Tooltip.Content>
            <p>{tooltip}</p>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>