<script lang="ts">
    import { onMount } from 'svelte';

    let lineHeight = $state<number | null>(null)

    let { 
        value = $bindable(), 
        el = $bindable(), 
        onInput = () => {},
        minRows = 3,
        maxRows = 7,
        ...rest 
    } = $props()

    onMount(() => {
        lineHeight = parseInt(getComputedStyle(el!).lineHeight);
        autoResize();
    });

    export function autoResize() {
        if (!lineHeight || !el) {
            return;
        }
        el.style.height = 'auto';
        const maxHeight = lineHeight * maxRows
        const minHeight = lineHeight * minRows
        let computedHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)
        el.style.height = `${computedHeight}px`
    }
</script>

<textarea
    bind:this={el}
    bind:value
    rows={3}
    oninput={() => {
        onInput()
        autoResize()
    }}
    onpaste={autoResize}
    oncut={autoResize}
    {...rest}
></textarea>