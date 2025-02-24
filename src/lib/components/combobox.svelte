<script lang="ts">
    import Check from 'lucide-svelte/icons/check';
    import { ChevronsUpDown, Blocks } from 'lucide-svelte';
    import { tick } from 'svelte';
    import * as Command from '$lib/components/ui/command/index.js';
    import * as Popover from '$lib/components/ui/popover/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { cn } from '$lib/utils.js';

    type Props = {
        placeholder: string
        emptyMessage: string
        items: {
            value: string
            label: string
        }[],
        value: string,
        onItemSelect: (value: string) => void
    }

    let { placeholder, emptyMessage, items = [], onItemSelect, value = $bindable() }: Props = $props()

    let open = $state(false);
    let triggerRef = $state<HTMLButtonElement>(null!);

    const selectedValue = $derived(items.find((f) => f.value === value)?.label);

    // We want to refocus the trigger button when the user selects
    // an item from the list so users can continue navigating the
    // rest of the form with the keyboard.
    function closeAndFocusTrigger() {
        open = false;
        tick().then(() => {
            triggerRef.focus();
        });
    }
</script>

<Popover.Root bind:open>
    <Popover.Trigger bind:ref={triggerRef} class="w-full">
        {#snippet child({ props })}
            <Button
                variant="outline"
                {...props}
                class="w-full justify-between"
                role="combobox"
                aria-expanded={open}
            >
                <div class="flex items-center gap-1">
                    <Blocks />
                    {selectedValue || placeholder}
                </div>
                <ChevronsUpDown class="opacity-50" />
            </Button>
        {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-[19rem] p-0">
        <Command.Root>
            <Command.Input {placeholder} />
            <Command.List>
                <Command.Empty>
                    <p class="text-xs text-muted-foreground">{emptyMessage}</p>
                </Command.Empty>
                <Command.Group>
                    {#each items as item}
                        <Command.Item
                            value={item.value}
                            onSelect={() => {
                                value = item.value;
                                onItemSelect(item.value)
                                closeAndFocusTrigger();
                            }}
                        >
                            <Check class={cn(value !==item.value && 'text-transparent')} />
                            {item.label}
                        </Command.Item>
                    {/each}
                </Command.Group>
            </Command.List>
        </Command.Root>
    </Popover.Content>
</Popover.Root>
