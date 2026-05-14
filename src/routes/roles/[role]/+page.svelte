<script>
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dataset, STAGES, STAGE_INDEX, STAGE_KEYS } from '$lib/data/stores.js';
  import Funnel from '$lib/components/Funnel.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  $: role = ($page.params.role || '').toUpperCase();
  $: roleCandidates = $dataset.candidates.filter(c => {
    const r = (c.role || '').toUpperCase();
    if (role === 'PMA') return r.startsWith('PMA');
    if (role === 'PM')  return r.startsWith('PM') && !r.startsWith('PMA');
    if (role === 'COS') return r.startsWith('COS');
    if (role === 'BOA') return r.startsWith('BOA');
    return false;
  });

  $: roleFunnel = (() => {
    const counts = Object.fromEntries(STAGE_KEYS.map(k => [k, 0]));
    for (const c of roleCandidates) {
      const maxIdx = STAGE_INDEX[c.currentStage] ?? -1;
      if (maxIdx >= 0) for (let i = 0; i <= maxIdx; i++) counts[STAGE_KEYS[i]]++;
    }
    return STAGES.map(s => ({ ...s, count: counts[s.key] }));
  })();

  $: kpi = {
    total: roleCandidates.length,
    active: roleCandidates.filter(c => c.finalDecision === 'active').length,
    hired: roleCandidates.filter(c => c.finalDecision === 'hired').length,
    rejected: roleCandidates.filter(c => c.finalDecision === 'rejected').length,
  };

  $: rejReasons = (() => {
    const m = new Map();
    for (const c of roleCandidates) {
      if (c.finalDecision !== 'rejected') continue;
      const key = c.rejectionReason || 'Not specified';
      m.set(key, (m.get(key) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  })();

  $: sources = (() => {
    const m = new Map();
    for (const c of roleCandidates) {
      const src = c.sourceName || 'Unknown';
      if (!m.has(src)) m.set(src, { source: src, total: 0, hired: 0 });
      const x = m.get(src);
      x.total++;
      if (c.finalDecision === 'hired') x.hired++;
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  })();

  function fmt(n) { return (n || 0).toLocaleString(); }
</script>

<svelte:head><title>{role} · Roles</title></svelte:head>

<a class="back" href="{base}/roles">← All roles</a>

<header class="page-head fade-up">
  <div class="row gap" style="align-items:center">
    <div class="role-pill xl {role.toLowerCase()}">{role}</div>
    <div>
      <div class="crumb">Role</div>
      <h1 class="serif">{role}</h1>
      <p class="muted lead">{fmt(kpi.total)} candidates total</p>
    </div>
  </div>
</header>

<section class="kpi-grid">
  <div class="kpi"><div class="kl">Active</div><div class="kv display ok">{fmt(kpi.active)}</div></div>
  <div class="kpi"><div class="kl">Hired</div><div class="kv display brand">{fmt(kpi.hired)}</div></div>
  <div class="kpi"><div class="kl">Rejected</div><div class="kv display bad">{fmt(kpi.rejected)}</div></div>
  <div class="kpi"><div class="kl">Total</div><div class="kv display">{fmt(kpi.total)}</div></div>
</section>

<section class="row gap" style="margin-top:20px;align-items:flex-start">
  <div class="card pad-lg" style="flex:1.4;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">{role} funnel</h2>
    {#if roleFunnel[0]?.count}
      <Funnel stages={roleFunnel.map(s => ({ stage: s.label, count: s.count }))} accent="brand" />
    {:else}
      <EmptyState title="No candidates for {role} yet." />
    {/if}
  </div>

  <div class="card pad-lg" style="flex:1;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Top sources</h2>
    {#if sources.length}
      <div class="src-list">
        {#each sources as s}
          <div class="src-row">
            <div class="src-name">{s.source}</div>
            <div class="src-bar"><div class="src-fill" style="width:{Math.max(6, (s.total / sources[0].total) * 100)}%"></div></div>
            <div class="src-meta mono">
              <span>{fmt(s.total)}</span>
              {#if s.hired}<span class="ok">· {s.hired} hired</span>{/if}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <EmptyState title="No source data." />
    {/if}
  </div>
</section>

{#if rejReasons.length}
  <section class="card pad-lg" style="margin-top:20px">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Rejection reasons for {role}</h2>
    <div class="rej-list">
      {#each rejReasons as [reason, count]}
        <div class="rej-row">
          <div class="rej-name">{reason}</div>
          <div class="rej-bar"><div class="rej-fill" style="width:{Math.max(6, (count / rejReasons[0][1]) * 100)}%"></div></div>
          <div class="rej-count mono">{fmt(count)}</div>
        </div>
      {/each}
    </div>
  </section>
{/if}

<section class="card pad-lg" style="margin-top:20px">
  <h2 class="serif" style="font-size:22px;margin-bottom:14px">All {role} candidates ({fmt(roleCandidates.length)})</h2>
  {#if roleCandidates.length}
    <div class="dgrid" style="--cols:6">
      <div class="dh">Name</div>
      <div class="dh">Stage</div>
      <div class="dh">Location</div>
      <div class="dh">Source</div>
      <div class="dh">Exp. CTC</div>
      <div class="dh">Decision</div>
      {#each roleCandidates.slice(0, 200) as c}
        <a class="dc strong" href="{base}/candidates/{encodeURIComponent(c.nameKey)}">{c.name}</a>
        <div class="dc small">{STAGES.find(s => s.key === c.currentStage)?.label || '—'}</div>
        <div class="dc small">{c.location || c.currentLocation || '—'}</div>
        <div class="dc small">{c.sourceName || '—'}</div>
        <div class="dc mono small">{c.expectedCTC || '—'}</div>
        <div class="dc"><StatusPill decision={c.finalDecision === 'active' ? 'pending' : c.finalDecision === 'hired' ? 'selected' : c.finalDecision} /></div>
      {/each}
    </div>
    {#if roleCandidates.length > 200}
      <div class="muted" style="font-size:12px;margin-top:12px;text-align:center">Showing first 200 of {fmt(roleCandidates.length)}.</div>
    {/if}
  {:else}
    <EmptyState title="No candidates yet." />
  {/if}
</section>

<style>
  .back { display: inline-block; margin-bottom: 16px; color: var(--ink-2); font-size: 13px; font-weight: 600; }
  .back:hover { color: var(--brand); }

  .role-pill.xl {
    width: 80px; height: 80px;
    border-radius: 18px;
    font-size: 22px;
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800;
    box-shadow: 0 8px 24px rgba(0,0,0,.2);
  }
  .role-pill.xl.pma { background: var(--brand); }
  .role-pill.xl.pm  { background: var(--mauve); }
  .role-pill.xl.cos { background: var(--olive); }
  .role-pill.xl.boa { background: var(--gold); }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: 18px;
  }
  .kpi { padding: 18px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); }
  .kl { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); }
  .kv { font-size: 40px; line-height: 1; margin-top: 8px; }
  .kv.ok { color: var(--ok); }
  .kv.bad { color: var(--bad); }
  .kv.brand { color: var(--brand); }

  .src-list { display: flex; flex-direction: column; gap: 6px; }
  .src-row {
    display: grid;
    grid-template-columns: 130px 1fr 130px;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
  }
  .src-name { font-size: 12px; font-weight: 600; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .src-bar { height: 8px; background: var(--surface-sunk); border-radius: 4px; overflow: hidden; }
  .src-fill { height: 100%; background: linear-gradient(90deg, var(--brand), var(--brand-deep)); }
  .src-meta { text-align: right; font-size: 11px; color: var(--ink-2); font-weight: 600; }
  .src-meta .ok { color: var(--ok); }

  .rej-list { display: flex; flex-direction: column; gap: 6px; }
  .rej-row {
    display: grid;
    grid-template-columns: 1fr 1fr 80px;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line-soft);
  }
  .rej-name { font-size: 12.5px; font-weight: 600; color: var(--ink); }
  .rej-bar { height: 8px; background: var(--surface-sunk); border-radius: 4px; overflow: hidden; }
  .rej-fill { height: 100%; background: linear-gradient(90deg, var(--bad-soft), var(--bad)); }
  .rej-count { text-align: right; font-size: 12px; font-weight: 800; }

  .dgrid {
    display: grid;
    grid-template-columns: 2fr 1.3fr 1.3fr 1.3fr 100px 110px;
    gap: 0;
  }
  .dh {
    font-size: 10.5px; font-weight: 700; color: var(--ink-3);
    text-transform: uppercase; letter-spacing: .06em;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }
  .dc {
    padding: 12px;
    border-bottom: 1px solid var(--line-soft);
    color: var(--ink-2);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .dc.strong { color: var(--ink); font-weight: 600; }
  .dc.strong:hover { color: var(--brand); }
  .dc.small { font-size: 11.5px; }
  .small { font-size: 12px; }
</style>
