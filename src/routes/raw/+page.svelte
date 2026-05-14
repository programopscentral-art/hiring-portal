<script>
  import { dataset, TAB_MAP } from '$lib/data/stores.js';

  let selectedGid = '';
  $: tabs = Object.entries($dataset.rawTabs || {})
    .map(([gid, t]) => ({
      gid,
      name: t.name || TAB_MAP[gid]?.name || `Tab ${gid}`,
      kind: t.kind || TAB_MAP[gid]?.kind || 'raw',
      headers: t.headers || [],
      rows: t.rows || [],
    }))
    .sort((a, b) => b.rows.length - a.rows.length);

  $: if (!selectedGid && tabs.length) selectedGid = tabs[0].gid;
  $: current = tabs.find(t => t.gid === selectedGid);

  let pageSize = 50;
  let pageIdx = 0;
  $: pages = current ? Math.max(1, Math.ceil(current.rows.length / pageSize)) : 1;
  $: visibleRows = current ? current.rows.slice(pageIdx * pageSize, (pageIdx + 1) * pageSize) : [];

  $: { void selectedGid; pageIdx = 0; }

  let q = '';
  $: filteredRows = q && current
    ? current.rows.filter(r => r.some(c => (c || '').toLowerCase().includes(q.toLowerCase())))
    : current?.rows || [];
  $: visibleSearch = filteredRows.slice(pageIdx * pageSize, (pageIdx + 1) * pageSize);
  $: pagesSearch = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  function fmt(n) { return (n || 0).toLocaleString(); }
</script>

<svelte:head><title>Raw data · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">Hiring portal</div>
    <h1 class="serif">Raw data</h1>
    <p class="muted lead">All {tabs.length} tabs from the source sheet — paginated, searchable. Use this when you need to audit a number anywhere in the portal.</p>
  </div>
</header>

<section class="row gap" style="margin-top:18px;align-items:flex-start">
  <aside class="card pad" style="width:280px;flex-shrink:0;max-height:80vh;overflow-y:auto">
    <div class="muted" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:10px">Tabs ({tabs.length})</div>
    <div class="tab-list">
      {#each tabs as t}
        <button class="tab" class:active={selectedGid === t.gid} on:click={() => selectedGid = t.gid}>
          <div class="tab-name">{t.name}</div>
          <div class="tab-meta">
            <span class="kind kind-{t.kind}">{t.kind}</span>
            <span class="mono">{fmt(t.rows.length)} rows</span>
          </div>
        </button>
      {/each}
    </div>
  </aside>

  <div class="card pad-lg" style="flex:1;min-width:0">
    {#if current}
      <div class="row between" style="align-items:flex-start;margin-bottom:14px">
        <div>
          <h2 class="serif" style="font-size:22px">{current.name}</h2>
          <div class="muted small">
            gid={current.gid} · {fmt(current.headers.length)} columns · {fmt(filteredRows.length)} {q ? 'matching' : ''} rows
          </div>
        </div>
        <input class="input sm" placeholder="Filter rows…" bind:value={q} style="width:240px" />
      </div>

      <div class="raw-wrap">
        <table class="raw-table">
          <thead>
            <tr>
              <th class="idx">#</th>
              {#each current.headers as h, i}
                <th title={h}>{h || `Col ${i + 1}`}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each visibleSearch as r, i}
              <tr>
                <td class="idx mono">{pageIdx * pageSize + i + 1}</td>
                {#each current.headers as _, j}
                  <td class="cell">{r[j] || ''}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="pager">
        <button class="btn ghost sm" disabled={pageIdx === 0} on:click={() => pageIdx = Math.max(0, pageIdx - 1)}>← Prev</button>
        <span class="muted" style="font-size:12px">Page {pageIdx + 1} of {pagesSearch}</span>
        <button class="btn ghost sm" disabled={pageIdx >= pagesSearch - 1} on:click={() => pageIdx = Math.min(pagesSearch - 1, pageIdx + 1)}>Next →</button>
      </div>
    {:else}
      <div class="muted">No tab selected.</div>
    {/if}
  </div>
</section>

<style>
  .small { font-size: 12px; }
  .tab-list { display: flex; flex-direction: column; gap: 2px; }
  .tab {
    text-align: left;
    background: transparent;
    border: 0;
    padding: 10px 12px;
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: background var(--t-fast) var(--ease);
    width: 100%;
  }
  .tab:hover { background: var(--surface-soft); }
  .tab.active { background: var(--ink); color: var(--brand-soft); }
  .tab-name {
    font-size: 12.5px;
    font-weight: 700;
    color: inherit;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tab.active .tab-name { color: var(--brand-soft); }
  .tab-meta {
    display: flex; align-items: center; gap: 8px;
    margin-top: 4px;
    font-size: 10.5px;
    color: var(--ink-3);
  }
  .tab.active .tab-meta { color: rgba(255, 211, 172, .7); }
  .kind {
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--surface-sunk);
    color: var(--ink-3);
    text-transform: uppercase;
    font-size: 9.5px;
    letter-spacing: .04em;
  }
  .kind-roleApp { background: var(--brand-soft); color: var(--brand-deep); }
  .kind-stage { background: var(--mauve-soft); color: var(--mauve-deep); }
  .kind-roleStage { background: var(--gold-soft, #f3e8d0); color: #8E6B36; }
  .kind-roleShortlist { background: var(--brand-soft); color: var(--brand-deep); }
  .kind-details { background: var(--ok-soft); color: #4A5634; }
  .kind-candidatesData { background: var(--ink); color: var(--brand-soft); }
  .kind-rejectionTax, .kind-statusEnums, .kind-dashboardData { background: var(--ok-soft); color: #4A5634; }

  .raw-wrap {
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    max-height: 65vh;
    overflow-y: auto;
  }
  .raw-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 11.5px;
  }
  .raw-table th {
    position: sticky; top: 0;
    background: var(--surface-soft);
    padding: 8px 10px;
    text-align: left;
    font-weight: 700;
    color: var(--ink-2);
    border-bottom: 2px solid var(--line);
    white-space: nowrap;
    z-index: 1;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: .04em;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .raw-table td {
    padding: 6px 10px;
    border-bottom: 1px solid var(--line-soft);
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink-2);
  }
  .raw-table td.idx { font-size: 10px; color: var(--ink-3); }
  .raw-table th.idx { font-size: 10px; }
  .raw-table tr:hover td { background: var(--surface-soft); }

  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 14px 0 4px;
  }
</style>
