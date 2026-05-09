<script>
  import { page } from '$app/stores';

  const groups = [
    {
      label: 'Overview',
      items: [
        { href: '/',          label: 'Dashboard',     icon: 'home' },
        { href: '/plan',      label: 'Plan vs Actual', icon: 'target' },
        { href: '/funnel',    label: 'Funnel',         icon: 'funnel' },
      ],
    },
    {
      label: 'People',
      items: [
        { href: '/candidates', label: 'Candidates',  icon: 'users' },
        { href: '/analytics',  label: 'Analytics',   icon: 'chart' },
      ],
    },
    {
      label: 'System',
      items: [
        { href: '/settings',  label: 'Settings',    icon: 'cog' },
      ],
    },
  ];

  $: path = $page.url.pathname;
  function isActive(href) {
    if (href === '/') return path === '/';
    return path.startsWith(href);
  }
</script>

<aside class="sidebar">
  <div class="brand">
    <div class="logo">
      <svg width="22" height="22" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0E2745"/><path d="M9 22V10h2.5v12H9zm5.5 0V10h2.5l3.5 7V10H23v12h-2.5L17 15v7h-2.5z" fill="#3672B5"/></svg>
    </div>
    <div class="bword">
      <div class="word serif">Hiring</div>
      <div class="sub">ProgramOps · 2026</div>
    </div>
  </div>

  <nav class="nav">
    {#each groups as g}
      <div class="group">
        <div class="g-label">{g.label}</div>
        {#each g.items as item}
          <a class="item" class:active={isActive(item.href)} href={item.href} data-sveltekit-preload-data="hover">
            <span class="icon">
              {#if item.icon === 'home'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9z" stroke-linejoin="round"/></svg>
              {:else if item.icon === 'target'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>
              {:else if item.icon === 'funnel'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" stroke-linejoin="round"/></svg>
              {:else if item.icon === 'users'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c.8-3.6 3.7-5.5 7-5.5s6.2 1.9 7 5.5"/><circle cx="17" cy="6.5" r="2.5"/><path d="M16 13.5c2.7 0 5 1.3 6 4"/></svg>
              {:else if item.icon === 'chart'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20V8M10 20V4M16 20v-9M22 20H2"/></svg>
              {:else if item.icon === 'cog'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
              {/if}
            </span>
            <span class="label">{item.label}</span>
            {#if isActive(item.href)}
              <span class="active-dot"></span>
            {/if}
          </a>
        {/each}
      </div>
    {/each}
  </nav>

  <div class="foot">
    <div class="card soft" style="padding:14px;border-radius:14px">
      <div class="row gap-sm" style="margin-bottom:6px">
        <span class="dot live"></span>
        <span class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em">Cycle 2026</span>
      </div>
      <div style="font-family:var(--font-serif);font-size:18px;line-height:1.2">Hire with intent.</div>
      <div class="muted" style="font-size:12px;margin-top:4px">Real-time visibility across every stage.</div>
    </div>
  </div>
</aside>

<style>
  .sidebar {
    width: var(--side-w);
    flex-shrink: 0;
    border-right: 1px solid var(--line);
    background: var(--bg);
    height: 100vh;
    position: sticky; top: 0;
    display: flex; flex-direction: column;
    padding: 22px 18px;
    gap: 28px;
  }
  .brand {
    display: flex; align-items: center; gap: 12px;
    padding: 4px 10px;
  }
  .logo {
    width: 38px; height: 38px;
    border-radius: 10px;
    background: var(--ink);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 20px rgba(14, 39, 69, .22);
  }
  .bword .word { font-size: 22px; line-height: 1.1; }
  .bword .sub { font-size: 11px; color: var(--muted); margin-top: 2px; letter-spacing: .04em; text-transform: uppercase; }

  .nav { display: flex; flex-direction: column; gap: 18px; flex: 1; overflow: auto; padding: 0 4px; }
  .group { display: flex; flex-direction: column; gap: 2px; }
  .g-label {
    font-size: 10px; color: var(--muted-2);
    text-transform: uppercase; letter-spacing: .12em;
    padding: 8px 12px 6px;
  }
  .item {
    position: relative;
    display: flex; align-items: center; gap: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    color: var(--ink-2);
    font-weight: 500; font-size: 13.5px;
    transition: all var(--t-fast) var(--ease);
  }
  .item:hover { background: var(--surface-soft); color: var(--ink); }
  .item.active { background: var(--ink); color: #fff; box-shadow: 0 6px 16px rgba(14, 39, 69, .22); }
  .item.active:hover { background: var(--ink-2); }
  .icon { width: 18px; height: 18px; display: inline-flex; }
  .icon :global(svg) { width: 18px; height: 18px; }
  .active-dot {
    margin-left: auto;
    width: 6px; height: 6px; border-radius: 99px;
    background: var(--brand);
    box-shadow: 0 0 0 4px rgba(54, 114, 181, .22);
  }
  .foot { padding-top: 12px; }
</style>
