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

    <div class="kpi-grid stagger">
      <StatCard label="Resumes reviewed" value={globalTotals.resumes} kind="brand" delta="across all roles" />
      <StatCard label="Interviews conducted" value={globalTotals.interviews} kind="default" delta="R1 + R2 + R3" />
      <StatCard label="Final selections" value={globalTotals.selected} kind="peach" delta={globalTotals.resumes ? fmtPct(globalTotals.selected / globalTotals.resumes * 100) + ' conversion' : ''} />
      <StatCard label="Plan CTC budget" value={$planProgress.totals.totalCtc || 0} format={(n) => n >= 100 ? '₹' + (n/100).toFixed(2) + ' Cr' : '₹' + Math.round(n) + ' L'} kind="mauve" delta="annual run-rate" />
    </div>

    {#if hasMaster}
      <div class="role-cards stagger">
        {#each roleCards as r, i (r.role)}
          <div class="role-card card pad" in:fly={{ y: 8, delay: i * 60, duration: 400, easing: quintOut }}>
            <div class="rc-head">
              <span class="pill brand" style="font-size:13px;font-weight:600;padding:5px 12px">{r.role}</span>
              <div class="muted mono" style="font-size:11px">{r.conv}% top→final</div>
            </div>

            <div class="rc-stats">
              <div class="rc-stat">
                <div class="rc-num serif">{r.resumes}</div>
                <div class="rc-lbl">Resumes</div>
              </div>
              <div class="rc-stat">
                <div class="rc-num serif" style="color:var(--brand)">{r.selected}</div>
                <div class="rc-lbl">Shortlist</div>
                <div class="rc-pct">{r.resumes ? fmtPct(r.selected / r.resumes * 100) : '—'}</div>
              </div>
              <div class="rc-stat">
                <div class="rc-num serif" style="color:var(--gold)">{r.r1sel + r.r2sel + r.r3sel}</div>
                <div class="rc-lbl">Selected</div>
              </div>
            </div>

            <div class="rc-rounds">
              <div class="rc-round">
                <div class="rc-round-h">R1</div>
                <div class="rc-round-bar">
                  <div class="rc-round-fill" style="width:{r.r1 ? (r.r1sel / r.r1) * 100 : 0}%"></div>
                </div>
                <div class="rc-round-meta">{r.r1sel}/{r.r1}</div>
              </div>
              <div class="rc-round">
                <div class="rc-round-h">R2</div>
                <div class="rc-round-bar">
                  <div class="rc-round-fill" style="width:{r.r2 ? (r.r2sel / r.r2) * 100 : 0}%"></div>
                </div>
                <div class="rc-round-meta">{r.r2sel}/{r.r2}</div>
              </div>
              {#if r.r3 > 0 || r.r3sel > 0}
                <div class="rc-round">
                  <div class="rc-round-h">R3</div>
                  <div class="rc-round-bar">
                    <div class="rc-round-fill" style="width:{r.r3 ? (r.r3sel / r.r3) * 100 : 0}%"></div>
                  </div>
                  <div class="rc-round-meta">{r.r3sel}/{r.r3}</div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <div class="grid-2" style="margin-top:20px">
      <div class="card pad">
        <div class="row between" style="margin-bottom:14px">
          <div class="serif" style="font-size:18px">Last 12 months · interview volume</div>
          <span class="pill outline">{months.length} mo</span>
        </div>
        <Sparkline values={monthSeries.interviewed} color="var(--brand)" height={56} />
      </div>
      <div class="card pad">
        <div class="row between" style="margin-bottom:14px">
          <div class="serif" style="font-size:18px">Active states</div>
          <span class="pill outline">{$planProgress.totals.states}</span>
        </div>
        <div class="state-pills">
          {#each [...new Set($data.plan.map(p => p.state))] as st}
            <span class="pill brand">{st}</span>
          {/each}
        </div>
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
    <div class="kpi-grid">
      <div class="card pad">
        <div class="muted lbl">Sourced</div>
        <div class="serif big-num">{monthSeries.sourced.reduce((a,b)=>a+b,0).toLocaleString()}</div>
        <Sparkline values={monthSeries.sourced} color="var(--brand)" height={48} />
      </div>
      <div class="card pad">
        <div class="muted lbl">Interviewed</div>
        <div class="serif big-num">{monthSeries.interviewed.reduce((a,b)=>a+b,0).toLocaleString()}</div>
        <Sparkline values={monthSeries.interviewed} color="var(--gold)" height={48} />
      </div>
      <div class="card pad">
        <div class="muted lbl">Selected</div>
        <div class="serif big-num">{monthSeries.selected.reduce((a,b)=>a+b,0).toLocaleString()}</div>
        <Sparkline values={monthSeries.selected} color="var(--sage)" height={48} />
      </div>
      <div class="card pad">
        <div class="muted lbl">Joined</div>
        <div class="serif big-num">{monthSeries.joined.reduce((a,b)=>a+b,0).toLocaleString()}</div>
        <Sparkline values={monthSeries.joined} color="var(--plum)" height={48} />
      </div>
    </div>

    <div class="card pad">
      <div class="section-h"><div class="title"><h2>Monthly breakdown</h2><span class="count">{months.length} months</span></div></div>
      <div class="month-table">
        <div class="mt-head">
          <div>Month</div><div>Sourced</div><div>Interviewed</div><div>Selected</div><div>Joined</div>
        </div>
        {#each months as m}
          <div class="mt-row">
            <div class="mono">{m.month}</div>
            <div>{m.sourced}</div>
            <div>{m.interviewed}</div>
            <div>{m.selected}</div>
            <div>{m.joined}</div>
          </div>
        {:else}
          <div class="empty">No date-stamped activity yet.</div>
        {/each}
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
            <a href="/candidates/{encodeURIComponent(c.__id)}" class="qrow">
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
