<script>
  import { base } from '$app/paths';
  import { dataset, byPanelist, rejectionMatrix, bySource, STAGES, monthlyVolume } from '$lib/data/stores.js';
  import RoleMonthHeatmap from '$lib/components/RoleMonthHeatmap.svelte';
  import MonthlyBarChart from '$lib/components/MonthlyBarChart.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  function fmt(n) { return (n || 0).toLocaleString(); }

  $: heatmapStages = (() => {
    // Build stage × reason matrix
    const stages = new Set();
    const reasons = new Set();
    const grid = new Map();   // `${stage}|${reason}` → count
    for (const r of $rejectionMatrix) {
      stages.add(r.stage);
      reasons.add(r.reason);
      const k = `${r.stage}|${r.reason}`;
      grid.set(k, (grid.get(k) || 0) + r.count);
    }
    const stageList = [...stages].sort((a, b) => {
      const ai = STAGES.findIndex(s => s.key === a);
      const bi = STAGES.findIndex(s => s.key === b);
      return ai - bi;
    });
    const reasonList = [...reasons].slice(0, 14);
    const max = Math.max(1, ...[...grid.values()]);
    return {
      stages: stageList,
      reasons: reasonList,
      grid,
      max,
    };
  })();

  // Time-to-hire: for hired candidates, days between application timestamp and current stage date
  $: hireTimes = $dataset.candidates
    .filter(c => c.finalDecision === 'hired' && c.timestampDate && c.currentStageDate)
    .map(c => {
      const days = Math.round((c.currentStageDate - c.timestampDate) / (1000 * 60 * 60 * 24));
      return { name: c.name, days, role: c.role, nameKey: c.nameKey };
    })
    .filter(x => x.days >= 0 && x.days < 365)
    .sort((a, b) => a.days - b.days);

  $: avgHireDays = hireTimes.length
    ? Math.round(hireTimes.reduce((s, x) => s + x.days, 0) / hireTimes.length)
    : 0;

  $: stageActivities = (() => {
    // For RoleMonthHeatmap re-use, convert stageEvents → activities shape
    return $dataset.stageEvents
      .filter(e => e.parsedDate && e.role)
      .map(e => ({
        role: e.role,
        parsedDate: e.parsedDate,
        decision: e.decision,
      }));
  })();
</script>

<svelte:head><title>Insights · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">Hiring portal</div>
    <h1 class="serif">Insights</h1>
    <p class="muted lead">Why people drop, who interviews, where they come from, how long it takes.</p>
  </div>
</header>

<section class="row gap" style="margin-top:18px;align-items:flex-start">
  <!-- Time-to-hire -->
  <div class="card pad-lg" style="flex:1;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Time to hire</h2>
    {#if hireTimes.length}
      <div class="row gap" style="align-items:flex-end;margin-bottom:14px">
        <div>
          <div class="muted small">Average</div>
          <div class="display" style="font-size:48px;line-height:1;color:var(--brand)">{avgHireDays}<span style="font-size:18px;color:var(--ink-3);margin-left:6px">days</span></div>
        </div>
        <div class="muted small" style="margin-left:auto">{hireTimes.length} hires analyzed</div>
      </div>
      <div class="tth-list">
        {#each hireTimes.slice(0, 15) as h}
          <a class="tth-row" href="{base}/candidates/{encodeURIComponent(h.nameKey)}">
            <div class="tth-name">{h.name}</div>
            <div class="tth-bar"><div class="tth-fill" style="width:{Math.min(100, h.days / Math.max(...hireTimes.map(x => x.days)) * 100)}%"></div></div>
            <div class="tth-days mono">{h.days}d</div>
          </a>
        {/each}
      </div>
    {:else}
      <EmptyState title="No completed hires yet to measure time-to-hire." />
    {/if}
  </div>

  <div class="card pad-lg" style="flex:1.2;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Activity volume by role & month</h2>
    {#if stageActivities.length}
      <RoleMonthHeatmap activities={stageActivities} />
    {:else}
      <EmptyState title="No timestamped stage events yet." />
    {/if}
  </div>
</section>

<section class="card pad-lg" style="margin-top:24px">
  <h2 class="serif" style="font-size:22px;margin-bottom:14px">Rejection heatmap · stage × reason</h2>
  {#if heatmapStages.stages.length}
    <div class="heat" style="--cols:{heatmapStages.stages.length}">
      <div class="hh corner"></div>
      {#each heatmapStages.stages as st}
        <div class="hh">{STAGES.find(s => s.key === st)?.short || st}</div>
      {/each}
      {#each heatmapStages.reasons as reason}
        <div class="hh row-h">{reason}</div>
        {#each heatmapStages.stages as st}
          {@const v = heatmapStages.grid.get(`${st}|${reason}`) || 0}
          {@const intensity = v / heatmapStages.max}
          <div class="hc" style="background: rgba(196, 30, 58, {0.05 + intensity * 0.85}); color: {intensity > 0.55 ? '#fff' : 'var(--ink)'}">
            {v || ''}
          </div>
        {/each}
      {/each}
    </div>
  {:else}
    <EmptyState title="No rejection data yet." body="Once candidates are rejected with categorized reasons, this matrix will populate." />
  {/if}
</section>

<section class="row gap" style="margin-top:24px;align-items:flex-start">
  <div class="card pad-lg" style="flex:1;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Panelist leaderboard</h2>
    {#if $byPanelist.length}
      <div class="dgrid" style="--cols:4">
        <div class="dh">Panelist</div>
        <div class="dh num">Interviews</div>
        <div class="dh num">Selected</div>
        <div class="dh num">Pass rate</div>
        {#each $byPanelist.slice(0, 20) as p}
          {@const passRate = p.interviews ? p.selected / p.interviews : 0}
          <div class="dc strong">{p.panelist}</div>
          <div class="dc num mono">{fmt(p.interviews)}</div>
          <div class="dc num mono ok">{fmt(p.selected)}</div>
          <div class="dc num"><span class={passRate >= 0.5 ? 'ok' : passRate >= 0.25 ? 'warn' : 'bad'}>{Math.round(passRate * 100)}%</span></div>
        {/each}
      </div>
    {:else}
      <EmptyState title="No panelist data." />
    {/if}
  </div>

  <div class="card pad-lg" style="flex:1;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Source conversion</h2>
    {#if $bySource.length}
      <div class="dgrid" style="--cols:5">
        <div class="dh">Source</div>
        <div class="dh num">Total</div>
        <div class="dh num">Active</div>
        <div class="dh num">Hired</div>
        <div class="dh num">Hire %</div>
        {#each $bySource.slice(0, 15) as s}
          {@const conv = s.total ? s.hired / s.total : 0}
          <div class="dc strong">{s.source}</div>
          <div class="dc num mono">{fmt(s.total)}</div>
          <div class="dc num mono">{fmt(s.active)}</div>
          <div class="dc num mono brand">{fmt(s.hired)}</div>
          <div class="dc num"><span class={conv >= 0.05 ? 'ok' : 'muted'}>{(conv * 100).toFixed(1)}%</span></div>
        {/each}
      </div>
    {:else}
      <EmptyState title="No source data." />
    {/if}
  </div>
</section>

<style>
  .small { font-size: 12px; }
  .tth-list { display: flex; flex-direction: column; gap: 4px; }
  .tth-row {
    display: grid;
    grid-template-columns: 1.4fr 1fr 60px;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: var(--r-sm);
  }
  .tth-row:hover { background: var(--surface-soft); }
  .tth-name { font-size: 12.5px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tth-bar { height: 8px; background: var(--surface-sunk); border-radius: 4px; overflow: hidden; }
  .tth-fill { height: 100%; background: linear-gradient(90deg, var(--olive), #4A5634); }
  .tth-days { text-align: right; font-size: 12px; font-weight: 800; color: var(--ink); }

  .heat {
    display: grid;
    grid-template-columns: 220px repeat(var(--cols), minmax(60px, 1fr));
    gap: 4px;
  }
  .hh {
    font-size: 10px;
    font-weight: 700;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: .04em;
    text-align: center;
    padding: 8px 4px;
  }
  .hh.corner { padding: 0; }
  .hh.row-h { text-align: left; padding-left: 10px; font-size: 11px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hc {
    padding: 14px 4px;
    border-radius: 4px;
    text-align: center;
    font-family: var(--font-mono);
    font-weight: 800;
    font-size: 12.5px;
  }

  .dgrid { display: grid; gap: 0; }
  .dh {
    font-size: 10.5px; font-weight: 700; color: var(--ink-3);
    text-transform: uppercase; letter-spacing: .06em;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }
  .dh.num, .dc.num { text-align: right; font-family: var(--font-mono); }
  .dc {
    padding: 12px;
    border-bottom: 1px solid var(--line-soft);
    color: var(--ink-2);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .dc.strong { color: var(--ink); font-weight: 600; }
  .dc .ok { color: var(--ok); font-weight: 700; }
  .dc .warn { color: var(--gold-deep, #8E6B36); font-weight: 700; }
  .dc .bad { color: var(--bad); font-weight: 700; }
  .dc .brand { color: var(--brand); font-weight: 700; }
  .dc .muted { color: var(--ink-3); }
</style>
