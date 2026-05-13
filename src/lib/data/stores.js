import { writable, derived, get } from 'svelte/store';
import { fetchSheetCSV, fetchWithTabFallback } from './sheets.js';
import { parseMasterSummaryTab, parseMasterSheet, parseTrackerSheet } from './parse.js';
import { mergeData } from './normalize.js';
import {
  computePlanProgress, computeStateSummary, computeFunnel, computeSummaryFunnel,
  computeSourceStats, computeTrackerSourceStats, computePeopleStats,
  computeTrackerPanelistStats, computeMonthlyTrend, computeQueues,
  computeRecentActivity, computeDropoff
} from './derive.js';
import { loadConfig, saveConfig, clearConfig } from './storage.js';

// ----- Config (sheet URLs, refresh interval) -----
export const config = writable({
  masterUrl: '',
  trackerUrl: '',
  rosterUrl: '',
  refreshSec: 300,
  autoRefresh: true,
  lastSyncedAt: null,
});

// ----- Raw and merged data -----
export const rawMaster   = writable({ headers: [], candidates: [], warnings: [] });
export const rawSummary  = writable({ roleStats: {}, planRich: [], warnings: [] });
export const rawTracker  = writable({ activities: [], plan: [], warnings: [] });

export const data = writable({
  candidates: [],
  activities: [],
  plan: [],         // unified plan (rich master plan if present, else tracker plan)
  planRich: [],     // master plan with CTC fields (when available)
  roleStats: {},    // master summary stats per role
  masterHeaders: [],
});

// ----- UI state -----
export const syncState = writable({ status: 'idle', message: '', error: null });
export const filters = writable({ state: '', role: '', university: '', stage: '', source: '', search: '' });

// ----- Toasts -----
export const toasts = writable([]);
let toastId = 0;
export function toast(message, kind = 'info', ms = 3500) {
  const id = ++toastId;
  toasts.update(t => [...t, { id, message, kind }]);
  if (ms) setTimeout(() => toasts.update(t => t.filter(x => x.id !== id)), ms);
}

// ----- Derived stores -----
export const planProgress = derived(data, $d => computePlanProgress($d));
export const stateSummary = derived(data, $d => computeStateSummary($d));
export const funnel        = derived(data, $d => computeFunnel($d));
export const summaryFunnel = derived(data, $d => computeSummaryFunnel($d.roleStats));
export const sourceStats  = derived(data, $d => {
  const fromMaster = computeSourceStats($d);
  return fromMaster.length ? fromMaster : computeTrackerSourceStats($d);
});
export const peopleStats  = derived(data, $d => {
  const m = computePeopleStats($d);
  if (m.sourcers.length || m.panelists.length) return m;
  return { sourcers: [], panelists: computeTrackerPanelistStats($d), recruiters: [] };
});
export const monthlyTrend = derived(data, $d => computeMonthlyTrend($d));
export const queues       = derived(data, $d => computeQueues($d));
export const recentFeed   = derived(data, $d => computeRecentActivity($d));
export const dropoff      = derived(funnel, $f => computeDropoff($f));

// Heuristic: does this CSV text look like the master summary tab?
// Signature: first row has role headers (PMA, PM, COS, BOA) OR contains
// "S.No,State,Location" of the hiring plan.
function looksLikeMasterSummary(text) {
  if (!text || text.trim().length < 100) return false;
  const head = text.slice(0, 2000).toLowerCase();
  // Role-stats signature: header row with role names in adjacent columns
  if (/(^|\n)(pma|pm|cos|boa)[\s,]/.test(head) && /total resumes shortlisted/.test(head)) return true;
  // Plan signature: contains the hiring-plan header row
  if (/s\.?\s*no.*?state.*?location.*?role/.test(head.replace(/\s+/g, ' '))) return true;
  return false;
}

// ----- Lifecycle -----
let refreshTimer = null;

export async function bootstrap() {
  const cfg = loadConfig();
  if (cfg) config.set({ ...get(config), ...cfg });
  if (cfg?.masterUrl || cfg?.trackerUrl || cfg?.rosterUrl) {
    await refreshAll();
    startAutoRefresh();
  }
}

export function startAutoRefresh() {
  stopAutoRefresh();
  const cfg = get(config);
  if (cfg.autoRefresh && (cfg.masterUrl || cfg.trackerUrl || cfg.rosterUrl)) {
    refreshTimer = setInterval(refreshAll, cfg.refreshSec * 1000);
  }
}
export function stopAutoRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

export function setConfig(patch) {
  config.update(c => ({ ...c, ...patch }));
  saveConfig(get(config));
  startAutoRefresh();
}

export function disconnect() {
  stopAutoRefresh();
  clearConfig();
  config.set({ masterUrl: '', trackerUrl: '', rosterUrl: '', refreshSec: 300, autoRefresh: true, lastSyncedAt: null });
  rawMaster.set({ headers: [], candidates: [], warnings: [] });
  rawSummary.set({ roleStats: {}, planRich: [], warnings: [] });
  rawTracker.set({ activities: [], plan: [], warnings: [] });
  data.set({ candidates: [], activities: [], plan: [], planRich: [], roleStats: {}, masterHeaders: [] });
  syncState.set({ status: 'idle', message: '', error: null });
  toast('Disconnected.', 'info');
}

export async function refreshAll() {
  const cfg = get(config);
  if (!cfg.masterUrl && !cfg.trackerUrl && !cfg.rosterUrl) return;
  syncState.set({ status: 'syncing', message: 'Fetching sheets…', error: null });
  try {
    const tasks = {};

    // Master sheet — fetch with auto-tab-fallback. If the URL's default tab
    // is empty or unrecognizable, scan every tab and find one that looks
    // like the summary stats / hiring plan format.
    if (cfg.masterUrl) {
      tasks.masterText = fetchWithTabFallback(cfg.masterUrl, looksLikeMasterSummary)
        .then(r => {
          if (r.foundGid) console.info(`[master] auto-discovered summary tab at gid=${r.foundGid}`);
          return r.text;
        });
    }
    if (cfg.trackerUrl) {
      tasks.trackerText = fetchSheetCSV(cfg.trackerUrl);
    }
    if (cfg.rosterUrl) {
      tasks.rosterText = fetchSheetCSV(cfg.rosterUrl);
    }

    const results = await Promise.allSettled(Object.entries(tasks).map(async ([k, p]) => [k, await p]));
    const got = {};
    for (const r of results) {
      if (r.status === 'fulfilled') got[r.value[0]] = r.value[1];
      else console.warn('Fetch failed:', r.reason);
    }

    // Parse master text — try summary first, then candidate-template
    let summary = { roleStats: {}, planRich: [], warnings: [] };
    let masterCandidates = { headers: [], candidates: [], warnings: [] };
    if (got.masterText) {
      summary = parseMasterSummaryTab(got.masterText);
      // If summary block came back empty AND the sheet looks like a candidate
      // template (header starts with "UID,Candidate Name,..."), parse as master.
      if (Object.keys(summary.roleStats).length === 0 && summary.planRich.length === 0) {
        masterCandidates = parseMasterSheet(got.masterText);
      }
    }

    // Parse roster text as the per-candidate master if provided
    if (got.rosterText) {
      const rosterParsed = parseMasterSheet(got.rosterText);
      // Append roster candidates to whatever we already have
      masterCandidates = {
        headers: rosterParsed.headers.length ? rosterParsed.headers : masterCandidates.headers,
        candidates: [...masterCandidates.candidates, ...rosterParsed.candidates],
        warnings: [...masterCandidates.warnings, ...rosterParsed.warnings],
      };
    }

    const tracker = got.trackerText
      ? parseTrackerSheet(got.trackerText)
      : { activities: [], plan: [], warnings: [] };

    rawMaster.set(masterCandidates);
    rawSummary.set(summary);
    rawTracker.set(tracker);

    // Prefer the richer master plan (with CTC, hiring status) when available
    const unifiedPlan = summary.planRich.length
      ? summary.planRich
      : tracker.plan;

    const merged = mergeData({
      candidates: masterCandidates.candidates,
      activities: tracker.activities,
      plan: unifiedPlan,
      masterHeaders: masterCandidates.headers,
    });
    data.set({
      ...merged,
      planRich: summary.planRich,
      roleStats: summary.roleStats,
    });

    const ts = new Date().toISOString();
    config.update(c => ({ ...c, lastSyncedAt: ts }));
    saveConfig(get(config));

    syncState.set({
      status: 'ok',
      message: `Synced — ${merged.candidates.length} candidates · ${merged.activities.length} events · ${unifiedPlan.length} plan rows`,
      error: null
    });
  } catch (err) {
    console.error(err);
    syncState.set({ status: 'error', message: '', error: err.message || String(err) });
    toast('Sync failed: ' + (err.message || err), 'error', 6000);
  }
}
