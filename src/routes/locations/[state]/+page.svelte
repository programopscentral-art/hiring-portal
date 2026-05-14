<script>
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { byState, ROLES, STAGES, dataset, planByState } from '$lib/data/stores.js';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  $: state = decodeURIComponent($page.params.state);
  $: stateData = $byState.find(s => s.state === state);
  $: statePlan = $planByState.find(s => s.state === state);
  $: candidates = stateData?.candidates || [];

  // Group by university/company
  $: byUni = (() => {
    const m = new Map();
    for (const c of candidates) {
      const co = c.currentCompany || c.application?.currentCompany;
      if (!co) continue;
      if (!m.has(co)) m.set(co, { name: co, count: 0, hired: 0, rejected: 0, candidates: [] });
      const u = m.get(co);
      u.count++;
      u.candidates.push(c);
      if (c.finalDecision === 'hired') u.hired++;
      else if (c.finalDecision === 'rejected') u.rejected++;
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  })();

  // Group by role
  $: byRole = (() => {
    const m = Object.fromEntries(ROLES.map(r => [r, { total: 0, active: 0, hired: 0, rejected: 0 }]));
    for (const c of candidates) {
      let r = (c.role || '').toUpperCase();
      if (r.startsWith('PMA')) r = 'PMA';
      else if (r.startsWith('PM')) r = 'PM';
      else if (r.startsWith('COS')) r = 'COS';
      else if (r.startsWith('BOA')) r = 'BOA';
      else continue;
      m[r].total++;
      if (c.finalDecision === 'hired') m[r].hired++;
      else if (c.finalDecision === 'rejected') m[r].rejected++;
      else m[r].active++;
    }
    return m;
  })();

  function fmt(n) { return (n || 0).toLocaleString(); }
</script>

<svelte:head><title>{state} · Locations</title></svelte:head>

<a class="back" href="{base}/locations">← All locations</a>

{#if !stateData && !statePlan}
  <EmptyState title="No data for this state." body="Try a different state from the Locations index." actionLabel="All locations" actionHref="{base}/locations" />
{:else}
  {@const sd = stateData || { total: 0, active: 0, hired: 0, rejected: 0, candidates: [] }}
  <header class="page-head fade-up">
    <div>
      <div class="crumb">Locations</div>
      <h1 class="serif">{state}</h1>
      <p class="muted lead">
        {#if statePlan}<strong>{fmt(statePlan.positions)} planned positions</strong> across {statePlan.universities.length} universities · {/if}
        {fmt(sd.total)} candidates in pool · {byUni.length} unique companies
      </p>
    </div>
  </header>

  <section class="kpi-grid">
    {#if statePlan}
      <div class="kpi"><div class="kl">Plan positions</div><div class="kv display planned">{fmt(statePlan.positions)}</div></div>
      <div class="kpi"><div class="kl">Plan hired</div><div class="kv display brand">{fmt(statePlan.hired)}</div></div>
    {/if}
    <div class="kpi"><div class="kl">Candidates</div><div class="kv display">{fmt(sd.total)}</div></div>
    <div class="kpi"><div class="kl">Active</div><div class="kv display ok">{fmt(sd.active)}</div></div>
    <div class="kpi"><div class="kl">Hired</div><div class="kv display brand">{fmt(sd.hired)}</div></div>
    <div class="kpi"><div class="kl">Rejected</div><div class="kv display bad">{fmt(sd.rejected)}</div></div>
  </section>

  {#if statePlan && statePlan.rows.length}
    <section class="card pad-lg" style="margin-top:20px">
      <h2 class="serif" style="font-size:22px;margin-bottom:14px">University partners in {state} ({statePlan.universities.length})</h2>
      <div class="dgrid" style="--cols:5">
        <div class="dh">University</div>
        <div class="dh">Type</div>
        <div class="dh">Role</div>
        <div class="dh num">Positions</div>
        <div class="dh">Status</div>
        {#each statePlan.rows as p}
          <div class="dc strong">{p.university}</div>
          <div class="dc small muted">{p.type || '—'}</div>
          <div class="dc"><span class="role-mini {p.role.toLowerCase()}">{p.roleSlot || p.role}</span></div>
          <div class="dc num mono">{fmt(p.positions)}</div>
          <div class="dc">
            {#if p.hired}<span class="pill solid ok-pill">Hired</span>
            {:else}<span class="muted small">Open</span>{/if}
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <section class="card pad-lg" style="margin-top:20px">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">By role · {state}</h2>
    <div class="role-grid">
      {#each ROLES as r}
        {@const s = byRole[r]}
        <a class="role-card" href="{base}/roles/{r}">
          <div class="role-pill {r.toLowerCase()}">{r}</div>
          <div class="grow">
            <div class="role-tot display">{fmt(s.total)}</div>
            <div class="role-foot muted">
              <span class="ok">{fmt(s.active)} active</span> ·
              <span>{fmt(s.hired)} hired</span> ·
              <span>{fmt(s.rejected)} rejected</span>
            </div>
          </div>
        </a>
      {/each}
    </div>
  </section>

  <section class="card pad-lg" style="margin-top:20px">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">All candidates from {state} ({fmt(candidates.length)})</h2>
    <div class="dgrid" style="--cols:6">
      <div class="dh">Name</div>
      <div class="dh">Role</div>
      <div class="dh">Current stage</div>
      <div class="dh">Source</div>
      <div class="dh">Company</div>
      <div class="dh">Decision</div>
      {#each candidates.slice(0, 200) as c}
        <a class="dc strong" href="{base}/candidates/{encodeURIComponent(c.nameKey)}">{c.name}</a>
        <div class="dc">{c.role || '—'}</div>
        <div class="dc small">{STAGES.find(s => s.key === c.currentStage)?.label || '—'}</div>
        <div class="dc small">{c.sourceName || '—'}</div>
        <div class="dc small">{c.currentCompany || '—'}</div>
        <div class="dc"><StatusPill decision={c.finalDecision === 'active' ? 'pending' : c.finalDecision === 'hired' ? 'selected' : c.finalDecision} /></div>
      {/each}
    </div>
    {#if candidates.length > 200}
      <div class="muted" style="font-size:12px;margin-top:12px;text-align:center">Showing first 200 of {fmt(candidates.length)}. Use the Candidates page to paginate.</div>
    {/if}
  </section>
{/if}

<style>
  .back { display: inline-block; margin-bottom: 16px; color: var(--ink-2); font-size: 13px; font-weight: 600; }
  .back:hover { color: var(--brand); }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: 18px;
  }
  @media (max-width: 720px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .kpi {
    padding: 18px;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--surface);
  }
  .kl { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); }
  .kv { font-size: 40px; line-height: 1; margin-top: 8px; }
  .kv.ok { color: var(--ok); }
  .kv.bad { color: var(--bad); }
  .kv.brand { color: var(--brand); }
  .kv.planned { color: var(--gold-deep, #8E6B36); }

  .role-mini {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 800;
    color: #fff;
    letter-spacing: .02em;
  }
  .role-mini.pma { background: var(--brand); }
  .role-mini.pm  { background: var(--mauve); }
  .role-mini.cos { background: var(--olive); }
  .role-mini.boa { background: var(--gold, #C49A47); }
  .ok-pill { background: var(--ok); color: #fff; padding: 3px 10px; border-radius: 99px; font-size: 10px; font-weight: 800; }

  .role-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  @media (max-width: 720px) { .role-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .role-card {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--surface-soft);
    transition: all var(--t-fast) var(--ease);
  }
  .role-card:hover { border-color: var(--brand); transform: translateY(-2px); background: var(--surface); }
  .role-pill {
    width: 48px; height: 48px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 12px; color: #fff;
    flex-shrink: 0;
  }
  .role-pill.pma { background: var(--brand); }
  .role-pill.pm  { background: var(--mauve); }
  .role-pill.cos { background: var(--olive); }
  .role-pill.boa { background: var(--gold); }
  .role-tot { font-size: 26px; line-height: 1; font-weight: 700; }
  .role-foot { font-size: 11px; margin-top: 2px; }
  .role-foot .ok { color: var(--ok); font-weight: 600; }

  .uni-list { display: flex; flex-direction: column; gap: 4px; }
  .uni-row {
    display: grid;
    grid-template-columns: 1.5fr 1fr 200px;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line-soft);
  }
  .uni-name { font-size: 13px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .uni-bar { height: 8px; background: var(--surface-sunk); border-radius: 4px; overflow: hidden; }
  .uni-fill { height: 100%; background: linear-gradient(90deg, var(--mauve), var(--mauve-deep)); }
  .uni-stats { text-align: right; font-size: 11.5px; color: var(--ink-2); font-weight: 600; }
  .uni-stats .ok { color: var(--ok); }
  .uni-stats .bad { color: var(--bad); }

  .dgrid {
    display: grid;
    grid-template-columns: 2fr 100px 1.3fr 1.2fr 1.4fr 110px;
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
</style>
