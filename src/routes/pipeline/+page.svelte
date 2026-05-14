<script>
  import { base } from '$app/paths';
  import { dataset, funnel, stageMatrix, STAGES, ROLES } from '$lib/data/stores.js';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let activeStage = 'r1';
  let roleFilter = '';

  $: candidatesAtStage = ($dataset.candidates || []).filter(c => {
    if (c.currentStage !== activeStage) return false;
    if (roleFilter && !c.role?.toUpperCase().startsWith(roleFilter)) return false;
    return true;
  });

  $: stageMeta = STAGES.find(s => s.key === activeStage);

  function fmt(n) { return (n || 0).toLocaleString(); }
</script>

<svelte:head><title>Pipeline · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">Hiring portal</div>
    <h1 class="serif">Pipeline</h1>
    <p class="muted lead">Click any stage to see who's currently there. Filter by role.</p>
  </div>
  <div class="role-filter">
    <button class="chip" class:active={roleFilter === ''} on:click={() => roleFilter = ''}>All roles</button>
    {#each ROLES as r}
      <button class="chip" class:active={roleFilter === r} on:click={() => roleFilter = r}>{r}</button>
    {/each}
  </div>
</header>

<section class="stage-strip">
  {#each $funnel as s, i}
    {@const prev = i > 0 ? $funnel[i - 1].count : null}
    {@const drop = prev != null && prev ? Math.round(((prev - s.count) / prev) * 100) : null}
    <button
      class="stage-card"
      class:active={activeStage === s.key}
      on:click={() => activeStage = s.key}
    >
      <div class="sc-idx mono">{String(i + 1).padStart(2, '0')}</div>
      <div class="sc-short">{s.short}</div>
      <div class="sc-count display">{fmt(s.count)}</div>
      <div class="sc-label">{s.label}</div>
      {#if drop != null && drop > 0}
        <div class="sc-drop" class:hi={drop > 50}>−{drop}%</div>
      {/if}
    </button>
  {/each}
</section>

<section class="card pad-lg" style="margin-top:24px">
  <div class="row between" style="align-items:center;margin-bottom:14px">
    <h2 class="serif" style="font-size:22px">{stageMeta?.label || activeStage} · {candidatesAtStage.length}</h2>
    <span class="muted" style="font-size:12px">currently at this stage</span>
  </div>

  {#if candidatesAtStage.length}
    <div class="dgrid" style="--cols:7;font-size:13px">
      <div class="dh">Name</div>
      <div class="dh">Role</div>
      <div class="dh">Status</div>
      <div class="dh">Date</div>
      <div class="dh">Panelist</div>
      <div class="dh">Source</div>
      <div class="dh">Decision</div>
      {#each candidatesAtStage as c}
        {@const ev = c.stages[activeStage]}
        <a class="dc strong" href="{base}/candidates/{encodeURIComponent(c.nameKey)}">{c.name}</a>
        <div class="dc">{c.role || '—'}</div>
        <div class="dc">{ev?.status || c.currentStageStatus || '—'}</div>
        <div class="dc mono small">{ev?.parsedDate?.toLocaleDateString() || ev?.date || '—'}</div>
        <div class="dc">{ev?.panelist || '—'}</div>
        <div class="dc small">{c.sourceName || '—'}</div>
        <div class="dc"><StatusPill decision={ev?.decision || 'active'} /></div>
      {/each}
    </div>
  {:else}
    <EmptyState title="No candidates currently at this stage." body="Try a different stage or change role filter." />
  {/if}
</section>

<section class="card pad-lg" style="margin-top:24px">
  <h2 class="serif" style="font-size:22px;margin-bottom:14px">Role × Stage matrix</h2>
  <div class="matrix" style="--cols:{STAGES.length}">
    <div class="mh">Role</div>
    {#each STAGES as s}
      <div class="mh" title={s.label}>{s.short}</div>
    {/each}
    {#each ROLES as r}
      <div class="mc role">{r}</div>
      {#each STAGES as s}
        {@const v = $stageMatrix[r]?.[s.key] || 0}
        {@const maxRow = Math.max(...STAGES.map(ss => $stageMatrix[r]?.[ss.key] || 0)) || 1}
        {@const intensity = v / maxRow}
        <div class="mc cell" style="background: rgba(227, 83, 54, {0.05 + intensity * 0.7}); color: {intensity > 0.55 ? '#fff' : 'var(--ink)'}">
          {v || ''}
        </div>
      {/each}
    {/each}
  </div>
</section>

<style>
  .role-filter { display: flex; gap: 6px; margin-top: 12px; }
  .chip {
    padding: 6px 14px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line);
    background: var(--surface);
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-2);
    cursor: pointer;
    transition: all var(--t-fast) var(--ease);
  }
  .chip:hover { border-color: var(--brand); }
  .chip.active { background: var(--ink); color: var(--brand-soft); border-color: var(--ink); }

  .stage-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
    margin-top: 20px;
  }
  .stage-card {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: 14px 12px;
    text-align: left;
    cursor: pointer;
    transition: all var(--t-fast) var(--ease);
    display: flex; flex-direction: column; gap: 4px;
  }
  .stage-card:hover { border-color: var(--brand); transform: translateY(-2px); box-shadow: var(--shadow-sm); }
  .stage-card.active { background: var(--ink); color: var(--brand-soft); border-color: var(--ink); box-shadow: var(--shadow-md); }
  .sc-idx { font-size: 10px; color: var(--ink-3); opacity: .7; font-weight: 700; }
  .stage-card.active .sc-idx { color: var(--brand-soft); opacity: .6; }
  .sc-short {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .06em;
    color: var(--brand);
    text-transform: uppercase;
  }
  .stage-card.active .sc-short { color: var(--brand-soft); }
  .sc-count { font-size: 26px; line-height: 1; font-weight: 700; letter-spacing: -0.02em; font-family: var(--font-display); }
  .sc-label { font-size: 11px; color: var(--ink-3); }
  .stage-card.active .sc-label { color: var(--brand-soft); opacity: .8; }
  .sc-drop {
    position: absolute;
    top: 10px; right: 10px;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--surface-sunk);
    color: var(--ink-3);
  }
  .sc-drop.hi { background: var(--bad-soft); color: var(--bad); }

  .matrix {
    display: grid;
    grid-template-columns: 60px repeat(var(--cols), minmax(38px, 1fr));
    gap: 3px;
    font-size: 11px;
  }
  .mh {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: .04em;
    text-align: center;
    padding: 6px 2px;
  }
  .mh:first-child { text-align: left; padding-left: 6px; }
  .mc {
    padding: 12px 4px;
    border-radius: 4px;
    text-align: center;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 12px;
  }
  .mc.role {
    background: var(--ink);
    color: var(--brand-soft);
    font-size: 11px;
    text-align: left;
    padding-left: 10px;
  }
  .mc.cell { background: var(--surface-sunk); color: var(--ink); }

  .dgrid {
    display: grid;
    grid-template-columns: 2fr 80px 1.3fr 1fr 1.3fr 1.2fr 110px;
    gap: 0;
  }
  .dh {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: .06em;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }
  .dc {
    padding: 12px;
    border-bottom: 1px solid var(--line-soft);
    color: var(--ink-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dc.strong { color: var(--ink); font-weight: 600; }
  .dc.strong:hover { color: var(--brand); }
  .dc.small { font-size: 11.5px; }
</style>
