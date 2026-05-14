<script>
  import {
    sourceStats, peopleStats, monthlyTrend, queues, data,
    summaryFunnel, dropoff, funnel, planProgress
  } from '$lib/data/stores.js';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import StatCard from '$lib/components/StatCard.svelte';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import Donut from '$lib/components/Donut.svelte';
  import Funnel from '$lib/components/Funnel.svelte';
  import InterviewChart from '$lib/components/InterviewChart.svelte';
  import { base } from '$app/paths';

  $: roleStats = $data.roleStats || {};
  $: roles = Object.keys(roleStats);
  $: hasMaster = roles.length > 0;

  $: months = $monthlyTrend;
  $: monthSeries = {
    sourced: months.map(m => m.sourced),
    interviewed: months.map(m => m.interviewed),
    selected: months.map(m => m.selected),
    joined: months.map(m => m.joined),
  };

  $: maxSrc = Math.max(1, ...$sourceStats.map(s => s.total));

  // Per-role compact cards
  $: roleCards = roles.map(role => {
    const s = roleStats[role];
    return {
      role,
      resumes: s.resumesTotal || 0,
      selected: s.resumesSelected || 0,
      r1: s.r1Total || 0,
      r1sel: s.r1Selected || 0,
      r2: s.r2Total || 0,
      r2sel: s.r2Selected || 0,
      r3: s.r3Total || 0,
      r3sel: s.r3Selected || 0,
      conv: (s.resumesTotal || 0) ? Math.round((((s.r3Selected || 0) + (s.r2Selected || 0) + (s.r1Selected || 0)) / s.resumesTotal) * 100) : 0,
    };
  });

  $: globalTotals = roleCards.reduce((acc, r) => ({
    resumes: acc.resumes + r.resumes,
    interviews: acc.interviews + r.r1 + r.r2 + r.r3,
    selected: acc.selected + r.r1sel + r.r2sel + r.r3sel,
  }), { resumes: 0, interviews: 0, selected: 0 });

  let tab = 'overview';
  const tabs = [
    { id: 'overview',  label: 'Overview' },
    { id: 'locations', label: 'Locations' },
    { id: 'sources',   label: 'Sources' },
    { id: 'team',      label: 'Team' },
    { id: 'trends',    label: 'Trends' },
    { id: 'queues',    label: 'Queues' },
  ];

  let locView = 'states'; // 'states' | 'universities'

  function fmtPct(n) { return Math.round(n) + '%'; }

  // -- Derived stats for the new Overview --

  $: planTotals = $planProgress.totals;
  $: hiredCount = planTotals.filled || 0;

  // Pipeline health: outcome breakdown across ALL tracker events
  $: pipelineHealth = (() => {
    const acc = { selected: 0, hold: 0, rescheduled: 0, pending: 0, rejected: 0 };
    for (const a of $data.activities) {
      const d = a.decision || 'pending';
      if (d in acc) acc[d]++;
      else if (d === 'other') acc.pending++;
    }
    return acc;
  })();
  $: pipelineHealthTotal = Object.values(pipelineHealth).reduce((s, n) => s + n, 0);

  // Pre-computed donut segments (avoids {@const} inside <svg> which Svelte 5 disallows)
  const DONUT_C = 2 * Math.PI * 48;
  $: donutSegments = (() => {
    const items = [
      { val: pipelineHealth.selected, color: 'var(--olive)' },
      { val: pipelineHealth.hold, color: 'var(--warn)' },
      { val: pipelineHealth.rescheduled, color: 'var(--mauve)' },
      { val: pipelineHealth.pending, color: 'var(--ink-3)' },
      { val: pipelineHealth.rejected, color: 'var(--brand)' },
    ];
    const total = Math.max(1, items.reduce((s, x) => s + x.val, 0));
    let cum = 0;
    return items.map(it => {
      const arc = (it.val / total) * DONUT_C;
      const offset = -(cum / total) * DONUT_C;
      cum += it.val;
      return { ...it, arc, offset };
    });
  })();

  const healthLegendItems = [
    { key: 'selected', label: 'Selected', color: 'var(--olive)' },
    { key: 'hold', label: 'Hold', color: 'var(--warn)' },
    { key: 'rescheduled', label: 'Rescheduled', color: 'var(--mauve)' },
    { key: 'pending', label: 'Pending', color: 'var(--ink-3)' },
    { key: 'rejected', label: 'Rejected', color: 'var(--brand)' },
  ];

  // Per-role × per-stage matrix (Sourced → Shortlist → R1 → R2 → R3)
  $: stageMatrix = roleCards.map(r => {
    const rows = [
      { stage: 'Sourced',    count: r.resumes,            base: r.resumes },
      { stage: 'Shortlist',  count: r.selected,           base: r.resumes },
      { stage: 'R1 selected', count: r.r1sel,             base: r.r1 || r.selected },
      { stage: 'R2 selected', count: r.r2sel,             base: r.r2 || r.r1sel },
    ];
    if (r.r3 > 0 || r.r3sel > 0) {
      rows.push({ stage: 'R3 selected', count: r.r3sel, base: r.r3 || r.r2sel });
    }
    return {
      role: r.role,
      conv: r.conv,
      stages: rows.map((row, i) => ({
        ...row,
        carry: i === 0 ? 100 : (rows[i - 1].count ? Math.round((row.count / rows[i - 1].count) * 100) : 0),
      })),
    };
  });

  // Auto-extracted INSIGHTS
  $: insights = (() => {
    const out = [];
    if (!roleCards.length) return out;

    // Best converting role
    const sorted = [...roleCards].filter(r => r.resumes > 0).sort((a, b) => b.conv - a.conv);
    if (sorted[0]) {
      out.push({
        kind: 'best',
        title: 'Top converting role',
        value: sorted[0].role,
        sub: `${sorted[0].conv}% top→final · ${sorted[0].r1sel + sorted[0].r2sel + sorted[0].r3sel} selected from ${sorted[0].resumes} resumes`,
      });
    }
    if (sorted.length > 1) {
      const worst = sorted[sorted.length - 1];
      out.push({
        kind: 'worst',
        title: 'Weakest funnel',
        value: worst.role,
        sub: `${worst.conv}% top→final · ${worst.resumes} resumes, ${worst.r1sel + worst.r2sel + worst.r3sel} reached final`,
      });
    }

    // Biggest stage drop-off across all roles
    let biggestDrop = null;
    for (const r of roleCards) {
      const stages = [
        { name: 'Resume → Shortlist', from: r.resumes, to: r.selected },
        { name: 'Shortlist → R1',     from: r.selected, to: r.r1 },
        { name: 'R1 done → R1 sel',   from: r.r1,       to: r.r1sel },
        { name: 'R1 sel → R2 done',   from: r.r1sel,    to: r.r2 },
        { name: 'R2 done → R2 sel',   from: r.r2,       to: r.r2sel },
      ];
      for (const s of stages) {
        if (s.from < 5) continue;
        const dropPct = ((s.from - s.to) / s.from) * 100;
        if (!biggestDrop || dropPct > biggestDrop.dropPct) {
          biggestDrop = { ...s, dropPct, role: r.role };
        }
      }
    }
    if (biggestDrop) {
      out.push({
        kind: 'bottleneck',
        title: 'Biggest bottleneck',
        value: `${biggestDrop.role} · ${biggestDrop.name}`,
        sub: `${Math.round(biggestDrop.dropPct)}% drop-off · ${biggestDrop.from - biggestDrop.to} of ${biggestDrop.from} candidates lost here`,
      });
    }

    // Top hiring state
    const stateMap = new Map();
    for (const p of $data.plan) {
      if (!stateMap.has(p.state)) stateMap.set(p.state, { state: p.state, positions: 0, hired: 0 });
      const s = stateMap.get(p.state);
      s.positions += p.positions;
      if (p.hired) s.hired += p.positions;
    }
    const topState = [...stateMap.values()].sort((a, b) => b.hired - a.hired || b.positions - a.positions)[0];
    if (topState && topState.hired > 0) {
      out.push({
        kind: 'state',
        title: 'Most hires in',
        value: topState.state,
        sub: `${topState.hired} hired of ${topState.positions} planned positions`,
      });
    }

    return out;
  })();

  // State breakdown for horizontal bar chart
  $: stateBars = (() => {
    const m = new Map();
    for (const p of $data.plan) {
      if (!m.has(p.state)) m.set(p.state, { state: p.state, positions: 0, hired: 0 });
      const s = m.get(p.state);
      s.positions += p.positions;
      if (p.hired) s.hired += p.positions;
    }
    const arr = [...m.values()].sort((a, b) => b.positions - a.positions);
    const max = Math.max(1, ...arr.map(s => s.positions));
    return arr.map(s => ({ ...s, pct: (s.positions / max) * 100, hirePct: (s.hired / max) * 100 }));
  })();

  // Top universities by hire progress
  $: topUniversities = (() => {
    const m = new Map();
    for (const p of $data.plan) {
      const k = `${p.state}::${p.location}`;
      if (!m.has(k)) m.set(k, { name: p.location, state: p.state, positions: 0, hired: 0 });
      const u = m.get(k);
      u.positions += p.positions;
      if (p.hired) u.hired += p.positions;
    }
    return [...m.values()]
      .map(u => ({ ...u, progress: u.positions ? Math.round((u.hired / u.positions) * 100) : 0 }))
      .sort((a, b) => b.progress - a.progress || b.hired - a.hired);
  })();
  function fmtCtc(n) {
    if (!n) return '—';
    const r = Math.round(n * 10) / 10;
    if (r >= 100) return `₹${(r / 100).toFixed(2)} Cr`;
    return `₹${r.toFixed(1)} L`;
  }

  // -- State-wise rollup from the hiring plan --
  $: stateRows = (() => {
    const m = new Map();
    for (const p of $data.plan) {
      if (!m.has(p.state)) m.set(p.state, {
        state: p.state,
        positions: 0,
        hired: 0,
        totalCtc: 0,
        universities: new Set(),
        roles: {},
      });
      const s = m.get(p.state);
      s.positions += p.positions;
      if (p.hired) s.hired += p.positions;
      s.totalCtc += (p.totalCtc || 0);
      s.universities.add(p.location);
      const baseRole = (p.role || '').replace(/[0-9]+$/, '');
      s.roles[baseRole] = (s.roles[baseRole] || 0) + p.positions;
    }
    return [...m.values()].map(s => ({
      ...s,
      universityCount: s.universities.size,
      open: s.positions - s.hired,
      progress: s.positions ? Math.round((s.hired / s.positions) * 100) : 0,
      avgCtcPerPos: s.positions ? s.totalCtc / s.positions : 0,
    })).sort((a, b) => b.positions - a.positions);
  })();

  $: statePositionsMax = Math.max(1, ...stateRows.map(s => s.positions));

  // -- University-wise rollup --
  $: uniRows = (() => {
    const m = new Map();
    for (const p of $data.plan) {
      const k = `${p.state}::${p.location}`;
      if (!m.has(k)) m.set(k, {
        name: p.location,
        state: p.state,
        type: p.type,
        positions: 0,
        hired: 0,
        totalCtc: 0,
        roles: {},
      });
      const u = m.get(k);
      u.positions += p.positions;
      if (p.hired) u.hired += p.positions;
      u.totalCtc += (p.totalCtc || 0);
      const baseRole = (p.role || '').replace(/[0-9]+$/, '');
      u.roles[baseRole] = (u.roles[baseRole] || 0) + p.positions;
    }
    return [...m.values()].map(u => ({
      ...u,
      open: u.positions - u.hired,
      progress: u.positions ? Math.round((u.hired / u.positions) * 100) : 0,
    })).sort((a, b) => b.positions - a.positions);
  })();

  $: uniPositionsMax = Math.max(1, ...uniRows.map(u => u.positions));

  $: locTotals = {
    states: stateRows.length,
    universities: uniRows.length,
    positions: stateRows.reduce((s, r) => s + r.positions, 0),
    hired: stateRows.reduce((s, r) => s + r.hired, 0),
    totalCtc: stateRows.reduce((s, r) => s + r.totalCtc, 0),
  };
</script>

<svelte:head><title>Analytics · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">Insight</div>
    <h1>Analytics</h1>
  </div>
  <div class="tabs">
    {#each tabs as t}
      <button class="tab" class:active={tab === t.id} on:click={() => tab = t.id}>{t.label}</button>
    {/each}
  </div>
</header>

{#if tab === 'overview'}
  <section in:fly={{ y: 8, duration: 320 }}>

    <!-- KPI strip -->
    <div class="kpi-grid stagger">
      <StatCard label="Resumes reviewed" value={globalTotals.resumes} kind="brand" delta="across all roles" />
      <StatCard label="Interviews conducted" value={globalTotals.interviews} kind="ink" delta="R1 + R2 + R3" />
      <StatCard label="Final selections" value={globalTotals.selected} kind="peach" delta={globalTotals.resumes ? fmtPct(globalTotals.selected / globalTotals.resumes * 100) + ' conversion' : ''} />
      <StatCard label="Positions hired" value={hiredCount} kind="mauve" delta={planTotals.positions ? fmtPct(hiredCount / planTotals.positions * 100) + ' of plan filled' : ''} />
    </div>

    <!-- Auto-extracted insights -->
    {#if insights.length}
      <div class="insight-grid stagger" style="margin-top: 20px">
        {#each insights as ins, i (ins.kind)}
          <div class="insight-card insight-{ins.kind}" in:fly={{ y: 8, delay: i * 60, duration: 380, easing: quintOut }}>
            <div class="ins-icon">
              {#if ins.kind === 'best'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 22l2-7L2 11h7l3-9z"/></svg>
              {:else if ins.kind === 'worst'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>
              {:else if ins.kind === 'bottleneck'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/></svg>
              {:else if ins.kind === 'state'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-7 7-13a7 7 0 1 0-14 0c0 6 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>
              {/if}
            </div>
            <div class="ins-body">
              <div class="ins-title">{ins.title}</div>
              <div class="ins-value display">{ins.value}</div>
              <div class="ins-sub">{ins.sub}</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Role × Stage matrix table -->
    {#if hasMaster}
      <div class="card pad-lg" style="margin-top: 20px">
        <div class="section-h" style="margin-bottom:14px">
          <div class="title">
            <h2>Pipeline matrix</h2>
            <span class="count">role × stage with carry-through %</span>
          </div>
        </div>
        <div class="matrix-wrap">
          <div class="matrix">
            <!-- Header row -->
            <div class="m-cell m-corner">Role</div>
            {#each stageMatrix[0]?.stages || [] as s}
              <div class="m-cell m-head">{s.stage}</div>
            {/each}
            <div class="m-cell m-head conv-h">Top→Final</div>

            <!-- Data rows -->
            {#each stageMatrix as r, ri (r.role)}
              <div class="m-cell m-role">
                <span class="pill solid">{r.role}</span>
              </div>
              {#each r.stages as s, si}
                <div class="m-cell m-data" class:weak={s.carry < 30 && si > 0} class:strong={s.carry >= 60 && si > 0}>
                  <div class="m-num display">{s.count}</div>
                  {#if si > 0}
                    <div class="m-carry">
                      {#if s.carry >= 60}
                        <span class="carry-arrow good">↘</span>
                      {:else if s.carry >= 30}
                        <span class="carry-arrow ok">↘</span>
                      {:else}
                        <span class="carry-arrow bad">↘</span>
                      {/if}
                      {s.carry}%
                    </div>
                  {/if}
                </div>
              {/each}
              <div class="m-cell m-conv">
                <div class="m-num display brand">{r.conv}%</div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- State breakdown bar chart -->
    {#if stateBars.length}
      <div class="card pad-lg" style="margin-top: 20px">
        <div class="section-h" style="margin-bottom:14px">
          <div class="title">
            <h2>State breakdown</h2>
            <span class="count">positions planned vs hired</span>
          </div>
          <div class="row gap-sm">
            <span class="trend-key"><span class="tk-swatch" style="background:var(--brand-soft-2);outline:1px solid var(--brand)"></span>Planned</span>
            <span class="trend-key"><span class="tk-swatch" style="background:var(--olive)"></span>Hired</span>
          </div>
        </div>
        <div class="state-bars">
          {#each stateBars as s, i (s.state)}
            <div class="sb-row" in:fly={{ y: 4, delay: i * 30, duration: 320 }}>
              <div class="sb-label">{s.state}</div>
              <div class="sb-bar">
                <div class="sb-planned" style="width: {s.pct}%"></div>
                {#if s.hired > 0}
                  <div class="sb-hired" style="width: {s.hirePct}%"></div>
                {/if}
              </div>
              <div class="sb-counts mono">
                <span class="sb-h">{s.hired}</span>
                <span class="sb-sep">/</span>
                <span class="sb-p">{s.positions}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Pipeline health donut + Top performing locations -->
    <div class="grid-2" style="margin-top:20px">
      <div class="card pad-lg">
        <div class="section-h" style="margin-bottom:14px">
          <div class="title"><h2>Pipeline health</h2><span class="count">all activity outcomes</span></div>
        </div>
        <div class="health-row">
          <div class="health-donut">
            <svg viewBox="0 0 120 120" width="160" height="160">
              <circle cx="60" cy="60" r="48" fill="none" stroke="var(--surface-sunk)" stroke-width="14"/>
              {#each donutSegments as seg}
                <circle
                  cx="60" cy="60" r="48"
                  fill="none"
                  stroke={seg.color}
                  stroke-width="14"
                  stroke-dasharray="{seg.arc} {DONUT_C}"
                  stroke-dashoffset={seg.offset}
                  transform="rotate(-90 60 60)"
                  style="transition: stroke-dasharray 600ms var(--ease)"
                />
              {/each}
              <text x="60" y="55" text-anchor="middle" class="hd-c-num">{pipelineHealthTotal.toLocaleString()}</text>
              <text x="60" y="72" text-anchor="middle" class="hd-c-lbl">events</text>
            </svg>
          </div>
          <div class="health-legend">
            {#each healthLegendItems as item}
              {@const val = pipelineHealth[item.key]}
              {@const pct = pipelineHealthTotal ? Math.round((val / pipelineHealthTotal) * 100) : 0}
              <div class="hl-row">
                <span class="hl-swatch" style="background: {item.color}"></span>
                <span class="hl-label">{item.label}</span>
                <span class="hl-bar"><span style="width: {pct}%; background: {item.color}"></span></span>
                <span class="hl-num mono">{val}</span>
                <span class="hl-pct mono">{pct}%</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="card pad-lg">
        <div class="section-h" style="margin-bottom:14px">
          <div class="title"><h2>Top universities</h2><span class="count">by hire progress</span></div>
        </div>
        <div class="top-uni-list">
          {#each topUniversities.slice(0, 8) as u, i (u.name + u.state)}
            <div class="tu-row" in:fly={{ y: 4, delay: i * 30, duration: 320 }}>
              <div class="tu-rank">{i + 1}</div>
              <div class="grow" style="min-width:0">
                <div class="tu-name">{u.name}</div>
                <div class="tu-meta">{u.state} · {u.positions} positions · {u.hired} hired</div>
              </div>
              <div class="tu-bar"><span style="width: {u.progress}%"></span></div>
              <div class="tu-pct mono">{u.progress}%</div>
            </div>
          {:else}
            <div class="empty">No university progress yet.</div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Interview activity trend -->
    <div class="card pad-lg" style="margin-top:20px">
      <div class="section-h" style="margin-bottom:14px">
        <div class="title">
          <h2>Activity trend</h2>
          <span class="count">last {months.length} months</span>
        </div>
        <div class="row gap-sm">
          <span class="trend-key"><span class="tk-swatch" style="background:var(--brand)"></span>Interviewed</span>
          <span class="trend-key"><span class="tk-swatch" style="background:var(--olive)"></span>Selected</span>
        </div>
      </div>
      <InterviewChart data={months} height={220} color="var(--brand)" colorDeep="var(--brand-deep)" />
    </div>

    <!-- Active states pills -->
    <div class="card pad" style="margin-top:20px">
      <div class="section-h" style="margin-bottom:12px">
        <div class="title"><h2>Active states</h2><span class="count">{$planProgress.totals.states}</span></div>
      </div>
      <div class="state-pills">
        {#each [...new Set($data.plan.map(p => p.state))].sort() as st}
          <span class="pill brand">{st}</span>
        {/each}
      </div>
    </div>
  </section>

{:else if tab === 'locations'}
  <section in:fly={{ y: 8, duration: 320 }}>
    <!-- Top KPIs -->
    <div class="kpi-grid stagger">
      <StatCard label="States" value={locTotals.states} kind="brand" delta="active hiring" />
      <StatCard label="Universities" value={locTotals.universities} kind="ink" delta="across all states" />
      <StatCard label="Positions" value={locTotals.positions} kind="peach" delta={locTotals.positions ? `${Math.round((locTotals.hired / locTotals.positions) * 100)}% hired` : ''} />
      <StatCard label="CTC budget" value={locTotals.totalCtc} format={fmtCtc} kind="mauve" delta="annual run-rate" />
    </div>

    <!-- View toggle -->
    <div class="row between" style="margin-bottom:18px;flex-wrap:wrap;gap:12px">
      <div class="row gap-sm">
        <button class="seg-btn" class:active={locView === 'states'} on:click={() => locView = 'states'}>
          By State <span class="seg-count">{stateRows.length}</span>
        </button>
        <button class="seg-btn" class:active={locView === 'universities'} on:click={() => locView = 'universities'}>
          By University <span class="seg-count">{uniRows.length}</span>
        </button>
      </div>
    </div>

    {#if locView === 'states'}
      <div class="card" style="padding:0;overflow:hidden">
        <div class="loc-grid loc-head">
          <div>State</div>
          <div>Distribution</div>
          <div class="num">Positions</div>
          <div class="num">Hired</div>
          <div class="num">Open</div>
          <div class="num">CTC budget</div>
          <div>Roles</div>
        </div>
        {#each stateRows as s, i (s.state)}
          <div class="loc-grid loc-row" in:fly={{ y: 4, delay: Math.min(i, 20) * 30, duration: 320 }}>
            <div class="loc-state">
              <div class="ls-name">{s.state}</div>
              <div class="ls-meta">{s.universityCount} {s.universityCount === 1 ? 'university' : 'universities'}</div>
            </div>
            <div class="loc-bar">
              <div class="lb-track">
                <div class="lb-fill" style="width:{(s.positions / statePositionsMax) * 100}%"></div>
                {#if s.hired}
                  <div class="lb-hired" style="width:{(s.hired / statePositionsMax) * 100}%"></div>
                {/if}
              </div>
              <div class="lb-pct mono">{s.progress}%</div>
            </div>
            <div class="num display lcell-num">{s.positions}</div>
            <div class="num display lcell-num" style="color:var(--ok)">{s.hired}</div>
            <div class="num display lcell-num" style="color:var(--brand)">{s.open}</div>
            <div class="num mono lcell-ctc">{s.totalCtc ? fmtCtc(s.totalCtc) : '—'}</div>
            <div class="loc-roles">
              {#each Object.entries(s.roles).sort((a,b) => b[1] - a[1]) as [role, n]}
                <span class="rpill">{role}<b>{n}</b></span>
              {/each}
            </div>
          </div>
        {:else}
          <div class="empty" style="padding:48px">No states in plan yet.</div>
        {/each}
      </div>

    {:else}
      <!-- University view: rich card grid -->
      <div class="uni-analytics-grid">
        {#each uniRows as u, i (u.state + u.name)}
          <div class="uni-card" in:fly={{ y: 8, delay: Math.min(i, 30) * 25, duration: 360, easing: quintOut }}>
            <div class="uc-head">
              <div class="uc-state">
                <svg width="9" height="11" viewBox="0 0 12 14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 13s-5-4.4-5-8a5 5 0 0 1 10 0c0 3.6-5 8-5 8z"/><circle cx="6" cy="5" r="1.6"/></svg>
                {u.state}
              </div>
              <span class="pill outline">{u.type}</span>
            </div>
            <div class="uc-name">{u.name}</div>

            <div class="uc-stats">
              <div class="uc-stat">
                <div class="uc-num display">{u.positions}</div>
                <div class="uc-lbl">Positions</div>
              </div>
              <div class="uc-stat">
                <div class="uc-num display" style="color:var(--ok)">{u.hired}</div>
                <div class="uc-lbl">Hired</div>
              </div>
              <div class="uc-stat">
                <div class="uc-num display" style="color:var(--brand)">{u.open}</div>
                <div class="uc-lbl">Open</div>
              </div>
            </div>

            <div class="uc-bar">
              <div class="lb-track">
                <div class="lb-fill" style="width:{(u.positions / uniPositionsMax) * 100}%"></div>
                {#if u.hired}<div class="lb-hired" style="width:{(u.hired / uniPositionsMax) * 100}%"></div>{/if}
              </div>
              <span class="lb-pct mono">{u.progress}%</span>
            </div>

            <div class="uc-meta">
              <div class="uc-roles">
                {#each Object.entries(u.roles).sort((a,b) => b[1] - a[1]) as [role, n]}
                  <span class="rpill">{role}<b>{n}</b></span>
                {/each}
              </div>
              {#if u.totalCtc}
                <div class="uc-ctc mono">{fmtCtc(u.totalCtc)}</div>
              {/if}
            </div>
          </div>
        {:else}
          <div class="empty" style="padding:48px">No universities in plan yet.</div>
        {/each}
      </div>
    {/if}
  </section>

{:else if tab === 'sources'}
  <section class="card pad" in:fly={{ y: 8, duration: 320 }}>
    <div class="section-h"><div class="title"><h2>Source effectiveness</h2><span class="count">{$sourceStats.length} sources</span></div></div>
    {#if $sourceStats.length}
      <div class="src-list">
        {#each $sourceStats as s, i (s.source)}
          <div class="src-row" in:fly={{ y: 4, delay: i * 30, duration: 320 }}>
            <div class="grow">
              <div style="font-weight:600">{s.source}</div>
              <div class="muted" style="font-size:11px">
                {s.total ?? 0} candidates
                {#if s.joined != null} · {s.joined} joined{/if}
              </div>
            </div>
            <div class="bar" style="flex:1.5;max-width:240px"><span style="width:{(s.total / maxSrc) * 100}%"></span></div>
            <div class="serif" style="font-size:18px;min-width:60px;text-align:right">{s.total ?? 0}</div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty">No source data yet — populate the master roster.</div>
    {/if}
  </section>

{:else if tab === 'team'}
  <section class="grid-2" in:fly={{ y: 8, duration: 320 }}>
    <div class="card pad">
      <div class="section-h"><div class="title"><h2>Sourcers</h2><span class="count">{$peopleStats.sourcers.length}</span></div></div>
      <div class="ppl">
        {#each $peopleStats.sourcers.slice(0, 12) as p (p.name)}
          <div class="ppl-row">
            <div class="ava">{p.name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()}</div>
            <div class="grow">
              <div style="font-weight:600;font-size:13px">{p.name}</div>
              <div class="muted" style="font-size:11px">{p.sourced} sourced · {p.joined ?? 0} joined</div>
            </div>
            <div class="serif" style="font-size:18px">{p.sourced}</div>
          </div>
        {:else}
          <div class="empty">No sourcer data yet.</div>
        {/each}
      </div>
    </div>

    <div class="card pad">
      <div class="section-h"><div class="title"><h2>Panelists</h2><span class="count">{$peopleStats.panelists.length}</span></div></div>
      <div class="ppl">
        {#each $peopleStats.panelists.slice(0, 12) as p (p.name || p.role)}
          <div class="ppl-row">
            <div class="ava">{(p.name || p.role).split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()}</div>
            <div class="grow">
              <div style="font-weight:600;font-size:13px">{p.name || p.role}</div>
              <div class="muted" style="font-size:11px">
                {p.interviews ?? p.conducted ?? 0} interviews
                {#if p.selected != null} · {p.selected} selected{/if}
                {#if p.rejected != null} · {p.rejected} rejected{/if}
              </div>
            </div>
            <div class="serif" style="font-size:18px">{p.interviews ?? p.conducted ?? 0}</div>
          </div>
        {:else}
          <div class="empty">No panelist data yet.</div>
        {/each}
      </div>
    </div>
  </section>

{:else if tab === 'trends'}
  <section in:fly={{ y: 8, duration: 320 }}>
    <!-- Mini stat cards with sparklines -->
    <div class="kpi-grid stagger" style="margin-bottom:20px">
      <div class="card pad mini-trend">
        <div class="lbl">Sourced</div>
        <div class="big-num display">{monthSeries.sourced.reduce((a,b)=>a+b,0).toLocaleString()}</div>
        <Sparkline values={monthSeries.sourced} color="var(--brand)" height={42} />
      </div>
      <div class="card pad mini-trend">
        <div class="lbl">Interviewed</div>
        <div class="big-num display">{monthSeries.interviewed.reduce((a,b)=>a+b,0).toLocaleString()}</div>
        <Sparkline values={monthSeries.interviewed} color="var(--gold)" height={42} />
      </div>
      <div class="card pad mini-trend">
        <div class="lbl">Selected</div>
        <div class="big-num display">{monthSeries.selected.reduce((a,b)=>a+b,0).toLocaleString()}</div>
        <Sparkline values={monthSeries.selected} color="var(--olive)" height={42} />
      </div>
      <div class="card pad mini-trend">
        <div class="lbl">Joined</div>
        <div class="big-num display">{monthSeries.joined.reduce((a,b)=>a+b,0).toLocaleString()}</div>
        <Sparkline values={monthSeries.joined} color="var(--mauve)" height={42} />
      </div>
    </div>

    <!-- Big interview trend chart -->
    <div class="card pad-lg" style="margin-bottom:20px">
      <div class="section-h" style="margin-bottom:14px">
        <div class="title">
          <h2>Interview activity over time</h2>
          <span class="count">{months.length} {months.length === 1 ? 'month' : 'months'}</span>
        </div>
      </div>
      <InterviewChart data={months} height={260} color="var(--brand)" colorDeep="var(--brand-deep)" />
    </div>

    <!-- Monthly breakdown table — proper DGrid alignment -->
    <div class="card pad-lg">
      <div class="section-h" style="margin-bottom:14px">
        <div class="title"><h2>Monthly breakdown</h2><span class="count">all metrics, by month</span></div>
      </div>
      <div class="dgrid-wrap">
        <div class="dgrid" style="--cols: 110px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)">
          <div class="dgrid-row head">
            <div class="dcell">Month</div>
            <div class="dcell num">Sourced</div>
            <div class="dcell num">Interviewed</div>
            <div class="dcell num">Selected</div>
            <div class="dcell num">Joined</div>
          </div>
          {#each months as m, i}
            <div class="dgrid-row" in:fly={{ y: 4, delay: Math.min(i, 12) * 25, duration: 280 }}>
              <div class="dcell mono"><span class="truncate">{m.month}</span></div>
              <div class="dcell num"><span class="trend-cell brand">{m.sourced || '—'}</span></div>
              <div class="dcell num"><span class="trend-cell gold">{m.interviewed || '—'}</span></div>
              <div class="dcell num"><span class="trend-cell olive">{m.selected || '—'}</span></div>
              <div class="dcell num"><span class="trend-cell mauve">{m.joined || '—'}</span></div>
            </div>
          {:else}
            <div class="dgrid-row">
              <div class="dcell" style="grid-column: 1 / -1; justify-content: center; color: var(--muted)">No date-stamped activity yet.</div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </section>

{:else if tab === 'queues'}
  <section in:fly={{ y: 8, duration: 320 }} class="grid-2">
    {#each [
      { key: 'awaitingScreening', label: 'Awaiting screening form fill', kind: 'warn' },
      { key: 'assignmentOverdue', label: 'Assignment overdue (> 5 days)', kind: 'bad' },
      { key: 'awaitingR1',        label: 'Scheduled for R1 — not done', kind: 'info' },
      { key: 'awaitingHR2',       label: 'Scheduled for HR2 — not done', kind: 'info' },
      { key: 'bgvInProgress',     label: 'BGV in progress', kind: 'plum' },
      { key: 'awaitingJoining',   label: 'Offer signed — pending join', kind: 'ok' },
    ] as q}
      <div class="card pad">
        <div class="row between" style="margin-bottom:14px">
          <div class="serif" style="font-size:18px">{q.label}</div>
          <span class="pill {q.kind}">{$queues[q.key].length}</span>
        </div>
        <div class="qlist">
          {#each $queues[q.key].slice(0, 8) as c}
            <a href="{base}/candidates/{encodeURIComponent(c.__id)}" class="qrow">
              <div style="font-weight:500;font-size:13px">{c.__name}</div>
              <span class="muted" style="font-size:11px">{c.__role || c.__currentStage || '—'}</span>
            </a>
          {:else}
            <div class="empty" style="padding:20px">All clear.</div>
          {/each}
        </div>
      </div>
    {/each}
  </section>
{/if}

<style>
  .tabs { display: flex; gap: 4px; padding: 4px; border-radius: 99px; background: var(--surface); border: 1px solid var(--line); }
  .tab {
    padding: 8px 16px;
    border-radius: 99px;
    color: var(--ink-2);
    font-size: 13px;
    font-weight: 500;
    transition: all var(--t-fast) var(--ease);
  }
  .tab:hover { background: var(--surface-soft); }
  .tab.active { background: var(--ink); color: #fff; }

  .grid-2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--s-4); }
  @media (max-width: 1100px) { .grid-2 { grid-template-columns: 1fr; } }

  /* Per-role overview cards */
  .role-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--s-4);
    margin-bottom: var(--s-5);
  }
  .role-card { display: flex; flex-direction: column; gap: 16px; }
  .rc-head { display: flex; align-items: center; justify-content: space-between; }
  .rc-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; padding: 14px 0; border-top: 1px solid var(--line-soft); border-bottom: 1px solid var(--line-soft); }
  .rc-stat { padding: 0 8px; border-right: 1px solid var(--line-soft); position: relative; }
  .rc-stat:last-child { border-right: 0; }
  .rc-num { font-size: 28px; line-height: 1; color: var(--ink); }
  .rc-lbl { font-size: 9.5px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; margin-top: 6px; font-weight: 500; }
  .rc-pct { font-family: var(--font-mono); font-size: 10px; color: var(--brand-deep); margin-top: 4px; }

  .rc-rounds { display: flex; flex-direction: column; gap: 8px; }
  .rc-round { display: grid; grid-template-columns: 28px 1fr 56px; gap: 10px; align-items: center; }
  .rc-round-h { font-size: 11px; font-weight: 600; color: var(--ink-2); }
  .rc-round-bar { height: 6px; background: var(--surface-sunk); border-radius: 99px; overflow: hidden; }
  .rc-round-fill {
    height: 100%; background: linear-gradient(90deg, var(--brand) 0%, var(--gold) 100%);
    border-radius: 99px;
    transition: width 600ms var(--ease);
  }
  .rc-round-meta { font-family: var(--font-mono); font-size: 10.5px; color: var(--muted); text-align: right; }

  .src-list, .ppl, .qlist { display: flex; flex-direction: column; gap: 6px; max-height: 480px; overflow: auto; }
  .src-row { display: flex; align-items: center; gap: 14px; padding: 10px 4px; border-bottom: 1px solid var(--line-soft); }
  .src-row:last-child { border-bottom: 0; }

  .ppl-row { display: flex; align-items: center; gap: 12px; padding: 10px 4px; border-bottom: 1px solid var(--line-soft); }
  .ppl-row:last-child { border-bottom: 0; }
  .ava {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--brand-soft), var(--gold-soft));
    color: var(--brand-deep);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 600;
    flex-shrink: 0;
  }

  .qrow { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 10px; transition: background var(--t-fast) var(--ease); }
  .qrow:hover { background: var(--surface-soft); }

  .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; font-weight: 500; }
  .big-num { font-size: 28px; line-height: 1; margin: 6px 0 10px; }

  .month-table { display: flex; flex-direction: column; gap: 0; }
  .mt-head, .mt-row { display: grid; grid-template-columns: 100px repeat(4, 1fr); gap: 12px; padding: 10px 4px; }
  .mt-head { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); border-bottom: 1px solid var(--line); }
  .mt-row { font-size: 13px; border-bottom: 1px solid var(--line-soft); }
  .mt-row:hover { background: var(--surface-soft); }

  .state-pills { display: flex; flex-wrap: wrap; gap: 6px; }

  /* ============== Conversion comparison ============== */
  .analytics-block { margin-top: 20px; }
  .conv-grid { display: flex; flex-direction: column; gap: 14px; }
  .conv-row {
    display: grid;
    grid-template-columns: 110px 1fr;
    align-items: center;
    gap: 16px;
  }
  .conv-role { display: flex; align-items: center; gap: 8px; }
  .conv-role .pill { font-weight: 700; font-size: 12px; }
  .conv-conv { font-size: 12px; color: var(--brand-deep); font-weight: 700; }
  .conv-bar-stack {
    display: flex;
    gap: 4px;
    height: 64px;
    min-width: 0;
  }
  .conv-step {
    position: relative;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-width: 0;
    background: var(--brand);
    color: #fff;
    transition: filter 200ms var(--ease);
  }
  .conv-step:hover { filter: brightness(1.08); }
  .conv-step.shortlist { background: var(--brand-deep); }
  .conv-step.r1 { background: var(--gold); color: var(--ink); }
  .conv-step.r2 { background: var(--mauve); }
  .conv-step.r3 { background: var(--olive); }
  .conv-step .cs-num { font-family: var(--font-display); font-size: 20px; font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
  .conv-step .cs-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; margin-top: 3px; opacity: .85; font-weight: 600; }

  /* ============== Pipeline health ============== */
  .health-row { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
  .health-donut { flex-shrink: 0; }
  .hd-c-num { fill: var(--ink); font-family: var(--font-display); font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
  .hd-c-lbl { fill: var(--ink-3); font-size: 9px; text-transform: uppercase; letter-spacing: .1em; font-weight: 600; }
  .health-legend { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .hl-row {
    display: grid;
    grid-template-columns: 14px minmax(80px, max-content) 1fr 40px 40px;
    gap: 10px;
    align-items: center;
    font-size: 12px;
  }
  .hl-swatch { width: 12px; height: 12px; border-radius: 3px; }
  .hl-label { font-weight: 600; color: var(--ink); }
  .hl-bar { background: var(--surface-sunk); height: 6px; border-radius: 99px; overflow: hidden; }
  .hl-bar span { display: block; height: 100%; border-radius: 99px; transition: width 600ms var(--ease); }
  .hl-num { font-weight: 700; color: var(--ink); text-align: right; }
  .hl-pct { font-size: 11px; color: var(--ink-3); text-align: right; }

  /* ============== Top universities list ============== */
  .top-uni-list { display: flex; flex-direction: column; gap: 8px; }
  .tu-row {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) 100px 44px;
    gap: 12px;
    align-items: center;
    padding: 8px 10px;
    border-radius: 10px;
    transition: background var(--t-fast) var(--ease);
  }
  .tu-row:hover { background: var(--brand-soft-2); }
  .tu-rank {
    width: 24px; height: 24px;
    border-radius: 50%;
    background: var(--surface-sunk);
    color: var(--ink-2);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700;
    font-family: var(--font-mono);
  }
  .tu-row:nth-child(1) .tu-rank { background: var(--brand); color: #fff; }
  .tu-row:nth-child(2) .tu-rank { background: var(--ink); color: var(--brand-soft); }
  .tu-row:nth-child(3) .tu-rank { background: var(--gold); color: var(--ink); }
  .tu-name {
    font-weight: 700;
    font-size: 13px;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tu-meta { font-size: 11px; color: var(--ink-3); margin-top: 2px; font-weight: 500; }
  .tu-bar { background: var(--surface-sunk); height: 6px; border-radius: 99px; overflow: hidden; }
  .tu-bar span {
    display: block; height: 100%;
    background: linear-gradient(90deg, var(--olive) 0%, #4A5634 100%);
    border-radius: 99px;
    transition: width 600ms var(--ease);
  }
  .tu-pct { font-size: 11px; font-weight: 700; color: var(--ink); text-align: right; }

  /* ============== Trend chart key ============== */
  .trend-key { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--ink-2); }
  .tk-swatch { width: 10px; height: 10px; border-radius: 3px; }

  /* ============== Insight cards ============== */
  .insight-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--s-4);
  }
  .insight-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 18px 20px;
    border-radius: var(--r-lg);
    border: 1px solid var(--line);
    background: var(--surface);
    box-shadow: var(--shadow-xs);
    transition: transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
  }
  .insight-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .insight-best     { border-left: 4px solid var(--olive); }
  .insight-worst    { border-left: 4px solid var(--warn); }
  .insight-bottleneck { border-left: 4px solid var(--brand); }
  .insight-state    { border-left: 4px solid var(--mauve); }
  .ins-icon {
    width: 38px; height: 38px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    background: var(--surface-sunk);
    color: var(--ink-2);
  }
  .insight-best .ins-icon { background: var(--olive-soft); color: #4A5634; }
  .insight-worst .ins-icon { background: var(--warn-soft); color: #6E5022; }
  .insight-bottleneck .ins-icon { background: var(--brand-soft); color: var(--brand-deep); }
  .insight-state .ins-icon { background: var(--mauve-soft); color: var(--mauve-deep); }
  .ins-icon svg { width: 18px; height: 18px; }
  .ins-body { min-width: 0; flex: 1; }
  .ins-title { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-3); font-weight: 700; }
  .ins-value { font-size: 22px; font-weight: 700; line-height: 1.2; margin: 4px 0; color: var(--ink); letter-spacing: -0.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ins-sub { font-size: 11.5px; color: var(--ink-3); line-height: 1.4; }

  /* ============== Pipeline matrix ============== */
  .matrix-wrap { overflow-x: auto; margin: 0 -4px; }
  .matrix {
    display: grid;
    grid-template-columns: 90px repeat(var(--cols, 4), minmax(112px, 1fr)) 100px;
    gap: 0;
    min-width: 100%;
    --cols: 5;
  }
  .m-cell {
    padding: 14px 12px;
    border-bottom: 1px solid var(--line-soft);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    min-width: 0;
  }
  .m-corner, .m-head { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; color: var(--ink-3); border-bottom: 2px solid var(--ink); }
  .m-head.conv-h { color: var(--brand-deep); }
  .m-role { padding-left: 4px; }
  .m-data { padding: 14px 12px; }
  .m-data.weak { background: rgba(227, 83, 54, .06); }
  .m-data.strong { background: rgba(107, 122, 79, .08); }
  .m-num { font-size: 20px; line-height: 1; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; }
  .m-num.brand { color: var(--brand-deep); }
  .m-carry { display: flex; align-items: center; gap: 4px; font-size: 10.5px; font-family: var(--font-mono); color: var(--ink-3); margin-top: 4px; font-weight: 600; }
  .carry-arrow { font-weight: 800; }
  .carry-arrow.good { color: var(--olive); }
  .carry-arrow.ok { color: var(--warn); }
  .carry-arrow.bad { color: var(--brand); }
  .m-conv { background: var(--brand-soft-2); border-left: 1px solid var(--line-soft); }

  /* ============== State breakdown bars ============== */
  .state-bars { display: flex; flex-direction: column; gap: 8px; }
  .sb-row {
    display: grid;
    grid-template-columns: 130px 1fr 80px;
    gap: 14px;
    align-items: center;
    padding: 8px 10px;
    border-radius: 10px;
    transition: background var(--t-fast) var(--ease);
  }
  .sb-row:hover { background: var(--brand-soft-2); }
  .sb-label { font-size: 13px; font-weight: 600; color: var(--ink); }
  .sb-bar {
    position: relative;
    height: 22px;
    background: var(--surface-sunk);
    border-radius: 6px;
    overflow: hidden;
  }
  .sb-planned {
    position: absolute; inset: 0 auto 0 0;
    background: var(--brand-soft-2);
    border: 1px solid var(--brand);
    border-radius: 6px;
    transition: width 600ms var(--ease);
  }
  .sb-hired {
    position: absolute; inset: 0 auto 0 0;
    background: linear-gradient(90deg, var(--olive) 0%, #4A5634 100%);
    border-radius: 6px;
    transition: width 600ms var(--ease);
  }
  .sb-counts { font-size: 12px; text-align: right; font-weight: 700; }
  .sb-h { color: var(--olive); }
  .sb-sep { color: var(--ink-3); margin: 0 2px; }
  .sb-p { color: var(--ink); }

  /* ============== Trends tab ============== */
  .mini-trend .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; color: var(--ink-3); }
  .mini-trend .big-num { font-size: 32px; line-height: 1; font-weight: 700; color: var(--ink); margin: 6px 0 12px; letter-spacing: -0.02em; }

  .trend-cell {
    display: inline-block;
    min-width: 36px;
    padding: 3px 8px;
    border-radius: 99px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-weight: 700;
    text-align: right;
    color: var(--ink-2);
    background: var(--surface-sunk);
  }
  .trend-cell.brand { background: var(--brand-soft-2); color: var(--brand-deep); }
  .trend-cell.gold { background: var(--gold-soft); color: #6E5022; }
  .trend-cell.olive { background: var(--olive-soft); color: #4A5634; }
  .trend-cell.mauve { background: var(--mauve-soft); color: var(--mauve-deep); }

  /* ============== Locations tab ============== */
  .seg-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-pill);
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-3);
    cursor: pointer;
    transition: all var(--t-fast) var(--ease);
  }
  .seg-btn:hover { background: var(--surface-soft); color: var(--ink); }
  .seg-btn.active { background: var(--ink); color: var(--brand-soft); border-color: var(--ink); }
  .seg-count {
    font-family: var(--font-mono);
    font-size: 10.5px;
    background: rgba(255,255,255,.15);
    color: inherit;
    padding: 1px 7px;
    border-radius: 99px;
    font-weight: 700;
  }
  .seg-btn:not(.active) .seg-count {
    background: var(--brand-soft);
    color: var(--brand-deep);
  }

  /* State table grid */
  .loc-grid {
    display: grid;
    grid-template-columns: minmax(140px, 1.2fr) minmax(180px, 1.6fr) 80px 70px 70px 110px minmax(180px, 1.5fr);
    gap: 16px;
    padding: 14px 18px;
    align-items: center;
    border-bottom: 1px solid var(--line-soft);
  }
  .loc-head {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: var(--ink-3);
    border-bottom: 2px solid var(--ink);
    background: var(--surface);
    position: sticky;
    top: 0;
    z-index: 2;
  }
  .loc-row { transition: background var(--t-fast) var(--ease); }
  .loc-row:hover { background: var(--brand-soft-2); }
  .loc-row:last-child { border-bottom: 0; }
  .loc-grid .num { text-align: right; }
  .loc-state .ls-name { font-weight: 700; font-size: 14px; color: var(--ink); }
  .loc-state .ls-meta { font-size: 11px; color: var(--ink-3); margin-top: 2px; font-weight: 500; }
  .loc-bar { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .lb-track {
    flex: 1;
    height: 8px;
    background: var(--surface-sunk);
    border-radius: 99px;
    position: relative;
    overflow: hidden;
    min-width: 0;
  }
  .lb-fill {
    position: absolute; inset: 0 auto 0 0;
    background: linear-gradient(90deg, var(--brand) 0%, var(--brand-deep) 100%);
    border-radius: 99px;
    transition: width 600ms var(--ease);
  }
  .lb-hired {
    position: absolute; inset: 0 auto 0 0;
    background: linear-gradient(90deg, var(--ok) 0%, #4A5634 100%);
    border-radius: 99px;
    transition: width 600ms var(--ease);
  }
  .lb-pct { font-size: 11px; color: var(--ink); font-weight: 700; min-width: 32px; text-align: right; }
  .lcell-num { font-size: 18px; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; }
  .lcell-ctc { font-size: 12px; font-weight: 600; color: var(--ink-2); }
  .loc-roles { display: flex; flex-wrap: wrap; gap: 4px; }
  .rpill {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 4px 2px 8px;
    background: var(--surface-sunk);
    color: var(--ink-2);
    border-radius: 99px;
    font-size: 10px;
    font-weight: 700;
  }
  .rpill b {
    background: var(--ink);
    color: var(--brand-soft);
    font-family: var(--font-mono);
    font-size: 9px;
    padding: 1px 6px;
    border-radius: 99px;
    font-weight: 700;
  }
  @media (max-width: 1100px) {
    .loc-grid { grid-template-columns: 1fr 1fr; gap: 12px 16px; }
    .loc-head { display: none; }
    .loc-bar, .loc-roles { grid-column: 1 / -1; }
  }

  /* University analytics grid */
  .uni-analytics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: var(--s-4);
  }
  .uni-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    padding: 20px;
    box-shadow: var(--shadow-xs);
    display: flex; flex-direction: column;
    gap: 14px;
    transition: all var(--t-base) var(--ease);
  }
  .uni-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-md);
    border-color: var(--brand);
  }
  .uc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .uc-state {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 700; color: var(--brand-deep);
    background: var(--brand-soft);
    padding: 4px 10px;
    border-radius: 99px;
  }
  .uc-name {
    font-family: var(--font-display);
    font-size: 18px;
    line-height: 1.2;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.015em;
    overflow: hidden;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .uc-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding: 12px 0;
    border-top: 1px solid var(--line-soft);
    border-bottom: 1px solid var(--line-soft);
  }
  .uc-stat { padding: 0 4px; border-right: 1px solid var(--line-soft); text-align: left; }
  .uc-stat:last-child { border-right: 0; }
  .uc-num { font-size: 22px; line-height: 1; color: var(--ink); font-weight: 700; letter-spacing: -0.02em; }
  .uc-lbl { font-size: 9.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); margin-top: 6px; font-weight: 700; }
  .uc-bar { display: flex; align-items: center; gap: 12px; }
  .uc-meta { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
  .uc-roles { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; min-width: 0; }
  .uc-ctc { font-size: 12px; color: var(--brand-deep); font-weight: 700; flex-shrink: 0; }
</style>
