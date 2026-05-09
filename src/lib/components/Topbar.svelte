<script>
  import { syncState, refreshAll, config, filters } from '$lib/data/stores.js';
  import { goto } from '$app/navigation';

  $: ago = relTime($config.lastSyncedAt);
  function relTime(iso) {
    if (!iso) return 'never';
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s/60)} min ago`;
    if (s < 86400) return `${Math.round(s/3600)} h ago`;
    return new Date(iso).toLocaleDateString();
  }

  let q = '';
  function onSearch(e) {
    if (e.key === 'Enter') {
      filters.update(f => ({ ...f, search: q }));
      goto('/candidates');
    }
  }
</script>

<header class="topbar">
  <div class="left">
    <div class="search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input
        bind:value={q}
        on:keydown={onSearch}
        placeholder="Search candidates, universities, recruiters…"
      />
      <span class="kbd">⏎</span>
    </div>
  </div>

  <div class="right">
    <div class="sync" data-tooltip={$syncState.error || $syncState.message || 'Sync status'}>
      <span class="dot"
        class:ok={$syncState.status === 'ok'}
        class:bad={$syncState.status === 'error'}
        class:live={$syncState.status === 'syncing'}
      ></span>
      <span class="muted" style="font-size:12px">
        {#if $syncState.status === 'syncing'}Syncing…
        {:else if $syncState.status === 'error'}Sync error
        {:else if $syncState.status === 'ok'}Synced {ago}
        {:else}Not connected{/if}
      </span>
    </div>

    <button type="button" class="btn ghost icon" aria-label="Refresh sheets" data-tooltip="Refresh" on:click={() => refreshAll()} disabled={$syncState.status === 'syncing'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M3 12a9 9 0 0 1 15.5-6.3M21 12a9 9 0 0 1-15.5 6.3"/>
        <path d="M21 4v5h-5M3 20v-5h5"/>
      </svg>
    </button>

    <a href="/settings" class="btn ghost icon" aria-label="Open settings" data-tooltip="Settings">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M5 12h-2M21 12h-2M12 5V3M12 21v-2M7 7L5.5 5.5M18.5 18.5L17 17M7 17l-1.5 1.5M18.5 5.5L17 7"/></svg>
    </a>

    <div class="avatar" aria-label="Account: programops@nxtwave.in" data-tooltip="programops@nxtwave.in">PO</div>
  </div>
</header>

<style>
  .topbar {
    height: var(--topbar-h);
    border-bottom: 1px solid var(--line);
    background: rgba(236, 230, 221, .85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    position: sticky; top: 0; z-index: 30;
    display: flex; align-items: center;
    padding: 0 28px;
    gap: 20px;
  }
  .left { flex: 1; max-width: 560px; }
  .search {
    display: flex; align-items: center; gap: 10px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-pill);
    padding: 9px 16px;
    color: var(--muted);
    transition: all var(--t-fast) var(--ease);
  }
  .search:focus-within { border-color: var(--ink-3); box-shadow: 0 0 0 4px rgba(27,31,42,.06); color: var(--ink); }
  .search input { flex: 1; border: 0; background: transparent; outline: none; font-size: 13px; color: var(--ink); }
  .search input::placeholder { color: var(--muted); }
  .kbd { font-family: var(--font-mono); font-size: 10px; color: var(--muted); padding: 2px 6px; border: 1px solid var(--line); border-radius: 4px; background: var(--surface-soft); }
  .right { display: flex; align-items: center; gap: 10px; }
  .sync { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 99px; background: var(--surface-soft); border: 1px solid var(--line); }
  .avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: var(--ink);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 600; letter-spacing: .04em;
    cursor: pointer;
  }
</style>
