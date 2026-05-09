<script>
  import { data, planProgress, stateSummary } from '$lib/data/stores.js';
  import { page } from '$app/stores';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import StatCard from '$lib/components/StatCard.svelte';
  import Donut from '$lib/components/Donut.svelte';
  import Filters from '$lib/components/Filters.svelte';
  import { filters } from '$lib/data/stores.js';
  import { onMount } from 'svelte';

  onMount(() => {
    const s = $page.url.searchParams.get('state');
    if (s) filters.update(f => ({ ...f, state: s }));
  });

  $: planRows = $data.plan.filter(p =>
    (!$filters.state || p.state === $filters.state) &&
    (!$filters.role  || p.role === $filters.role) &&
    (!$filters.university || p.location === $filters.university)
  );

  $: hasCtc = planRows.some(p => p.ctcPerPosition);

  $: byState = (() => {
    const m = new Map();
    for (const p of planRows) {
      if (!m.has(p.state)) m.set(p.state, { state: p.state, positions: 0, hired: 0, universities: new Set(), roles: {}, totalCtc: 0 });
      const s = m.get(p.state);
      s.positions += p.positions;
      if (p.hired) s.hired += p.positions;
      s.universities.add(p.location);
      s.roles[p.role] = (s.roles[p.role] || 0) + p.positions;
      s.totalCtc += (p.totalCtc || 0);
    }
    return [...m.values()].map(s => ({ ...s, universities: [...s.universities] }));
  })();

  $: totals = {
    positions: planRows.reduce((s, p) => s + p.positions, 0),
    hired: planRows.reduce((s, p) => s + (p.hired ? p.positions : 0), 0),
    states: byState.length,
    universities: new Set(planRows.map(p => p.location)).size,
    roles: new Set(planRows.map(p => p.role)).size,
    totalCtc: planRows.reduce((s, p) => s + (p.totalCtc || 0), 0),
  };

  $: roleSummary = (() => {
    const m = new Map();
    for (const p of planRows) {
      if (!m.has(p.role)) m.set(p.role, 0);
      m.set(p.role, m.get(p.role) + p.positions);
    }
    return [...m.entries()].map(([role, count]) => ({ role, count })).sort((a,b) => b.count - a.count);
  })();

  function fmtCtc(n) {
    if (!n) return '—';
    const r = Math.round(n * 10) / 10;
    if (r >= 100) return `₹${(r / 100).toFixed(2)} Cr`;
    return `₹${r.toFixed(1)} L`;
  }

  function fmtCtcShort(n) {
    if (!n) return '—';
    const r = Math.round(n * 10) / 10;
    if (r >= 100) return `₹${(r / 100).toFixed(1)}Cr`;
    // Drop trailing .0 (₹36.0L → ₹36L) for cleaner display
    return Number.isInteger(r) ? `₹${r}L` : `₹${r.toFixed(1)}L`;
  }

  // Group plan rows by (state, university, role, type) so we don't show
  // the same combo on multiple lines just because the source sheet had one
  // row per individual position. This collapses N "1-position" rows into
  // a single row with `positions: N`.
  $: groupedPlan = (() => {
    const m = new Map();
    for (const p of planRows) {
      const key = `${p.state}||${p.location}||${p.role}||${p.type}`;
      if (!m.has(key)) {
        m.set(key, {
          state: p.state,
          location: p.location,
          role: p.role,
          type: p.type,
          ctcPerPosition: p.ctcPerPosition || 0,
          positions: 0,
          hired: 0,
          totalCtc: 0,
        });
      }
      const g = m.get(key);
      g.positions += p.positions;
      if (p.hired) g.hired += p.positions;
      g.totalCtc += (p.totalCtc || 0);
      if (p.ctcPerPosition && p.ctcPerPosition > g.ctcPerPosition) g.ctcPerPosition = p.ctcPerPosition;
    }
    return [...m.values()].sort((a, b) => {
      if (a.state !== b.state) return a.state.localeCompare(b.state);
      if (a.location !== b.location) return a.location.localeCompare(b.location);
      return a.role.localeCompare(b.role);
    });
  })();

  // Column widths for the data grid (drop the meaningless S.No, replace with row index)
  $: gridCols = hasCtc
    ? '50px 140px minmax(220px, 1.4fr) 130px 92px 80px 100px 100px 130px'
    : '50px 140px minmax(220px, 1.4fr) 130px 92px 80px 130px';
</script>

<svelte:head><title>Plan vs Actual · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">Hiring plan</div>
    <h1>Plan vs <span class="accent">actual.</span></h1>
  </div>
  <Filters />
</header>

<section class="kpi-grid stagger">
  <StatCard label="Total positions" value={totals.positions} kind="brand" />
  <StatCard label="Hired" value={totals.hired} kind="ink" delta={totals.positions ? Math.round((totals.hired / totals.positions) * 100) + '% of plan' : ''} />
  <StatCard label="States" value={totals.states} kind="peach" delta={`${totals.universities} universities`} />
  {#if hasCtc}
    <StatCard label="CTC budget" value={totals.totalCtc} format={fmtCtc} kind="mauve" delta="annual run-rate" />
  {:else}
    <StatCard label="Universities" value={totals.universities} kind="mauve" />
  {/if}
</section>

<section class="split">
  <div class="card pad">
    <div class="section-h">
      <div class="title"><h2>Roles in plan</h2><span class="count">{roleSummary.length}</span></div>
    </div>
    <div class="role-grid">
      {#each roleSummary as r, i (r.role)}
        <div class="role-card" in:fly={{ y: 12, delay: i * 50, duration: 400, easing: quintOut }}>
          <Donut value={r.count} max={totals.positions} size={104} stroke={11} color="var(--brand)" label={String(r.count)} sublabel={r.role} />
        </div>
      {/each}
    </div>
  </div>

  <div class="card pad">
    <div class="section-h">
      <div class="title"><h2>By state</h2><span class="count">{byState.length}</span></div>
    </div>
    <div class="state-list">
      {#each byState.sort((a,b) => b.positions - a.positions) as s, i (s.state)}
        <div class="state-row" in:fly={{ y: 8, delay: i * 30, duration: 400, easing: quintOut }}>
          <div class="grow">
            <div class="row gap-sm" style="margin-bottom:6px">
              <strong style="font-weight:700;font-size:14px">{s.state}</strong>
              <span style="color:var(--ink-3);font-size:12px">·</span>
              <span style="color:var(--ink-3);font-size:12px">{s.universities.length} universities</span>
              {#if s.hired}<span class="pill ok">{s.hired} hired</span>{/if}
            </div>
            <div class="row gap-sm" style="flex-wrap:wrap">
              {#each Object.entries(s.roles) as [role, n]}
                <span class="pill outline">{role} · {n}</span>
              {/each}
            </div>
          </div>
          <div style="text-align:right">
            <div class="display big-num">{s.positions}</div>
            {#if s.totalCtc}<div class="mono" style="font-size:11px;color:var(--ink-3);font-weight:600">{fmtCtc(s.totalCtc)}</div>{/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- Detailed plan as CSS Grid (reliable column widths) -->
<section class="card pad" style="margin-top:24px">
  <div class="section-h">
    <div class="title">
      <h2>Detailed plan</h2>
      <span class="count">{groupedPlan.length} {groupedPlan.length === 1 ? 'role' : 'roles'} · {totals.positions} positions</span>
    </div>
  </div>

  <div class="dgrid-wrap">
    <div class="dgrid" style="--cols: {gridCols}">
      <!-- Header row -->
      <div class="dgrid-row head">
        <div class="dcell">#</div>
        <div class="dcell">State</div>
        <div class="dcell">University</div>
        <div class="dcell">Type</div>
        <div class="dcell">Role</div>
        <div class="dcell num">Positions</div>
        {#if hasCtc}
          <div class="dcell num">CTC/pos</div>
          <div class="dcell num">Total</div>
        {/if}
        <div class="dcell">Status</div>
      </div>

      {#each groupedPlan as g, i (g.state + g.location + g.role)}
        {@const open = g.positions - g.hired}
        <div class="dgrid-row" in:fly={{ y: 4, delay: Math.min(i, 30) * 6, duration: 240 }}>
          <div class="dcell mono" style="color:var(--ink-3)"><span class="truncate">{i + 1}</span></div>
          <div class="dcell" style="font-weight:700"><span class="truncate" title={g.state}>{g.state}</span></div>
          <div class="dcell"><span class="truncate" title={g.location}>{g.location}</span></div>
          <div class="dcell"><span class="pill outline">{g.type}</span></div>
          <div class="dcell"><span class="pill brand">{g.role}</span></div>
          <div class="dcell num display" style="font-size:16px;font-weight:700"><span class="truncate">{g.positions}</span></div>
          {#if hasCtc}
            <div class="dcell num mono"><span class="truncate">{fmtCtcShort(g.ctcPerPosition)}</span></div>
            <div class="dcell num mono" style="font-weight:700"><span class="truncate">{fmtCtcShort(g.totalCtc)}</span></div>
          {/if}
          <div class="dcell">
            {#if g.hired === g.positions && g.positions > 0}
              <span class="pill ok">All hired</span>
            {:else if g.hired > 0}
              <span class="pill warn">{g.hired}/{g.positions} hired</span>
            {:else}
              <span class="pill">Open</span>
            {/if}
          </div>
        </div>
      {:else}
        <div class="dgrid-row">
          <div class="dcell" style="grid-column: 1 / -1; justify-content: center; color: var(--muted)">No plan rows match.</div>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--s-4); }
  @media (max-width: 1100px) { .split { grid-template-columns: 1fr; } }

  .role-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: var(--s-4);
  }
  .role-card { display: flex; justify-content: center; }

  .state-list { display: flex; flex-direction: column; gap: 2px; max-height: 480px; overflow: auto; padding-right: 4px; }
  .state-row {
    display: flex; align-items: center; gap: 16px;
    padding: 12px 14px;
    border-radius: 12px;
    transition: background var(--t-fast) var(--ease);
  }
  .state-row:hover { background: var(--brand-soft-2); }
  .big-num { font-size: 28px; line-height: 1; font-weight: 700; letter-spacing: -0.02em; }
</style>
