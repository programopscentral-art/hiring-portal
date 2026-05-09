<script>
  import { data, filters } from '$lib/data/stores.js';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import Filters from '$lib/components/Filters.svelte';

  // Build a unified candidate list from master + tracker shadows
  $: allCandidates = $data.candidates.map(c => ({
    id: c.__id,
    name: c.__name,
    role: c.__role || c.__lastEvent?.role || '',
    cycle: c.__cycle,
    source: c.__source,
    sourcer: c.__sourcedBy,
    stage: c.__currentStage || (c.__lastEvent ? `${c.__lastEvent.role} ${c.__lastEvent.stage}` : ''),
    status: c.__lastEvent?.decision || (c.__joiningStatus?.toLowerCase() === 'joined' ? 'selected' : 'pending'),
    joined: (c.__joiningStatus || '').toLowerCase() === 'joined',
    lastDate: c.__lastEvent?.parsedDate || null,
    isShadow: !!c.__isShadow,
  }));

  // Cross-reference candidates to plan via their role:
  //   - state filter: candidate's role must appear in that state's plan
  //   - university filter: candidate's role must appear in that university's plan
  // Strip trailing digits to match base role (PMA1 ↔ PMA).
  function baseRole(r) { return (r || '').replace(/[0-9]+$/, ''); }
  $: planRolesByState = (() => {
    const m = new Map();
    for (const p of $data.plan) {
      if (!m.has(p.state)) m.set(p.state, new Set());
      const set = m.get(p.state);
      set.add(p.role);
      set.add(baseRole(p.role));
    }
    return m;
  })();
  $: planRolesByUni = (() => {
    const m = new Map();
    for (const p of $data.plan) {
      if (!m.has(p.location)) m.set(p.location, new Set());
      const set = m.get(p.location);
      set.add(p.role);
      set.add(baseRole(p.role));
    }
    return m;
  })();

  function matchesRoleFilter(candidateRole, filterRole) {
    if (!filterRole) return true;
    if (!candidateRole) return false;
    return candidateRole === filterRole || baseRole(candidateRole) === baseRole(filterRole);
  }

  function matchesPlanRoleSet(candidateRole, roleSet) {
    if (!candidateRole) return false;
    return roleSet.has(candidateRole) || roleSet.has(baseRole(candidateRole));
  }

  $: filtered = allCandidates.filter(c => {
    if ($filters.search) {
      const q = $filters.search.toLowerCase();
      if (!(c.name?.toLowerCase().includes(q) || c.role?.toLowerCase().includes(q) || c.source?.toLowerCase().includes(q))) return false;
    }
    if (!matchesRoleFilter(c.role, $filters.role)) return false;
    if ($filters.source && c.source !== $filters.source) return false;
    if ($filters.stage && !c.stage?.toLowerCase().includes($filters.stage.toLowerCase())) return false;
    if ($filters.state) {
      const set = planRolesByState.get($filters.state);
      if (!set || !matchesPlanRoleSet(c.role, set)) return false;
    }
    if ($filters.university) {
      const set = planRolesByUni.get($filters.university);
      if (!set || !matchesPlanRoleSet(c.role, set)) return false;
    }
    return true;
  });

  $: totals = {
    all: filtered.length,
    joined: filtered.filter(c => c.joined).length,
    pipeline: filtered.filter(c => !c.joined && c.status !== 'rejected').length,
    rejected: filtered.filter(c => c.status === 'rejected').length,
  };

  $: roleBreakdown = (() => {
    const m = new Map();
    for (const c of filtered) {
      const r = baseRole(c.role) || 'Unknown';
      m.set(r, (m.get(r) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  })();

  let searchInput = $filters.search;
  function onSearchInput() { filters.update(f => ({ ...f, search: searchInput })); }
</script>

<svelte:head><title>Candidates · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">People</div>
    <h1>Candidates</h1>
  </div>
  <Filters />
</header>

<div class="row gap" style="margin-bottom:18px;flex-wrap:wrap">
  <div class="card" style="padding:6px 14px;display:flex;align-items:center;gap:8px;border-radius:99px;flex:1;max-width:480px">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
    <input bind:value={searchInput} on:input={onSearchInput} placeholder="Search name, role, source…" style="flex:1;border:0;background:transparent;outline:none;font-size:13px;padding:6px 0" />
  </div>
  <div class="row gap-sm" style="flex-wrap:wrap">
    <span class="pill"><span class="dot"></span> {totals.all} total</span>
    <span class="pill ok"><span class="dot"></span> {totals.joined} joined</span>
    <span class="pill warn"><span class="dot"></span> {totals.pipeline} in pipeline</span>
    <span class="pill bad"><span class="dot"></span> {totals.rejected} rejected</span>
  </div>
</div>

{#if roleBreakdown.length}
  <div class="row gap-sm" style="margin-bottom:14px;flex-wrap:wrap">
    <span style="font-size:11px;color:var(--ink-3);font-weight:600;text-transform:uppercase;letter-spacing:.08em">Roles</span>
    {#each roleBreakdown as [role, n]}
      <span class="pill brand">{role} · {n}</span>
    {/each}
  </div>
{/if}

{#if $filters.state || $filters.university}
  <div style="margin-bottom:12px;padding:10px 14px;background:var(--info-soft);border-radius:10px;font-size:12px;color:var(--ink-2)">
    <strong>Note:</strong> Candidates aren't pinned to a single state or university. The filter shows everyone whose role matches an open position in the selected {$filters.state ? 'state' : ''}{$filters.state && $filters.university ? ' and ' : ''}{$filters.university ? 'university' : ''}.
  </div>
{/if}

<div class="card" style="padding:0;overflow:hidden">
  <div class="table-wrap">
    <table class="table">
      <thead><tr>
        <th>Candidate</th><th>Role</th><th>Source</th><th>Sourced by</th>
        <th>Latest stage</th><th>Status</th><th>Last activity</th>
      </tr></thead>
      <tbody>
        {#each filtered.slice(0, 200) as c, i (c.id)}
          <tr class="row" on:click={() => goto(`${base}/candidates/${encodeURIComponent(c.id)}`)} in:fly={{ y: 4, delay: i * 6, duration: 240 }}>
            <td>
              <div class="row gap">
                <div class="ava">{c.name?.split(' ').filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase() || '?'}</div>
                <div>
                  <div style="font-weight:600">{c.name || '—'}</div>
                  {#if c.isShadow}
                    <div class="muted" style="font-size:10px">tracker only</div>
                  {:else}
                    <div class="muted" style="font-size:10px">{c.cycle || 'master'}</div>
                  {/if}
                </div>
              </div>
            </td>
            <td><span class="pill brand">{c.role || '—'}</span></td>
            <td>{c.source || '—'}</td>
            <td class="muted">{c.sourcer || '—'}</td>
            <td><span class="pill outline">{c.stage || '—'}</span></td>
            <td><StatusPill decision={c.status} /></td>
            <td class="muted mono" style="font-size:11px">{c.lastDate ? c.lastDate.toLocaleDateString() : '—'}</td>
          </tr>
        {:else}
          <tr><td colspan="7" class="empty">No candidates match.</td></tr>
        {/each}
      </tbody>
    </table>
    {#if filtered.length > 200}
      <div class="muted" style="text-align:center;padding:14px;font-size:12px">Showing 200 of {filtered.length} — refine filters to see more.</div>
    {/if}
  </div>
</div>

<style>
  .ava {
    width: 34px; height: 34px;
    border-radius: 50%;
    background: var(--surface-sunk);
    color: var(--ink-2);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 600;
  }
  .table-wrap { max-height: calc(100vh - 280px); overflow: auto; }
</style>
