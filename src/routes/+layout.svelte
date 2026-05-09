<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { page } from '$app/stores';
  import TopNav from '$lib/components/TopNav.svelte';
  import Toaster from '$lib/components/Toaster.svelte';
  import { bootstrap } from '$lib/data/stores.js';
  import { initTheme } from '$lib/data/theme.js';

  onMount(() => {
    initTheme();
    bootstrap();
  });
</script>

<TopNav />

<main class="content">
  {#key $page.url.pathname}
    <div in:fade={{ duration: 220 }}>
      <slot />
    </div>
  {/key}
</main>

<Toaster />

<style>
  .content {
    padding: 28px 32px 80px;
    max-width: var(--content-max);
    margin: 0 auto;
  }
  @media (max-width: 900px) {
    .content { padding: 20px 16px 80px; }
  }
</style>
