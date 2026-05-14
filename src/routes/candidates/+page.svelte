<script>
  import { base } from '$app/paths';
  import { dataset, filters, filteredCandidates, ROLES, STAGES } from '$lib/data/stores.js';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let q = '';
  $: $filters.search = q;

  let pageSize = 50;
  let pageIdx = 0;
  $: pages = Math.max(1, Math.ceil($filteredCandidates.length / pageSize));
  $: pageIdx = Math.min(pageIdx, pages - 1);
  $: visible = $filteredCandidates.slice(pageIdx * pageSize, (pageIdx + 1) * pageSize);

  function clearFilters() {
    filters.set({ role: '', stage: '', decision: '', state: '', university: '', source: '', panelist: '', search: '' });
    q = '';
    pageIdx = 0;
  }

  function stageOf(c) {
    const s = STAGES.find(x => x.key === c.currentStage);
    return s?.short || c.currentStage || '—';
  }

  function fmt(n) { return (n || 0).toLocaleString(); }
</script>

<svelte:head><title>Candidates · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">Hiring portal</div>
    <h1 class="serif">Candidates</h1>
    <p class="muted lead">{fmt($filteredCandidates.length)} of {fmt($dataset.candidates.length)} candidates · click any row for 360° detail.</p>
  </div>
</header>

<section class="filterbar card pad">
  <input
    class="input"
    placeholder="Search by name, email, phone, location…"
    bind:value={q}
    style="flex:1;min-width:200px"
  />

  <select class="input sm" bind:value={$filters.role} on:change={() => pageIdx = 0}>
    <option value="">All roles</option>
    {#each ROLES as r}<option value={r}>{r}</option>{/each}
  </select>

  <select class="input sm" bind:value={$filters.stage} on:change={() => pageIdx = 0}>
    <option value="">All stages</option>
    {#each STAGES as s}<option value={s.key}>{s.label}</option>{/each}
  </select>

  <select class="input sm" bind:value={$filters.decision} on:change={() => pageIdx = 0}>
    <option value="">All decisions</option>
    <option value="active">Active</option>
    <option value="hired">Hired</option>
    <option value="rejected">Rejected</option>
  </select>

  <button class="btn ghost sm" on:click={clearFilters}>Clear</button>
</section>

<section class="card pad" style="margin-top:18px">
  {#if visible.length}
    <div class="dgrid" style="--cols:8">
      <div class="dh">Name</div>
      <div class="dh">Role</div>
      <div class="dh">Stage</div>
      <div class="dh">Location</div>
      <div class="dh">Phone</div>
      <div class="dh">Source</div>
      <div class="dh">CTC (exp)</div>
      <div class="dh">Status</div>
      {#each visible as c}
        <a class="dc strong" href="{base}/candidates/{encodeURIComponent(c.nameKey)}">{c.name}</a>
        <div class="dc">{c.role || '—'}</div>
        <div class="dc"><span class="stage-tag">{stageOf(c)}</span></div>
        <div class="dc small">{c.location || c.currentLocation || '—'}</div>
        <div class="dc mono small">{c.phone || '—'}</div>
        <div class="dc small">{c.sourceName || '—'}</div>
        <div class="dc mono small">{c.expectedCTC || '—'}</div>
        <div class="dc"><StatusPill decision={c.finalDecision === 'active' ? 'pending' : c.finalDecision === 'hired' ? 'selected' : c.finalDecision} /></div>
      {/each}
    </div>

    <div class="pager">
      <button class="btn ghost sm" disabled={pageIdx === 0} on:click={() => pageIdx = Math.max(0, pageIdx - 1)}>← Prev</button>
      <span class="muted" style="font-size:12px">Page {pageIdx + 1} of {pages}</span>
      <button class="btn ghost sm" disabled={pageIdx >= pages - 1} on:click={() => pageIdx = Math.min(pages - 1, pageIdx + 1)}>Next →</button>
    </div>
  {:else}
    <EmptyState title="No candidates match these filters." actionLabel="Clear filters" actionHref="#" />
  {/if}
</section>

<style>
  .filterbar {
    margin-top: 18px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .dgrid {
    display: grid;
    grid-template-columns: 1.8fr 80px 80px 1.4fr 1.1fr 1.3fr 100px 110px;
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
  .stage-tag {
    font-size: 10px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--brand-soft);
    color: var(--brand-deep);
  }
  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 16px 0 4px;
  }
</style>
