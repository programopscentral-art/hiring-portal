<script>
  import { base } from '$app/paths';
  import IndiaMap from '$lib/components/IndiaMap.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import {
    byState, byUniversity, dataset, planByState, planByUniversity, ROLES,
  } from '$lib/data/stores.js';

  function fmt(n) { return (n || 0).toLocaleString(); }

  let tab = 'plan'; // 'plan' | 'candidates'
</script>

<svelte:head><title>Locations · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">Hiring portal</div>
    <h1 class="serif">Locations</h1>
    <p class="muted lead">
      <strong>{$planByState.length}</strong> states in the hiring plan with
      <strong>{$planByUniversity.length}</strong> university partners ·
      candidate pool spans <strong>{$byState.length}</strong> states from current applications.
    </p>
  </div>
  <div class="tabs">
    <button class="tab-btn" class:active={tab === 'plan'} on:click={() => tab = 'plan'}>Hiring plan</button>
    <button class="tab-btn" class:active={tab === 'candidates'} on:click={() => tab = 'candidates'}>Candidate pool</button>
  </div>
</header>

<section class="row gap" style="margin-top:18px;align-items:flex-start">
  <div class="card pad-lg" style="flex:1.4;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">India · {tab === 'plan' ? 'planned positions' : 'candidate distribution'}</h2>
    <div style="height:520px">
      <IndiaMap />
    </div>
  </div>

  <div class="card pad-lg" style="flex:1;min-width:0">
    {#if tab === 'plan'}
      <h2 class="serif" style="font-size:22px;margin-bottom:14px">Plan by state ({$planByState.length})</h2>
      {#if $planByState.length}
        <div class="state-grid">
          {#each $planByState as st}
            {@const pct = st.positions / $planByState[0].positions}
            <a class="state-card" href="{base}/locations/{encodeURIComponent(st.state)}">
              <div class="row between" style="align-items:flex-start">
                <div class="state-name">{st.state}</div>
                <div class="state-count display">{fmt(st.positions)}</div>
              </div>
              <div class="state-bar"><div class="state-fill plan" style="width:{Math.max(8, pct * 100)}%"></div></div>
              <div class="state-foot muted">
                <span class="planned">{st.universities.length} universities</span>
                {#if st.hired}<span class="ok">· {st.hired} hired</span>{/if}
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <EmptyState title="Hiring plan not loaded." body="Check Settings sync." />
      {/if}
    {:else}
      <h2 class="serif" style="font-size:22px;margin-bottom:14px">Candidate states ({$byState.length})</h2>
      {#if $byState.length}
        <div class="state-grid">
          {#each $byState as st}
            {@const pct = st.total / $byState[0].total}
            <a class="state-card" href="{base}/locations/{encodeURIComponent(st.state)}">
              <div class="row between" style="align-items:flex-start">
                <div class="state-name">{st.state}</div>
                <div class="state-count display">{fmt(st.total)}</div>
              </div>
              <div class="state-bar"><div class="state-fill" style="width:{Math.max(8, pct * 100)}%"></div></div>
              <div class="state-foot muted">
                <span class="ok">{fmt(st.active)} active</span>
                {#if st.hired}<span>· {fmt(st.hired)} hired</span>{/if}
                {#if st.rejected}<span>· {fmt(st.rejected)} rejected</span>{/if}
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <EmptyState title="No candidate state data yet." />
      {/if}
    {/if}
  </div>
</section>

<section class="row gap" style="margin-top:24px;align-items:flex-start">
  <!-- Plan universities (canonical) -->
  <div class="card pad-lg" style="flex:1;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Plan: university partners ({$planByUniversity.length})</h2>
    {#if $planByUniversity.length}
      <div class="dgrid" style="--cols:6">
        <div class="dh">University</div>
        <div class="dh">State</div>
        <div class="dh num">Positions</div>
        <div class="dh num">Hired</div>
        <div class="dh">Roles</div>
        <div class="dh">Type</div>
        {#each $planByUniversity as u}
          <div class="dc strong">{u.university}</div>
          <div class="dc small">
            <a href="{base}/locations/{encodeURIComponent(u.state)}">{u.state}</a>
          </div>
          <div class="dc num mono">{fmt(u.positions)}</div>
          <div class="dc num mono"><span class={u.hired ? 'ok' : ''}>{fmt(u.hired)}</span></div>
          <div class="dc small">
            {#each Object.entries(u.roles) as [r, n]}
              <span class="role-mini {r.toLowerCase()}" title="{r}: {n}">{r}·{n}</span>
            {/each}
          </div>
          <div class="dc small muted">{u.type || '—'}</div>
        {/each}
      </div>
    {:else}
      <EmptyState title="Plan sheet not loaded." body="The hiring plan comes from the secondary sheet (1NShjSPa...). Confirm both sheets are accessible." />
    {/if}
  </div>

  <!-- Candidate-derived companies -->
  <div class="card pad-lg" style="flex:1;min-width:0">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Candidate companies ({$byUniversity.length})</h2>
    {#if $byUniversity.length}
      <div class="uni-list">
        {#each $byUniversity.slice(0, 40) as u}
          <div class="uni-row">
            <div class="uni-name">{u.name}</div>
            <div class="uni-bar"><div class="uni-fill" style="width:{Math.max(6, (u.total / $byUniversity[0].total) * 100)}%"></div></div>
            <div class="uni-stats mono">
              <span>{fmt(u.total)}</span>
              {#if u.hired}<span class="ok">· {u.hired} hired</span>{/if}
            </div>
          </div>
        {/each}
      </div>
      <p class="muted small" style="margin-top:10px">Extracted from candidates' current-company strings. These are educational organizations candidates currently work at — not necessarily plan partners.</p>
    {:else}
      <EmptyState title="No candidate company data yet." />
    {/if}
  </div>
</section>

<style>
  .tabs { display: flex; gap: 4px; margin-top: 10px; }
  .tab-btn {
    padding: 8px 16px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line);
    background: var(--surface);
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink-2);
    cursor: pointer;
  }
  .tab-btn.active { background: var(--ink); color: var(--brand-soft); border-color: var(--ink); }

  .state-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
    max-height: 520px;
    overflow-y: auto;
    padding-right: 8px;
  }
  .state-card {
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--surface-soft);
    transition: all var(--t-fast) var(--ease);
  }
  .state-card:hover { border-color: var(--brand); transform: translateY(-2px); box-shadow: var(--shadow-sm); background: var(--surface); }
  .state-name { font-size: 13px; font-weight: 700; color: var(--ink); }
  .state-count { font-size: 28px; line-height: 1; }
  .state-bar { height: 6px; background: var(--surface-sunk); border-radius: 3px; overflow: hidden; margin: 10px 0 8px; }
  .state-fill { height: 100%; background: linear-gradient(90deg, var(--brand), var(--brand-deep)); }
  .state-fill.plan { background: linear-gradient(90deg, var(--gold, #C49A47), #8E6B36); }
  .state-foot { font-size: 11px; }
  .state-foot .ok { color: var(--ok); font-weight: 700; }
  .state-foot .planned { color: var(--mauve-deep); font-weight: 600; }

  .dgrid {
    display: grid;
    grid-template-columns: 1.6fr 1fr 90px 70px 1.3fr 1fr;
    gap: 0;
  }
  .dh {
    font-size: 10.5px; font-weight: 700; color: var(--ink-3);
    text-transform: uppercase; letter-spacing: .06em;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }
  .dh.num, .dc.num { text-align: right; font-family: var(--font-mono); }
  .dc {
    padding: 10px 12px;
    border-bottom: 1px solid var(--line-soft);
    color: var(--ink-2);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .dc.strong { color: var(--ink); font-weight: 600; }
  .dc .ok { color: var(--ok); font-weight: 700; }
  .dc.small, .small { font-size: 11.5px; }
  .role-mini {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 9.5px;
    font-weight: 800;
    color: #fff;
    margin-right: 3px;
    letter-spacing: .02em;
  }
  .role-mini.pma { background: var(--brand); }
  .role-mini.pm  { background: var(--mauve); }
  .role-mini.cos { background: var(--olive); }
  .role-mini.boa { background: var(--gold, #C49A47); }

  .uni-list { display: flex; flex-direction: column; gap: 4px; max-height: 520px; overflow-y: auto; }
  .uni-row {
    display: grid;
    grid-template-columns: 1.6fr 1fr 130px;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line-soft);
  }
  .uni-name { font-size: 12px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .uni-bar { height: 6px; background: var(--surface-sunk); border-radius: 3px; overflow: hidden; }
  .uni-fill { height: 100%; background: linear-gradient(90deg, var(--mauve), var(--mauve-deep)); }
  .uni-stats { text-align: right; font-size: 11px; color: var(--ink-2); font-weight: 600; }
  .uni-stats .ok { color: var(--ok); }
</style>
