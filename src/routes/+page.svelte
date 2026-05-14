<script>
  import { base } from '$app/paths';
  import StatCard from '$lib/components/StatCard.svelte';
  import Funnel from '$lib/components/Funnel.svelte';
  import MonthlyBarChart from '$lib/components/MonthlyBarChart.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import {
    dataset, kpis, funnel, roleStats, monthlyVolume, byState, bySource, recentActivity, syncState,
    STAGES, ROLES,
  } from '$lib/data/stores.js';

  function fmt(n) { return (n || 0).toLocaleString(); }
</script>

<svelte:head><title>Overview · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">Hiring portal</div>
    <h1 class="serif">Overview</h1>
    <p class="muted lead">
      {fmt($kpis.total)} candidates across {ROLES.length} roles and {STAGES.length} pipeline stages.
      {#if $syncState.status === 'ok'}<span class="ok-dot"></span>{:else if $syncState.status === 'error'}<span class="bad-dot"></span>{/if}
      <span class="muted">{$syncState.message || '—'}</span>
    </p>
  </div>
</header>

<section class="kpi-grid">
  <StatCard label="Total candidates" value={$kpis.total} kind="ink" />
  <StatCard label="Active in pipeline" value={$kpis.active} kind="brand" />
  <StatCard label="In final stages" value={$kpis.finals} kind="peach" />
  <StatCard label="Hired" value={$kpis.hired} kind="mauve" />
  <StatCard label="Rejected" value={$kpis.rejected} />
  <StatCard label="New this month" value={$kpis.thisMonth} />
</section>

<section class="row gap" style="margin-top:24px;align-items:flex-start">
  <div class="card pad-lg" style="flex:1;min-width:0">
    <div class="row between" style="align-items:center;margin-bottom:14px">
      <h2 class="serif" style="font-size:22px">Pipeline funnel</h2>
      <a class="btn ghost sm" href="{base}/pipeline">View pipeline →</a>
    </div>
    {#if $funnel.length && $funnel[0].count > 0}
      <Funnel stages={$funnel.map(s => ({ stage: s.label, count: s.count }))} accent="brand" />
    {:else}
      <EmptyState title="Funnel will populate after sync." body="Once candidates flow through stages, you'll see the carry-through chart here." />
    {/if}
  </div>

  <div class="card pad-lg" style="width:380px;flex-shrink:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">By role</h2>
    <div class="roles">
      {#each ROLES as r}
        {@const s = $roleStats[r] || { total:0, active:0, hired:0, rejected:0 }}
        <a class="role-row" href="{base}/roles/{r}">
          <div class="role-pill {r.toLowerCase()}">{r}</div>
          <div class="grow">
            <div class="role-total mono">{fmt(s.total)}</div>
            <div class="role-meta muted">
              <span class="ok">{fmt(s.active)} active</span> ·
              <span>{fmt(s.hired)} hired</span> ·
              <span>{fmt(s.rejected)} rejected</span>
            </div>
          </div>
          <div class="arrow">→</div>
        </a>
      {/each}
    </div>
  </div>
</section>

<section class="row gap" style="margin-top:24px;align-items:flex-start">
  <div class="card pad-lg" style="flex:1;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Application volume by month</h2>
    {#if $monthlyVolume.length}
      <MonthlyBarChart
        data={$monthlyVolume}
        series={[
          { key: 'PMA', label: 'PMA', color: 'var(--brand)' },
          { key: 'PM',  label: 'PM',  color: 'var(--mauve)' },
          { key: 'COS', label: 'COS', color: 'var(--olive)' },
          { key: 'BOA', label: 'BOA', color: 'var(--gold)' },
        ]}
      />
    {:else}
      <EmptyState title="No timestamped applications yet." />
    {/if}
  </div>

  <div class="card pad-lg" style="width:380px;flex-shrink:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Top states</h2>
    {#if $byState.length}
      <div class="state-list">
        {#each $byState.slice(0, 8) as st}
          {@const pct = st.total / $byState[0].total}
          <a class="state-row" href="{base}/locations/{encodeURIComponent(st.state)}">
            <div class="state-name">{st.state}</div>
            <div class="state-bar"><div class="state-fill" style="width:{Math.max(8, pct * 100)}%"></div></div>
            <div class="state-count mono">{fmt(st.total)}</div>
          </a>
        {/each}
      </div>
      <a class="btn ghost sm full" href="{base}/locations" style="margin-top:10px">All states & universities →</a>
    {:else}
      <EmptyState title="No state data yet." />
    {/if}
  </div>
</section>

<section class="row gap" style="margin-top:24px;align-items:flex-start">
  <div class="card pad-lg" style="flex:1.2;min-width:0">
    <div class="row between" style="margin-bottom:14px;align-items:center">
      <h2 class="serif" style="font-size:22px">Recent activity</h2>
      <span class="muted" style="font-size:12px">{$recentActivity.length} events</span>
    </div>
    {#if $recentActivity.length}
      <div class="feed">
        {#each $recentActivity.slice(0, 20) as ev}
          <a class="feed-row" href="{base}/candidates/{encodeURIComponent(ev.nameKey)}">
            <div class="feed-date mono">{ev.parsedDate?.toLocaleDateString() || '—'}</div>
            <div class="feed-stage">{STAGES.find(s => s.key === ev.stage)?.short || ev.stage}</div>
            <div class="feed-name grow">{ev.name}</div>
            <StatusPill decision={ev.decision} />
          </a>
        {/each}
      </div>
    {:else}
      <EmptyState title="Activity will appear as candidates move through stages." />
    {/if}
  </div>

  <div class="card pad-lg" style="flex:1;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Top sources</h2>
    {#if $bySource.length}
      <div class="src-list">
        {#each $bySource.slice(0, 10) as s}
          <div class="src-row">
            <div class="src-name">{s.source}</div>
            <div class="src-bar"><div class="src-fill" style="width:{Math.max(6, (s.total / $bySource[0].total) * 100)}%"></div></div>
            <div class="src-meta mono">
              <span>{fmt(s.total)}</span>
              {#if s.hired}<span class="ok">· {fmt(s.hired)} hired</span>{/if}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <EmptyState title="Source data will appear after sync." />
    {/if}
  </div>
</section>

<style>
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 14px;
    margin-top: 18px;
  }
  @media (max-width: 1280px) { .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 720px)  { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

  .lead { margin-top: 6px; max-width: 760px; }
  .ok-dot, .bad-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin: 0 4px 0 8px; vertical-align: middle; }
  .ok-dot { background: var(--ok); }
  .bad-dot { background: var(--bad); }

  .roles { display: flex; flex-direction: column; gap: 6px; }
  .role-row {
    display: flex; align-items: center; gap: 14px;
    padding: 12px 14px;
    border-radius: var(--r-md);
    border: 1px solid var(--line);
    background: var(--surface-soft);
    transition: all var(--t-fast) var(--ease);
  }
  .role-row:hover { border-color: var(--brand); background: var(--surface); transform: translateX(2px); }
  .role-pill {
    width: 48px; height: 48px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 13px; color: #fff;
    flex-shrink: 0;
  }
  .role-pill.pma { background: var(--brand); }
  .role-pill.pm  { background: var(--mauve); }
  .role-pill.cos { background: var(--olive); }
  .role-pill.boa { background: var(--gold); }
  .role-total { font-size: 18px; font-weight: 800; color: var(--ink); }
  .role-meta { font-size: 11px; margin-top: 2px; }
  .role-meta .ok { color: var(--ok); font-weight: 600; }
  .arrow { color: var(--ink-3); font-size: 16px; }

  .state-list { display: flex; flex-direction: column; gap: 4px; }
  .state-row {
    display: grid;
    grid-template-columns: 110px 1fr 48px;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border-radius: var(--r-sm);
    transition: background var(--t-fast) var(--ease);
  }
  .state-row:hover { background: var(--surface-soft); }
  .state-name { font-size: 13px; font-weight: 600; color: var(--ink-2); }
  .state-bar { height: 8px; background: var(--surface-sunk); border-radius: 4px; overflow: hidden; }
  .state-fill { height: 100%; background: linear-gradient(90deg, var(--brand), var(--brand-deep)); border-radius: 4px; }
  .state-count { text-align: right; font-size: 12px; font-weight: 700; }
  .btn.full { display: block; text-align: center; }

  .feed { display: flex; flex-direction: column; gap: 2px; max-height: 540px; overflow-y: auto; }
  .feed-row {
    display: grid;
    grid-template-columns: 100px 60px 1fr 100px;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: var(--r-sm);
    font-size: 13px;
    transition: background var(--t-fast) var(--ease);
  }
  .feed-row:hover { background: var(--surface-soft); }
  .feed-date { font-size: 11px; color: var(--ink-3); }
  .feed-stage {
    font-size: 10.5px; font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--brand-soft);
    color: var(--brand-deep);
    text-align: center;
  }
  .feed-name { font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .src-list { display: flex; flex-direction: column; gap: 6px; }
  .src-row {
    display: grid;
    grid-template-columns: 130px 1fr 140px;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
  }
  .src-name { font-size: 12px; font-weight: 600; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .src-bar { height: 8px; background: var(--surface-sunk); border-radius: 4px; overflow: hidden; }
  .src-fill { height: 100%; background: linear-gradient(90deg, var(--mauve), var(--mauve-deep)); }
  .src-meta { text-align: right; font-size: 11px; color: var(--ink-2); font-weight: 600; }
  .src-meta .ok { color: var(--ok); }
</style>
