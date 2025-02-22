<script lang="ts">
    import { onMount } from 'svelte';

    let lineHeight = $state<number | null>(null)

    let { 
        value = $bindable(), 
        el = $bindable(), 
        ...rest 
    } = $props()

    onMount(() => {
        lineHeight = parseInt(getComputedStyle(el!).lineHeight);
        autoResize();
    });

    export function autoResize() {
        if (!lineHeight || !el) {
            console.log('lineHeight or el is null')
            return;
        }
        el.style.height = 'auto';
        const maxHeight = lineHeight * 7; // Max 7 rows of text
        const minHeight = lineHeight * 3; // Min 3 rows of text
        let computedHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)
        el.style.height = `${computedHeight}px`
    }
</script>

<textarea
    bind:this={el}
    bind:value
    rows={3}
    oninput={() => {
        rest.oninput?.()
        autoResize()
    }}
    onpaste={autoResize}
    oncut={autoResize}
    {...rest}
></textarea>