import { writable, derived, get } from 'svelte/store';
import { fetchAndMergeAllTabs } from './sheets.js';
import { mergeData } from './normalize.js';
import {
  computePlanProgress, computeStateSummary, computeFunnel, computeSummaryFunnel,
  computeSourceStats, computeTrackerSourceStats, computePeopleStats,
  computeTrackerPanelistStats, computeMonthlyTrend, computeQueues,
  computeRecentActivity, computeDropoff
} from './derive.js';
import { loadConfig, saveConfig, clearConfig } from './storage.js';

// The portal auto-connects to this sheet for ALL visitors so they see data
// immediately — no "Connect your sheets" prompt. Anyone can override via
// the Settings page; their override is stored in localStorage (browser-local).
export const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1NShjSPanzLulrNAk0grZgu94ibEO31lYJKupMjkrZJY/edit?usp=sharing';

// ----- Config (single sheet URL + refresh) -----
export const config = writable({
  sheetUrl: DEFAULT_SHEET_URL,
  refreshSec: 300,
  autoRefresh: true,
  lastSyncedAt: null,
});

// ----- Raw / merged data -----
export const tabSummary = writable([]);  // info about every tab the portal saw
export const data = writable({
  candidates: [],
  activities: [],
  plan: [],
  planRich: [],
  roleStats: {},
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
export const sourceStats   = derived(data, $d => {
  const fromMaster = computeSourceStats($d);
  return fromMaster.length ? fromMaster : computeTrackerSourceStats($d);
});
export const peopleStats   = derived(data, $d => {
  const m = computePeopleStats($d);
  if (m.sourcers.length || m.panelists.length) return m;
  return { sourcers: [], panelists: computeTrackerPanelistStats($d), recruiters: [] };
});
export const monthlyTrend = derived(data, $d => computeMonthlyTrend($d));
export const queues       = derived(data, $d => computeQueues($d));
export const recentFeed   = derived(data, $d => computeRecentActivity($d));
export const dropoff      = derived(funnel, $f => computeDropoff($f));

// ----- Lifecycle -----
let refreshTimer = null;

export async function bootstrap() {
  const cfg = loadConfig();
  // Resolve URL: user override (saved or migrated from old keys) → DEFAULT
  let sheetUrl = DEFAULT_SHEET_URL;
  if (cfg) {
    sheetUrl = cfg.sheetUrl
      || cfg.trackerUrl || cfg.masterUrl || cfg.rosterUrl
      || DEFAULT_SHEET_URL;
  }
  config.set({
    sheetUrl,
    refreshSec: cfg?.refreshSec || 300,
    autoRefresh: cfg?.autoRefresh !== false,
    lastSyncedAt: cfg?.lastSyncedAt || null,
  });
  // Always sync (we always have a URL now)
  await refreshAll();
  startAutoRefresh();
}

export function startAutoRefresh() {
  stopAutoRefresh();
  const cfg = get(config);
  if (cfg.autoRefresh && cfg.sheetUrl) {
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

// "Disconnect" actually resets to the default sheet (the portal can never
// truly be empty — it always falls back to the default ProgramOps sheet).
export async function disconnect() {
  stopAutoRefresh();
  clearConfig();
  config.set({ sheetUrl: DEFAULT_SHEET_URL, refreshSec: 300, autoRefresh: true, lastSyncedAt: null });
  tabSummary.set([]);
  data.set({ candidates: [], activities: [], plan: [], planRich: [], roleStats: {}, masterHeaders: [] });
  syncState.set({ status: 'idle', message: '', error: null });
  toast('Reset to default sheet.', 'info');
  await refreshAll();
  startAutoRefresh();
}

export async function refreshAll() {
  const cfg = get(config);
  if (!cfg.sheetUrl) return;
  syncState.set({ status: 'syncing', message: 'Discovering tabs and fetching…', error: null });
  try {
    const result = await fetchAndMergeAllTabs(cfg.sheetUrl);
    tabSummary.set(result.tabSummary);

    if (result.warnings.length) {
      console.warn('[sync] warnings:', result.warnings);
    }
    if (!result.plan.length && !result.activities.length && !Object.keys(result.roleStats).length) {
      throw new Error('No usable data found in any tab. Check that the sheet is shared as "Anyone with the link can view" and contains a hiring plan, role trackers, or summary stats.');
    }

    const merged = mergeData({
      candidates: result.candidates,
      activities: result.activities,
      plan: result.plan,
      masterHeaders: [],
    });
    data.set({
      ...merged,
      planRich: result.plan,
      roleStats: result.roleStats,
    });

    const ts = new Date().toISOString();
    config.update(c => ({ ...c, lastSyncedAt: ts }));
    saveConfig(get(config));

    const tabsByKind = result.tabSummary.reduce((acc, t) => {
      acc[t.kind] = (acc[t.kind] || 0) + 1;
      return acc;
    }, {});
    const tabsLabel = Object.entries(tabsByKind).map(([k, n]) => `${n} ${k}`).join(', ');
    syncState.set({
      status: 'ok',
      message: `Synced — ${result.tabSummary.length} tabs (${tabsLabel}) · ${result.activities.length} events · ${result.plan.length} plan rows · ${result.candidates.length} candidates`,
      error: null
    });
  } catch (err) {
    console.error(err);
    syncState.set({ status: 'error', message: '', error: err.message || String(err) });
    toast('Sync failed: ' + (err.message || err), 'error', 6000);
  }
}
