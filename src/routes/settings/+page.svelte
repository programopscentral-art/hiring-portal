<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { config, setConfig, refreshAll, disconnect, syncState, rawMaster, rawSummary, rawTracker, toast } from '$lib/data/stores.js';

  // Local form state — initialized once on mount, not bound reactively to the
  // store (which would fight the user's typing).
  let masterUrl = '';
  let trackerUrl = '';
  let rosterUrl = '';
  let refreshSec = 300;
  let autoRefresh = true;

  onMount(() => {
    const c = get(config);
    masterUrl = c.masterUrl || '';
    trackerUrl = c.trackerUrl || '';
    rosterUrl = c.rosterUrl || '';
    refreshSec = c.refreshSec || 300;
    autoRefresh = c.autoRefresh !== false;
  });

  async function connect() {
    setConfig({
      masterUrl: masterUrl.trim(),
      trackerUrl: trackerUrl.trim(),
      rosterUrl: rosterUrl.trim(),
      refreshSec: parseInt(refreshSec) || 300,
      autoRefresh,
    });
    await refreshAll();
    if ($syncState.status === 'ok') toast('Connected and synced.', 'success');
  }

  function onDisconnect() {
    if (!confirm('Disconnect and clear cached data?')) return;
    disconnect();
    masterUrl = ''; trackerUrl = ''; rosterUrl = '';
  }

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
    <h2 class="serif" style="font-size:22px;margin-bottom:6px">Connect your sheets</h2>
    <p class="muted" style="font-size:13px;margin-bottom:24px">
      Paste either the Apps Script <code>/exec</code> URL (for private sheets) or the regular Google Sheet share URL ("Anyone with the link can view").
    </p>

    <div class="field">
      <label for="masterUrl">Master tracker — per-candidate detail</label>
      <input id="masterUrl" class="input" bind:value={masterUrl} placeholder="https://script.google.com/.../exec  or  https://docs.google.com/spreadsheets/d/..." autocomplete="off" spellcheck="false" />
      <div class="muted hint">Sheet 1 — full pipeline per candidate (~170 columns).</div>
    </div>

    <div class="field">
      <label for="trackerUrl">Activity tracker — weekly + hiring plan</label>
      <input id="trackerUrl" class="input" bind:value={trackerUrl} placeholder="https://script.google.com/.../exec  or  https://docs.google.com/spreadsheets/d/..." autocomplete="off" spellcheck="false" />
      <div class="muted hint">Sheet 2 — PMA / PM / COS rounds + plan rows.</div>
    </div>

    <div class="field">
      <label for="rosterUrl">Candidates roster <span class="muted" style="font-weight:400">(optional)</span></label>
      <input id="rosterUrl" class="input" bind:value={rosterUrl} placeholder="Master sheet URL with #gid=1032909525 (or any candidate-list tab)" autocomplete="off" spellcheck="false" />
      <div class="muted hint">Per-candidate roster tab from the master sheet. Append <code>#gid=&lt;tab id&gt;</code> to point at a specific tab.</div>
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
      <button class="btn brand" on:click={connect}>{$config.masterUrl || $config.trackerUrl ? 'Update connection' : 'Connect'}</button>
      <button class="btn" on:click={() => refreshAll()} disabled={$syncState.status === 'syncing'}>
        {$syncState.status === 'syncing' ? 'Syncing…' : 'Refresh now'}
      </button>
      {#if $config.masterUrl || $config.trackerUrl}
        <button class="btn danger" on:click={onDisconnect}>Disconnect</button>
      {/if}
    </div>

    {#if $syncState.error}
      <div class="card" style="margin-top:18px;padding:14px 18px;background:var(--bad-soft);border-color:var(--bad)">
        <div style="font-weight:600;color:var(--brand-deep);margin-bottom:4px">Sync error</div>
        <div class="mono" style="font-size:12px;color:var(--brand-deep)">{$syncState.error}</div>
      </div>
    {/if}

    <div class="card soft" style="padding:18px;margin-top:20px">
      <div class="status-grid">
        <div>
          <div style="font-weight:600;font-size:13px;margin-bottom:2px">Master summary</div>
          <div class="muted" style="font-size:11px">
            {Object.keys($rawSummary.roleStats).length} roles · {$rawSummary.planRich.length} plan rows
          </div>
        </div>
        <div>
          <div style="font-weight:600;font-size:13px;margin-bottom:2px">Candidate roster</div>
          <div class="muted" style="font-size:11px">{$rawMaster.candidates.length} candidates · {$rawMaster.headers.length} cols</div>
        </div>
        <div>
          <div style="font-weight:600;font-size:13px;margin-bottom:2px">Tracker sheet</div>
          <div class="muted" style="font-size:11px">{$rawTracker.activities.length} events · {$rawTracker.plan.length} plan rows</div>
        </div>
      </div>
    </div>
  </div>

  <div class="card pad-lg">
    <h2 class="serif" style="font-size:22px;margin-bottom:14px">Apps Script proxy</h2>
    <p class="muted" style="font-size:13px;margin-bottom:14px">
      The recommended path: keep your sheets <strong style="color:var(--ink)">private</strong> and use a tiny Google Apps Script as a CSV proxy.
    </p>

    <ol class="how">
      <li>Open your hiring sheet → <b>Extensions → Apps Script</b>.</li>
      <li>Delete the placeholder code, paste the proxy below, and save.</li>
      <li><b>Deploy → New deployment</b> → Type: <b>Web app</b> → Execute as: <b>Me</b> → Access: <b>Anyone</b>.</li>
      <li>Authorize when prompted (Advanced → Go to script → Allow).</li>
      <li>Copy the <b>Web app URL</b> (ends with <code>/exec</code>) and paste it on the left.</li>
    </ol>

    <button class="btn" on:click={downloadAppsScript}>⬇ Download apps-script.gs</button>

    <div class="muted" style="font-size:11px;margin-top:14px">
      Tip: to read a non-default tab, append <code>?sheet=TabName</code> to the <code>/exec</code> URL.
    </div>
  </div>
</section>

<style>
  .grid-2 { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; align-items: start; }
  @media (max-width: 1100px) { .grid-2 { grid-template-columns: 1fr; } }
  .field { margin-bottom: 18px; }
  .field label { display: block; font-size: 12px; font-weight: 500; margin-bottom: 6px; color: var(--ink-2); }
  .field .hint { font-size: 11px; margin-top: 6px; }
  code { font-family: var(--font-mono); background: var(--surface-sunk); padding: 1px 6px; border-radius: 4px; font-size: 12px; }
  .how { padding-left: 20px; color: var(--ink-2); line-height: 1.8; font-size: 13px; margin-bottom: 18px; }
  .how b { color: var(--ink); }
  .status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  @media (max-width: 700px) { .status-grid { grid-template-columns: 1fr; } }
</style>
