<script>
  import { data, planProgress, stateSummary, syncState, monthlyTrend, recentFeed, config } from '$lib/data/stores.js';
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import StatCard from '$lib/components/StatCard.svelte';
  import UniversityCard from '$lib/components/UniversityCard.svelte';
  import IndiaMap from '$lib/components/IndiaMap.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import InterviewChart from '$lib/components/InterviewChart.svelte';
  import Filters from '$lib/components/Filters.svelte';
  import { filters } from '$lib/data/stores.js';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';

  $: hasData = $data.candidates.length || $data.activities.length || $data.plan.length;
  $: notConnected = !$config.sheetUrl;

  let activeUniversity = '';

  $: universities = (() => {
    const byKey = new Map();
    for (const p of $data.plan) {
      const k = `${p.state}::${p.location}`;
      if (!byKey.has(k)) byKey.set(k, {
        name: p.location, state: p.state, type: p.type,
        positions: 0, hired: 0, totalCtc: 0, roles: {}
      });
      const u = byKey.get(k);
      u.positions += p.positions;
      if (p.hired) u.hired += p.positions;
      u.totalCtc += (p.totalCtc || 0);
      u.roles[p.role] = (u.roles[p.role] || 0) + p.positions;
    }
    return [...byKey.values()].sort((a, b) => b.positions - a.positions);
  })();

  $: filtered = universities.filter(u =>
    (!$filters.state || u.state === $filters.state) &&
    (!$filters.role  || Object.keys(u.roles).includes($filters.role)) &&
    (!$filters.university || u.name === $filters.university)
  );

  $: trendData = $monthlyTrend.slice(-12);

  $: kpis = (() => {
    const t = $planProgress.totals;
    const masterFilled = $data.candidates.filter(c => (c.__joiningStatus || '').toLowerCase() === 'joined').length;
    const inPipe = $data.activities.filter(a => a.decision === 'selected' || a.decision === 'hold').length;
    return {
      states: new Set($data.plan.map(p => p.state)).size,
      universities: new Set($data.plan.map(p => p.location)).size,
      positions: t.positions,
      hired: Math.max(t.filled || 0, masterFilled),
      open: (t.positions || 0) - Math.max(t.filled || 0, masterFilled),
      pipeline: inPipe,
      totalCtc: t.totalCtc || 0,
    };
  })();

  function fmtCtc(n) {
    if (!n) return '—';
    if (n >= 100) return `₹${(n / 100).toFixed(2)} Cr`;
    return `₹${Math.round(n)} L`;
  }
</script>

<svelte:head><title>Dashboard · Hiring Portal</title></svelte:head>

{#if notConnected}
  <section class="hero card pad-lg fade-up" style="background:linear-gradient(135deg, var(--brand-soft) 0%, var(--surface) 100%);border-color:var(--brand)">
    <div style="max-width:680px">
      <div class="pill" style="background:var(--ink);color:var(--brand-soft);margin-bottom:18px;padding:6px 14px">⚡ Get started</div>
      <h1 class="display" style="font-size:var(--t-display);margin-bottom:18px;color:var(--ink)">
        Hire with <span style="background:var(--brand);padding:0 8px;border-radius:8px;color:#fff">intent.</span><br/>
        See the entire pipeline.
      </h1>
      <p class="muted" style="font-size:17px;line-height:1.55;margin-bottom:28px;color:var(--ink-3)">
        Connect your master tracker and weekly activity sheet — the portal will visualize plan vs. actuals across every state, university, and role for the cycle.
      </p>
      <a href="{base}/settings" class="btn brand lg">Connect your sheets →</a>
    </div>
  </section>

{:else if !hasData && $syncState.status === 'syncing'}
  <div class="kpi-grid">
    {#each Array(4) as _, i}
      <div class="skeleton" style="height:152px;animation-delay:{i*60}ms"></div>
    {/each}
  </div>
  <div class="skeleton" style="height:520px"></div>

{:else if !hasData}
  <EmptyState
    title="No data loaded yet"
    body="The sheets are connected, but no rows came back. Check that the tabs have content and that the share permission allows access."
    actionLabel="Open Settings"
    actionHref="/settings"
  />

{:else}

<header class="page-head fade-up">
  <div>
    <div class="crumb">Hiring · 2026 cycle</div>
    <h1>Where are we, <span class="accent">today.</span></h1>
  </div>
  <Filters />
</header>

<!-- Bento KPI strip — mixed solid color cards -->
<section class="kpi-grid stagger">
  <StatCard label="Total positions" value={kpis.positions} kind="brand" delta={`${kpis.universities} unis · ${kpis.states} states`} icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>' />
  <StatCard label="Hired" value={kpis.hired} kind="ink" delta={`${kpis.positions ? Math.round((kpis.hired / kpis.positions) * 100) : 0}% of plan`} icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round"/></svg>' />
  <StatCard label="Open" value={kpis.open} kind="peach" delta="positions to fill" icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>' />
  {#if kpis.totalCtc > 0}
    <StatCard label="CTC budget" value={kpis.totalCtc} format={fmtCtc} kind="mauve" delta="annual run-rate" icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>' />
  {:else}
    <StatCard label="In pipeline" value={kpis.pipeline} kind="mauve" delta="across all roles" icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M8 6h8M8 18h8M8 6c0 8 8 4 8 12M8 18c0-8 8-4 8-12"/></svg>' />
  {/if}
</section>

<!-- Map row — full width, dominant -->
<section class="card fade-up" style="padding:0;overflow:hidden;margin-bottom:32px;animation-delay:200ms">
  <div class="map-section">
    <div class="map-info">
      <div class="crumb">Geography</div>
      <h2 class="display" style="font-size:var(--t-h2);margin-top:6px;margin-bottom:14px">Where we hire across India</h2>
      <p class="muted" style="font-size:13.5px;line-height:1.55;margin-bottom:20px;color:var(--ink-3)">
        Each pin is a partner university. Larger pins = more positions. Hover to see roles, hires, and CTC. States with active hiring are tinted lime.
      </p>
      <div class="map-tags">
        {#each [...new Set(filtered.map(u => u.state))].sort() as state}
          <span class="pill brand">{state}</span>
        {/each}
      </div>
    </div>
    <div class="map-canvas">
      <IndiaMap
        universities={universities}
        activeState={$filters.state}
        {activeUniversity}
        onSelect={(u) => activeUniversity = activeUniversity === u.name ? '' : u.name}
        onSelectState={(s) => filters.update(f => ({ ...f, state: s }))}
      />
    </div>
  </div>
</section>

<!-- University locations grid -->
<section class="fade-up" style="animation-delay:300ms">
  <div class="section-h">
    <div class="title">
      <h2>University locations</h2>
      <span class="count">{filtered.length} of {universities.length}</span>
    </div>
    <div class="actions">
      {#if activeUniversity}
        <button class="btn ghost sm" on:click={() => activeUniversity = ''}>
          <span class="dot live"></span> {activeUniversity}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      {/if}
      <a href="{base}/plan" class="btn ghost sm">All plan →</a>
    </div>
  </div>

  {#if filtered.length}
    <div class="uni-grid">
      {#each filtered.slice(0, 12) as u, i (u.state + u.name)}
        <UniversityCard
          university={u}
          active={activeUniversity === u.name}
          index={i}
          onSelect={() => goto(`${base}/plan?state=${encodeURIComponent(u.state)}`)}
        />
      {/each}
    </div>
    {#if filtered.length > 12}
      <div style="text-align:center;margin-top:24px">
        <a href="{base}/plan" class="btn">View all {filtered.length} locations →</a>
      </div>
    {/if}
  {:else}
    <div class="empty">No universities match the current filters.</div>
  {/if}
</section>

<!-- Bottom row: trend + recent activity -->
<section class="bottom-row fade-up" style="animation-delay:400ms">
  <div class="card pad">
    <div class="row between" style="margin-bottom:14px">
      <div>
        <div class="crumb">Last 12 months</div>
        <div class="display" style="font-size:20px;margin-top:4px;font-weight:700">Interview volume</div>
      </div>
      <a href="{base}/analytics" class="btn ghost sm">Trends →</a>
    </div>
    <InterviewChart data={trendData} height={200} color="var(--brand)" colorDeep="var(--brand-deep)" />
  </div>

  <div class="card pad">
    <div class="row between" style="margin-bottom:14px">
      <div class="display" style="font-size:20px;font-weight:700">Recent activity</div>
      <a href="{base}/candidates" class="btn ghost sm">All →</a>
    </div>
    <div class="feed">
      {#each $recentFeed.slice(0, 5) as e, i (i + (e.name || '') + e.stage)}
        <div class="feed-row" in:fly={{ y: 6, delay: i * 30, duration: 320, easing: quintOut }}>
          <div class="feed-dot {e.decision || ''}"></div>
          <div class="feed-text">
            <div class="feed-name">{e.name || '—'}</div>
            <div class="feed-meta">{e.role} {e.stage} · {e.parsedDate?.toLocaleDateString() || e.date}</div>
          </div>
          <StatusPill decision={e.decision} />
        </div>
      {:else}
        <div class="empty">No activity yet.</div>
      {/each}
    </div>
  </div>
</section>

{/if}

<style>
  .hero { animation: fadeUp 600ms var(--ease) backwards; }

  /* Map section: side-by-side info + canvas */
  .map-section {
    display: grid;
    grid-template-columns: 320px 1fr;
    min-height: 540px;
  }
  @media (max-width: 1100px) {
    .map-section { grid-template-columns: 1fr; }
  }
  .map-info {
    padding: 32px;
    border-right: 1px solid var(--line);
    display: flex; flex-direction: column;
    background: var(--surface);
  }
  @media (max-width: 1100px) {
    .map-info { border-right: 0; border-bottom: 1px solid var(--line); }
  }
  .map-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: auto; }
  .map-canvas { padding: 24px; min-height: 540px; }
  @media (max-width: 1100px) { .map-canvas { min-height: 460px; } }

  /* University grid */
  .uni-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: var(--s-4);
  }
  @media (max-width: 700px) { .uni-grid { grid-template-columns: 1fr; } }

  /* Bottom row */
  .bottom-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--s-4);
    margin-top: var(--s-7);
  }
  @media (max-width: 900px) { .bottom-row { grid-template-columns: minmax(0, 1fr); } }

  .feed {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    min-width: 0;
    overflow: hidden;
  }
  .feed-row {
    display: grid;
    grid-template-columns: 8px minmax(0, 1fr) max-content;
    align-items: center;
    gap: 10px;
    padding: 8px 6px;
    border-radius: 10px;
    transition: background var(--t-fast) var(--ease);
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    overflow: hidden;
  }
  .feed-row:hover { background: var(--brand-soft-2); }
  .feed-dot { width: 8px; height: 8px; border-radius: 99px; background: var(--muted-2); }
  .feed-dot.selected { background: var(--ok); }
  .feed-dot.rejected { background: var(--bad); }
  .feed-dot.hold { background: var(--warn); }
  .feed-dot.rescheduled { background: var(--mauve); }

  .feed-text {
    min-width: 0;
    overflow: hidden;
  }
  .feed-name {
    font-size: 13px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .feed-meta {
    font-size: 11px;
    color: var(--ink-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
