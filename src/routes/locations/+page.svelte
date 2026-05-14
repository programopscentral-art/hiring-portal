<script>
  import { base } from '$app/paths';
  import IndiaMap from '$lib/components/IndiaMap.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { byState, byUniversity, dataset, ROLES } from '$lib/data/stores.js';

  function fmt(n) { return (n || 0).toLocaleString(); }

  // Group universities by inferred state via candidate intersection
  $: statesWithUnis = $byState.map(st => {
    const unisInState = new Set();
    for (const c of st.candidates) {
      const co = c.currentCompany || '';
      if (/university|college|institute|iit|nit|iiit|iim/i.test(co)) {
        unisInState.add(co);
      }
    }
    return { ...st, universities: [...unisInState].sort() };
  });
</script>

<svelte:head><title>Locations · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">Hiring portal</div>
    <h1 class="serif">Locations</h1>
    <p class="muted lead">{$byState.length} states · {$byUniversity.length} universities/colleges represented across candidates.</p>
  </div>
</header>

<section class="row gap" style="margin-top:18px;align-items:flex-start">
  <div class="card pad-lg" style="flex:1.4;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">India · candidate distribution</h2>
    <div style="height:520px">
      <IndiaMap />
    </div>
  </div>

  <div class="card pad-lg" style="flex:1;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">By state ({$byState.length})</h2>
    {#if $byState.length}
      <div class="state-grid">
        {#each $byState as st}
          {@const pct = st.total / $byState[0].total}
          <a class="state-card" href="{base}/locations/{encodeURIComponent(st.state)}">
            <div class="row between" style="align-items:flex-start">
              <div class="state-name">{st.state}</div>
              <div class="state-count display">{fmt(st.total)}</div>
            </div>
            <div class="state-bar"><div class="state-fill" style="width:{Math.max(8, pct * 100)}%"></div></div>
            <div class="state-foot muted">
              <span class="ok">{fmt(st.active)} active</span>
              {#if st.hired}<span>· {fmt(st.hired)} hired</span>{/if}
              {#if st.rejected}<span>· {fmt(st.rejected)} rejected</span>{/if}
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <EmptyState title="No state distribution yet." />
    {/if}
  </div>
</section>

<section class="card pad-lg" style="margin-top:24px">
  <h2 class="serif" style="font-size:22px;margin-bottom:14px">Top universities & companies ({$byUniversity.length})</h2>
  {#if $byUniversity.length}
    <div class="uni-grid">
      {#each $byUniversity.slice(0, 30) as u}
        <div class="uni-card">
          <div class="uni-name">{u.name}</div>
          <div class="uni-stats">
            <span class="display">{fmt(u.total)}</span>
            <span class="muted small">candidates</span>
            {#if u.hired}<span class="pill solid sm" style="background:var(--ok)">{u.hired} hired</span>{/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <EmptyState title="No university data yet." body="Universities/colleges are inferred from candidate Current Company values." />
  {/if}
</section>

<style>
  .state-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
    max-height: 520px;
    overflow-y: auto;
    padding-right: 8px;
  }
  .state-card {
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--surface-soft);
    transition: all var(--t-fast) var(--ease);
  }
  .state-card:hover { border-color: var(--brand); transform: translateY(-2px); box-shadow: var(--shadow-sm); background: var(--surface); }
  .state-name { font-size: 13px; font-weight: 700; color: var(--ink); }
  .state-count { font-size: 28px; line-height: 1; }
  .state-bar { height: 6px; background: var(--surface-sunk); border-radius: 3px; overflow: hidden; margin: 10px 0 8px; }
  .state-fill { height: 100%; background: linear-gradient(90deg, var(--brand), var(--brand-deep)); }
  .state-foot { font-size: 11px; }
  .state-foot .ok { color: var(--ok); font-weight: 700; }

  .uni-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }
  .uni-card {
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--surface);
  }
  .uni-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .uni-stats { display: flex; align-items: baseline; gap: 8px; }
  .uni-stats .display { font-size: 22px; color: var(--brand); }
  .uni-stats .small { font-size: 11px; }
  .pill.sm { padding: 2px 8px; font-size: 10px; }
</style>
