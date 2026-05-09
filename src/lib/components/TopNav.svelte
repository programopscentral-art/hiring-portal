<script>
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { syncState, refreshAll, config, filters } from '$lib/data/stores.js';
  import { theme, toggleTheme } from '$lib/data/theme.js';
  import { goto } from '$app/navigation';

  // hrefs are stored without base prefix; we add `base` everywhere they're used
  const items = [
    { href: '/',           label: 'Dashboard' },
    { href: '/plan',       label: 'Plan' },
    { href: '/funnel',     label: 'Funnel' },
    { href: '/candidates', label: 'Candidates' },
    { href: '/analytics',  label: 'Analytics' },
  ];

  $: path = $page.url.pathname;
  // Strip the base prefix when checking active state (path includes base on prod)
  $: bare = base && path.startsWith(base) ? path.slice(base.length) || '/' : path;
  function isActive(href) {
    if (href === '/') return bare === '/' || bare === '';
    return bare.startsWith(href);
  }

  $: ago = relTime($config.lastSyncedAt);
  function relTime(iso) {
    if (!iso) return 'never';
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s/60)}m ago`;
    if (s < 86400) return `${Math.round(s/3600)}h ago`;
    return new Date(iso).toLocaleDateString();
  }

  let q = '';
  function onSearch(e) {
    if (e.key === 'Enter') {
      filters.update(f => ({ ...f, search: q }));
      goto(`${base}/candidates`);
    }
  }
</script>

<header class="topnav">
  <a href="{base}/" class="brand">
    <div class="logo">
      <svg width="22" height="22" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1A0F08"/><path d="M9 22V10h2.5v12H9zm5.5 0V10h2.5l3.5 7V10H23v12h-2.5L17 15v7h-2.5z" fill="#E35336"/></svg>
    </div>
    <div class="words">
      <div class="name display">Hiring</div>
      <div class="sub">ProgramOps · 2026</div>
    </div>
  </a>

  <nav class="nav">
    {#each items as it}
      <a class="nav-item" class:active={isActive(it.href)} href="{base}{it.href}" data-sveltekit-preload-data="hover">
        {it.label}
      </a>
    {/each}
  </nav>

  <div class="right">
    <div class="search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input
        bind:value={q}
        on:keydown={onSearch}
        placeholder="Search candidates, universities…"
      />
      <span class="kbd">↵</span>
    </div>

    <div class="sync" data-tooltip={$syncState.error || $syncState.message || 'Sync status'}>
      <span class="dot"
        class:ok={$syncState.status === 'ok'}
        class:bad={$syncState.status === 'error'}
        class:live={$syncState.status === 'syncing'}
      ></span>
      <span class="syncLbl">{$syncState.status === 'syncing' ? 'Syncing' : $syncState.status === 'ok' ? ago : $syncState.status === 'error' ? 'Error' : '—'}</span>
    </div>

    <button
      type="button"
      class="btn ghost icon theme-toggle"
      aria-label="Toggle theme"
      data-tooltip={$theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      on:click={toggleTheme}
    >
      {#if $theme === 'dark'}
        <!-- Sun icon (currently dark, click to go light) -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="4" fill="currentColor"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </svg>
      {:else}
        <!-- Moon icon (currently light, click to go dark) -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      {/if}
    </button>

    <button type="button" class="btn ghost icon" aria-label="Refresh" data-tooltip="Refresh sheets" on:click={() => refreshAll()} disabled={$syncState.status === 'syncing'}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 15.5-6.3M21 12a9 9 0 0 1-15.5 6.3"/><path d="M21 4v5h-5M3 20v-5h5"/></svg>
    </button>

    <a href="{base}/settings" class="btn ghost icon" aria-label="Settings" data-tooltip="Settings">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M5 12h-2M21 12h-2M12 5V3M12 21v-2M7 7L5.5 5.5M18.5 18.5L17 17M7 17l-1.5 1.5M18.5 5.5L17 7"/></svg>
    </a>

    <div class="avatar" aria-label="Account">PO</div>
  </div>
</header>

<style>
  .topnav {
    height: var(--topnav-h);
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    position: sticky; top: 0; z-index: 30;
    display: flex; align-items: center;
    padding: 0 28px;
    gap: var(--s-6);
  }
  @media (max-width: 900px) {
    .topnav { padding: 0 16px; gap: 12px; }
  }

  /* Brand */
  .brand { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .logo {
    width: 38px; height: 38px;
    border-radius: 11px;
    background: var(--ink);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 14px rgba(26, 15, 8, .22);
    transition: transform var(--t-base) var(--ease);
  }
  .brand:hover .logo { transform: rotate(-6deg) scale(1.05); }
  .words .name { font-size: 22px; line-height: 1; font-weight: 800; letter-spacing: -0.02em; }
  .words .sub { font-size: 10.5px; color: var(--ink-3); margin-top: 3px; letter-spacing: .04em; text-transform: uppercase; font-weight: 600; }
  @media (max-width: 700px) { .words { display: none; } }

  /* Nav */
  .nav {
    display: flex;
    gap: 2px;
    background: var(--surface-soft);
    border: 1px solid var(--line);
    border-radius: var(--r-pill);
    padding: 4px;
    margin-left: auto;
  }
  @media (max-width: 1100px) { .nav { display: none; } }
  .nav-item {
    padding: 8px 16px;
    border-radius: var(--r-pill);
    color: var(--ink-3);
    font-size: 13px;
    font-weight: 600;
    transition: all var(--t-fast) var(--ease);
    position: relative;
  }
  .nav-item:hover { color: var(--ink); background: var(--surface); }
  .nav-item.active { background: var(--ink); color: var(--brand-soft); box-shadow: 0 4px 12px rgba(26, 15, 8, .18); }

  /* Right cluster */
  .right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: auto; }
  @media (min-width: 1101px) { .right { margin-left: 0; } }

  .search {
    display: flex; align-items: center; gap: 8px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-pill);
    padding: 8px 14px;
    color: var(--muted);
    transition: all var(--t-fast) var(--ease);
    min-width: 240px;
  }
  @media (max-width: 900px) { .search { display: none; } }
  .search:focus-within { border-color: var(--brand-deep); box-shadow: 0 0 0 4px var(--brand-soft); color: var(--ink); }
  .search input { flex: 1; border: 0; background: transparent; outline: none; font-size: 13px; color: var(--ink); }
  .search input::placeholder { color: var(--muted); }
  .kbd { font-family: var(--font-mono); font-size: 10px; color: var(--muted); padding: 2px 6px; border: 1px solid var(--line); border-radius: 4px; background: var(--surface-soft); }

  .sync {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 12px;
    border-radius: var(--r-pill);
    background: var(--surface);
    border: 1px solid var(--line);
  }
  @media (max-width: 1200px) { .sync .syncLbl { display: none; } }
  .syncLbl { font-size: 11px; color: var(--ink-3); font-weight: 600; }

  .avatar {
    width: 38px; height: 38px;
    border-radius: 50%;
    background: var(--brand);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 800; letter-spacing: .04em;
    cursor: pointer;
    border: 2px solid var(--ink);
    transition: transform var(--t-fast) var(--ease);
  }
  .avatar:hover { transform: scale(1.06) rotate(4deg); }

  .theme-toggle { transition: transform var(--t-base) var(--ease); }
  .theme-toggle:hover { transform: rotate(-12deg) scale(1.08); }
  .theme-toggle :global(svg) { transition: opacity var(--t-fast) var(--ease); }
</style>
