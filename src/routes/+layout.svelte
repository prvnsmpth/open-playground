<script lang="ts">
    import '../app.css'
    import { page } from '$app/state';
    import { cn } from '$lib/utils';
    import ghLogo from '$lib/images/github.svg'

    let { children } = $props()

    const currPath = $derived(page.url.pathname)
</script>

<div class="flex flex-col h-screen overflow-hidden">
    <nav class="h-10 border-b flex items-center justify-between px-4 bg-muted">
        <div class="font-semibold">open-playground</div>
        <div class="flex gap-6 font-semibold">
            <a href="/chat" class={cn("text-sm text-muted-foreground hover:text-foreground transition-colors", currPath.startsWith('/chat') && 'text-foreground')}>
                Chat
            </a>
            <!-- <a href="/datasets" class={cn("text-sm text-muted-foreground hover:text-foreground transition-colors", currPath.startsWith('/datasets') && 'text-foreground')}>
                Datasets
            </a> -->
            <a href="/projects" class={cn("text-sm text-muted-foreground hover:text-foreground transition-colors", currPath.startsWith('/projects') && 'text-foreground')}>
                Projects
            </a>

            <a href="https://github.com/prvnsmpth/open-playground" target="_blank" class="text-sm text-muted-foreground hover:text-foreground" title="Github">
                <img src={ghLogo} alt="github logo" class="w-5 h-5 inline-block mr-1">
            </a>
        </div>
    </nav>
    <main class="flex-1 overflow-hidden">
        {@render children()}
    </main>
</div>