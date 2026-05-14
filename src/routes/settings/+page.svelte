<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { config, setConfig, refreshAll, disconnect, syncState, dataset, toast, DEFAULT_SHEET_URL } from '$lib/data/stores.js';
  $: tabSummaryArr = $dataset.tabSummary || [];

  let sheetUrl = '';
  let refreshSec = 300;
  let autoRefresh = true;

  onMount(() => {
    const c = get(config);
    sheetUrl = c.sheetUrl || '';
    refreshSec = c.refreshSec || 300;
    autoRefresh = c.autoRefresh !== false;
  });

  async function connect() {
    setConfig({
      sheetUrl: sheetUrl.trim(),
      refreshSec: parseInt(refreshSec) || 300,
      autoRefresh,
    });
    await refreshAll();
    if ($syncState.status === 'ok') toast('Connected and synced.', 'success');
  }

  async function onDisconnect() {
    if (!confirm('Reset to the default ProgramOps hiring sheet?')) return;
    await disconnect();
    sheetUrl = DEFAULT_SHEET_URL;
  }

  $: isUsingDefault = (sheetUrl || '').trim() === DEFAULT_SHEET_URL.trim();

  function downloadAppsScript() {
    const text = `/**
 * HIRING PORTAL — Apps Script proxy
 * --------------------------------------------------------------
 * Lets the portal read PRIVATE Google Sheets without publishing them.
 * Deploy this as a Web app (Execute as: Me, Access: Anyone). Paste the
 * resulting /exec URL into the portal's Settings → Sheet URL field.
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var sheetName = params.sheet;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
    if (!sheet) return out_('Type\\nERROR,sheet "' + sheetName + '" not found');
    var data = sheet.getDataRange().getValues();
    var tz = Session.getScriptTimeZone();
    var csv = data.map(function (row) {
      return row.map(function (cell) {
        var v;
        if (cell === null || cell === undefined || cell === '') v = '';
        else if (cell instanceof Date) v = Utilities.formatDate(cell, tz, 'yyyy-MM-dd');
        else v = String(cell);
        return /[",\\n\\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\\r\\n');
    return out_(csv);
  } catch (err) { return out_('Type\\nERROR,' + err.message); }
}
function out_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.CSV);
}`;
    const blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u; a.download = 'apps-script.gs';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 100);
    toast('Apps Script downloaded.', 'success');
  }
</script>

<svelte:head><title>Settings · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">System</div>
    <h1>Settings</h1>
  </div>
</header>

<section class="grid-2">
  <div class="card pad-lg">
    <h2 class="serif" style="font-size:22px;margin-bottom:6px">Sheet source</h2>
    <p class="muted" style="font-size:13px;margin-bottom:18px">
      The portal is <strong style="color:var(--ink)">auto-connected</strong> to the ProgramOps hiring sheet — every visitor sees live data on first load. The portal auto-discovers all tabs, classifies each (summary stats / hiring plan / role tracker / candidate roster), and merges them. Sheet changes (rows, columns, new tabs) reflect on the next sync.
    </p>

    {#if isUsingDefault}
      <div class="card soft" style="padding:12px 14px;margin-bottom:18px;display:flex;align-items:center;gap:10px;border-color:var(--olive);background:var(--olive-soft)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A5634" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
        <div style="font-size:13px;color:#3A4426;font-weight:600">Using the default ProgramOps hiring sheet.</div>
      </div>
    {:else}
      <div class="card soft" style="padding:12px 14px;margin-bottom:18px;display:flex;align-items:center;gap:10px;border-color:var(--brand);background:var(--brand-soft)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-deep)" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
        <div style="font-size:13px;color:var(--brand-deep);font-weight:600">Using a custom sheet URL — only this browser sees this override.</div>
      </div>
    {/if}

    <div class="field">
      <label for="sheetUrl">Sheet URL</label>
      <input
        id="sheetUrl"
        class="input"
        bind:value={sheetUrl}
        placeholder="https://docs.google.com/spreadsheets/d/..."
        autocomplete="off"
        spellcheck="false"
      />
      <div class="muted hint">
        Share the sheet as <strong>Anyone with the link can view</strong>, or deploy the Apps Script proxy on the right and paste its <code>/exec</code> URL.
      </div>
    </div>

    <div class="row gap" style="flex-wrap:wrap;align-items:center">
      <label class="row gap-sm" style="font-size:13px;cursor:pointer">
        <input type="checkbox" bind:checked={autoRefresh} /> Auto-refresh every
        <select class="input sm" bind:value={refreshSec} style="width:auto">
          <option value={60}>1 min</option>
          <option value={120}>2 min</option>
          <option value={300}>5 min</option>
          <option value={600}>10 min</option>
          <option value={1800}>30 min</option>
        </select>
      </label>
    </div>

    <div class="row gap" style="margin-top:24px;flex-wrap:wrap">
      <button class="btn brand" on:click={connect}>
        {isUsingDefault ? 'Re-sync' : 'Update sheet URL'}
      </button>
      <button class="btn" on:click={() => refreshAll()} disabled={$syncState.status === 'syncing'}>
        {$syncState.status === 'syncing' ? 'Syncing…' : 'Refresh now'}
      </button>
      {#if !isUsingDefault}
        <button class="btn danger" on:click={onDisconnect}>Reset to default</button>
      {/if}
    </div>

    {#if $syncState.error}
      <div class="card" style="margin-top:18px;padding:14px 18px;background:var(--bad-soft);border-color:var(--bad)">
        <div style="font-weight:600;color:var(--brand-deep);margin-bottom:4px">Sync error</div>
        <div class="mono" style="font-size:12px;color:var(--brand-deep)">{$syncState.error}</div>
      </div>
    {/if}

    {#if tabSummaryArr.length}
      <div class="card soft" style="padding:18px;margin-top:20px">
        <div style="font-weight:700;font-size:13px;margin-bottom:8px">Tabs discovered ({tabSummaryArr.length})</div>
        <div class="tab-list">
          {#each tabSummaryArr as t}
            <div class="tab-row">
              <span class="pill outline">{t.kind}</span>
              <span class="mono" style="font-size:11px;color:var(--ink-3)">gid={t.gid}</span>
              <span style="font-size:12px;color:var(--ink);font-weight:600">{t.name}</span>
              <span class="muted" style="font-size:11px;margin-left:auto">
                {t.events != null ? `${t.events} events` : ''}
                {t.candidates != null ? `${t.candidates} candidates` : ''}
                {!t.events && !t.candidates ? `${t.rows || 0} rows` : ''}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="card pad-lg">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Apps Script proxy</h2>
    <p class="muted" style="font-size:13px;margin-bottom:14px">
      Optional. Use only if your sheet is <strong style="color:var(--ink)">private</strong> and you can't make it link-shareable.
    </p>

    <ol class="how">
      <li>Open your sheet → <b>Extensions → Apps Script</b>.</li>
      <li>Delete the placeholder code, paste the proxy, and save.</li>
      <li><b>Deploy → New deployment</b> → Type: <b>Web app</b> → Execute as: <b>Me</b> → Access: <b>Anyone</b>.</li>
      <li>Authorize when prompted.</li>
      <li>Copy the <b>Web app URL</b> (ends with <code>/exec</code>) and paste it as the Sheet URL.</li>
    </ol>

    <button class="btn" on:click={downloadAppsScript}>⬇ Download apps-script.gs</button>

    <p class="muted" style="font-size:11px;margin-top:14px">
      Note: the Apps Script approach returns one tab at a time. For multi-tab auto-discovery (the recommended path), use the regular share URL instead.
    </p>
  </div>
</section>

<style>
  .grid-2 { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; align-items: start; }
  @media (max-width: 1100px) { .grid-2 { grid-template-columns: 1fr; } }
  .field { margin-bottom: 18px; }
  .field label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--ink-2); }
  .field .hint { font-size: 11px; margin-top: 6px; color: var(--ink-3); }
  code { font-family: var(--font-mono); background: var(--surface-sunk); padding: 1px 6px; border-radius: 4px; font-size: 12px; }
  .how { padding-left: 20px; color: var(--ink-2); line-height: 1.8; font-size: 13px; margin-bottom: 18px; }
  .how b { color: var(--ink); }

  .tab-list { display: flex; flex-direction: column; gap: 4px; }
  .tab-row {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--line-soft);
  }
  .tab-row:last-child { border-bottom: 0; }
</style>
