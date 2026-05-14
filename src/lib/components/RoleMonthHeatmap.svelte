<script>
  import { fade } from 'svelte/transition';
  // activities: array of { role, parsedDate, decision, ... }
  export let activities = [];
  export let metric = 'all'; // 'all' | 'selected' | 'rejected'

  function shortMonth(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
  }

  function ymKey(d) {
    if (!d) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // Build matrix: roles × months
  $: matrix = (() => {
    const monthSet = new Set();
    const roleSet = new Set();
    const cells = new Map();  // `${role}|${month}` → count

    for (const a of activities) {
      if (!a.parsedDate) continue;
      if (metric === 'selected' && a.decision !== 'selected') continue;
      if (metric === 'rejected' && a.decision !== 'rejected') continue;
      const m = ymKey(a.parsedDate);
      if (!m) continue;
      monthSet.add(m);
      roleSet.add(a.role);
      const k = `${a.role}|${m}`;
      cells.set(k, (cells.get(k) || 0) + 1);
    }

    const months = [...monthSet].sort();
    // Standard role order
    const roleOrder = ['PMA', 'PM', 'COS', 'BOA'];
    const roles = roleOrder.filter(r => roleSet.has(r)).concat([...roleSet].filter(r => !roleOrder.includes(r)));

    const max = Math.max(1, ...[...cells.values()]);

    const rows = roles.map(role => ({
      role,
      cells: months.map(m => ({
        month: m,
        count: cells.get(`${role}|${m}`) || 0,
        intensity: (cells.get(`${role}|${m}`) || 0) / max,
      })),
      total: months.reduce((s, m) => s + (cells.get(`${role}|${m}`) || 0), 0),
    }));

    return { months, rows, max };
  })();

  let hovered = null;

  function bgFor(intensity) {
    if (intensity === 0) return 'var(--surface-sunk)';
    // Tuscan brand soft → deep gradient
    const alpha = 0.15 + intensity * 0.85;
    return `rgba(227, 83, 54, ${alpha})`;
  }
  function fgFor(intensity) {
    return intensity > 0.5 ? '#fff' : 'var(--ink)';
  }
</script>

<div class="hm-wrap">
  {#if matrix.months.length === 0}
    <div class="empty">No date-stamped activity yet to chart.</div>
  {:else}
    <div class="hm-grid" style="--cols: {matrix.months.length}">
      <!-- Header row -->
      <div class="hm-corner"></div>
      {#each matrix.months as m}
        <div class="hm-month-h">{shortMonth(m)}</div>
      {/each}
      <div class="hm-total-h">Total</div>

      <!-- Data rows -->
      {#each matrix.rows as row (row.role)}
        <div class="hm-role-h"><span class="pill solid">{row.role}</span></div>
        {#each row.cells as c}
          <div
            class="hm-cell"
            class:hovered={hovered?.role === row.role && hovered?.month === c.month}
            style="background: {bgFor(c.intensity)}; color: {fgFor(c.intensity)}"
            on:mouseenter={() => hovered = { role: row.role, month: c.month, count: c.count }}
            on:mouseleave={() => { if (hovered?.role === row.role && hovered?.month === c.month) hovered = null; }}
            role="img"
            aria-label="{row.role} {c.month}: {c.count} events"
          >
            {#if c.count > 0}{c.count}{/if}
          </div>
        {/each}
        <div class="hm-total mono">{row.total}</div>
      {/each}
    </div>

    <div class="hm-legend">
      <span class="hm-leg-lbl">Less</span>
      <div class="hm-leg-scale">
        {#each [0, 0.2, 0.4, 0.6, 0.8, 1] as v}
          <span class="hm-leg-sw" style="background: {bgFor(v)}"></span>
        {/each}
      </div>
      <span class="hm-leg-lbl">More</span>
      <span class="hm-leg-max mono">peak: {matrix.max}/cell</span>
    </div>
  {/if}
</div>

<style>
  .hm-wrap { width: 100%; }
  .hm-grid {
    display: grid;
    grid-template-columns: 64px repeat(var(--cols), minmax(54px, 1fr)) 64px;
    gap: 4px;
    width: 100%;
  }

  .hm-corner, .hm-total-h, .hm-month-h, .hm-role-h {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: .06em;
    padding: 8px 6px;
  }
  .hm-month-h, .hm-total-h { text-align: center; }
  .hm-role-h {
    display: flex;
    align-items: center;
    padding: 6px 4px;
  }
  .hm-role-h .pill { font-size: 11px; font-weight: 700; padding: 4px 10px; }

  .hm-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    border-radius: 6px;
    padding: 14px 6px;
    transition: transform 140ms var(--ease);
    cursor: default;
  }
  .hm-cell.hovered, .hm-cell:hover {
    transform: scale(1.06);
    box-shadow: 0 4px 12px rgba(26, 15, 8, .15);
    outline: 2px solid var(--ink);
  }
  .hm-total {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 800;
    color: var(--ink);
    background: var(--brand-soft-2);
    border: 1px solid var(--brand-soft);
    border-radius: 6px;
  }

  .hm-legend {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--line-soft);
    font-size: 11px;
    color: var(--ink-3);
    font-weight: 600;
  }
  .hm-leg-scale { display: flex; gap: 2px; }
  .hm-leg-sw { width: 18px; height: 12px; border-radius: 3px; }
  .hm-leg-lbl { font-size: 11px; color: var(--ink-3); }
  .hm-leg-max { margin-left: auto; color: var(--ink-2); }
  .empty {
    text-align: center;
    padding: 32px;
    color: var(--muted);
    font-size: 12px;
  }
</style>
