<script>
  import { filters, data } from '$lib/data/stores.js';
  $: states = uniq($data.plan.map(p => p.state)).sort();
  $: roles = [...new Set([
    ...$data.plan.map(p => p.role),
    ...$data.activities.map(a => a.role),
    ...$data.candidates.map(c => c.__role).filter(Boolean),
  ].filter(Boolean))].sort();
  $: universities = uniq($data.plan.map(p => p.location)).sort();

  function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }
  function reset() { filters.set({ state: '', role: '', university: '', stage: '', source: '', search: '' }); }
  $: hasFilter = $filters.state || $filters.role || $filters.university || $filters.stage || $filters.source || $filters.search;

  function update(key, value) {
    filters.update(f => ({ ...f, [key]: value }));
  }
</script>

<div class="filters">
  <select
    class="input sm"
    aria-label="Filter by state"
    value={$filters.state}
    on:change={(e) => update('state', e.currentTarget.value)}
  >
    <option value="">All states</option>
    {#each states as s}<option value={s}>{s}</option>{/each}
  </select>

  <select
    class="input sm"
    aria-label="Filter by role"
    value={$filters.role}
    on:change={(e) => update('role', e.currentTarget.value)}
  >
    <option value="">All roles</option>
    {#each roles as r}<option value={r}>{r}</option>{/each}
  </select>

  <select
    class="input sm"
    aria-label="Filter by university"
    value={$filters.university}
    on:change={(e) => update('university', e.currentTarget.value)}
  >
    <option value="">All universities</option>
    {#each universities as u}<option value={u}>{u}</option>{/each}
  </select>

  {#if hasFilter}
    <button class="btn ghost sm" on:click={reset}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M18 6L6 18M6 6l12 12"/></svg>
      Reset
    </button>
  {/if}
</div>

<style>
  .filters {
    display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  }
  .input.sm {
    width: auto;
    padding: 8px 14px;
    font-size: 12px;
    background-image: linear-gradient(45deg, transparent 50%, var(--ink-3) 50%), linear-gradient(135deg, var(--ink-3) 50%, transparent 50%);
    background-position: calc(100% - 16px) center, calc(100% - 11px) center;
    background-size: 5px 5px, 5px 5px;
    background-repeat: no-repeat;
    appearance: none; -webkit-appearance: none;
    padding-right: 32px;
    cursor: pointer;
  }
</style>
