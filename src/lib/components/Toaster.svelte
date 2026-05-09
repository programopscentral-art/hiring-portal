<script>
  import { toasts } from '$lib/data/stores.js';
  import { fly, fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
</script>

<div class="toast-stack">
  {#each $toasts as t (t.id)}
    <div class="t {t.kind}"
      in:fly={{ y: 16, duration: 320, easing: quintOut }}
      out:fade={{ duration: 200 }}
    >
      <span class="dot {t.kind === 'error' ? 'bad' : t.kind === 'success' ? 'ok' : 'live'}"></span>
      <span>{t.message}</span>
    </div>
  {/each}
</div>

<style>
  .toast-stack {
    position: fixed; bottom: 20px; right: 24px;
    display: flex; flex-direction: column; gap: 8px;
    z-index: 100;
    pointer-events: none;
  }
  .t {
    pointer-events: auto;
    background: var(--ink);
    color: #fff;
    padding: 10px 14px 10px 14px;
    border-radius: var(--r-pill);
    font-size: 13px;
    display: flex; align-items: center; gap: 10px;
    box-shadow: var(--shadow-lg);
    max-width: 420px;
  }
  .t.error { background: var(--bad); }
  .t.success { background: var(--ok); }
</style>
