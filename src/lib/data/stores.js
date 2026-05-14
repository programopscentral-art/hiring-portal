import { writable, derived, get } from 'svelte/store';
import { fetchAndMergeAllTabs, DEFAULT_SHEET_URL, DEFAULT_SHEET_ID, TAB_MAP } from './sheets.js';
import { STAGES, STAGE_INDEX, STAGE_KEYS, ROLES, nameKey } from './parse.js';
import { loadConfig, saveConfig, clearConfig } from './storage.js';

export { DEFAULT_SHEET_URL, DEFAULT_SHEET_ID, TAB_MAP, STAGES, STAGE_INDEX, STAGE_KEYS, ROLES };

// ---------- Config (single sheet URL + refresh) ----------
export const config = writable({
  sheetUrl: DEFAULT_SHEET_URL,
  refreshSec: 300,
  autoRefresh: true,
  lastSyncedAt: null,
});

// ---------- Primary dataset ----------
export const dataset = writable({
  tabSummary: [],
  rawTabs: {},
  applications: [],
  details: [],
  stageEvents: [],
  legacyEvents: [],
  candidates: [],
  candidatesDataSchema: null,
  rejectionTaxonomy: null,
  statusEnums: null,
  dashboardData: null,
  hiringPlan: [],
  legacyDashboard: null,
});

// ---------- UI state ----------
export const syncState = writable({ status: 'idle', message: '', error: null });
export const filters = writable({
  role: '',
  stage: '',
  decision: '',
  state: '',
  university: '',
  source: '',
  panelist: '',
  search: '',
});

export const toasts = writable([]);
let toastId = 0;
export function toast(message, kind = 'info', ms = 3500) {
  const id = ++toastId;
  toasts.update(t => [...t, { id, message, kind }]);
  if (ms) setTimeout(() => toasts.update(t => t.filter(x => x.id !== id)), ms);
}

// =============================================================
// DERIVED STORES
// =============================================================

// Apply current filters to candidates
export const filteredCandidates = derived(
  [dataset, filters],
  ([$d, $f]) => {
    let cs = $d.candidates;
    if ($f.role) cs = cs.filter(c => (c.role || '').toUpperCase().startsWith($f.role.toUpperCase()));
    if ($f.stage) cs = cs.filter(c => c.currentStage === $f.stage);
    if ($f.decision) cs = cs.filter(c => c.finalDecision === $f.decision);
    if ($f.state) cs = cs.filter(c => locStateMatch(c, $f.state));
    if ($f.source) cs = cs.filter(c => (c.sourceName || '') === $f.source);
    if ($f.panelist) cs = cs.filter(c => c.panelists.includes($f.panelist));
    if ($f.search) {
      const q = $f.search.toLowerCase();
      cs = cs.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.location || '').toLowerCase().includes(q) ||
        (c.currentLocation || '').toLowerCase().includes(q)
      );
    }
    return cs;
  }
);

// Funnel — count of candidates who reached each stage. A candidate reaches
// stage S if they have a populated stages[S] entry OR any later stage's
// entry (since reaching a later stage implies they passed earlier ones).
export const funnel = derived(dataset, $d => {
  const counts = Object.fromEntries(STAGE_KEYS.map(k => [k, 0]));
  for (const c of $d.candidates) {
    // Sourced = every candidate is at least sourced
    counts.sourced++;
    // For other stages: count if candidate has a stage entry AT or ABOVE this stage
    const reached = new Set(Object.keys(c.stages || {}));
    const maxReachedIdx = Math.max(-1, ...[...reached].map(k => STAGE_INDEX[k] ?? -1));
    for (let i = 1; i < STAGE_KEYS.length; i++) {
      if (maxReachedIdx >= i) counts[STAGE_KEYS[i]]++;
    }
  }
  const total = counts.sourced || $d.candidates.length;
  return STAGES.map(s => ({
    ...s,
    count: counts[s.key],
    pctOfTotal: total ? counts[s.key] / total : 0,
  }));
});

// Stage matrix: role × stage counts
export const stageMatrix = derived(dataset, $d => {
  const m = {};
  for (const r of ROLES) m[r] = Object.fromEntries(STAGE_KEYS.map(k => [k, 0]));
  for (const c of $d.candidates) {
    const role = roleOf(c);
    if (!m[role]) continue;
    m[role].sourced++;
    const reached = new Set(Object.keys(c.stages || {}));
    const maxReachedIdx = Math.max(-1, ...[...reached].map(k => STAGE_INDEX[k] ?? -1));
    for (let i = 1; i < STAGE_KEYS.length; i++) {
      if (maxReachedIdx >= i) m[role][STAGE_KEYS[i]]++;
    }
  }
  return m;
});

// KPIs
export const kpis = derived(dataset, $d => {
  const total = $d.candidates.length;
  const hired = $d.candidates.filter(c => c.finalDecision === 'hired').length;
  const active = $d.candidates.filter(c => c.finalDecision === 'active').length;
  const rejected = $d.candidates.filter(c => c.finalDecision === 'rejected').length;
  // In-final-stages: anyone past R3
  const finals = $d.candidates.filter(c => (STAGE_INDEX[c.currentStage] ?? -1) >= STAGE_INDEX.r3 && c.finalDecision !== 'rejected').length;
  // Applications this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = $d.candidates.filter(c => c.timestampDate && c.timestampDate >= monthStart).length;
  return { total, hired, active, rejected, finals, thisMonth };
});

// Per-role KPIs
export const roleStats = derived(dataset, $d => {
  const out = {};
  for (const r of ROLES) out[r] = { total: 0, hired: 0, active: 0, rejected: 0 };
  for (const c of $d.candidates) {
    const r = roleOf(c);
    if (!out[r]) continue;
    out[r].total++;
    if (c.finalDecision === 'hired') out[r].hired++;
    else if (c.finalDecision === 'rejected') out[r].rejected++;
    else out[r].active++;
  }
  return out;
});

// Application volume time series — monthly counts by role
export const monthlyVolume = derived(dataset, $d => {
  const months = new Map();
  for (const c of $d.candidates) {
    if (!c.timestampDate) continue;
    const k = `${c.timestampDate.getFullYear()}-${String(c.timestampDate.getMonth() + 1).padStart(2, '0')}`;
    if (!months.has(k)) months.set(k, { month: k, PMA: 0, PM: 0, COS: 0, BOA: 0, total: 0 });
    const m = months.get(k);
    const r = roleOf(c);
    if (m[r] != null) m[r]++;
    m.total++;
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
});

// State distribution from candidate locations
export const byState = derived(dataset, $d => {
  const map = new Map();
  for (const c of $d.candidates) {
    const states = extractStates(c);
    for (const st of states) {
      if (!map.has(st)) map.set(st, { state: st, total: 0, hired: 0, active: 0, rejected: 0, candidates: [] });
      const m = map.get(st);
      m.total++;
      m.candidates.push(c);
      if (c.finalDecision === 'hired') m.hired++;
      else if (c.finalDecision === 'rejected') m.rejected++;
      else m.active++;
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
});

// Universities (from current company / current location text)
export const byUniversity = derived(dataset, $d => {
  const map = new Map();
  for (const c of $d.candidates) {
    const uni = extractUniversity(c);
    if (!uni) continue;
    if (!map.has(uni)) map.set(uni, { name: uni, total: 0, hired: 0, candidates: [] });
    const m = map.get(uni);
    m.total++;
    m.candidates.push(c);
    if (c.finalDecision === 'hired') m.hired++;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
});

// Source effectiveness — by source name
export const bySource = derived(dataset, $d => {
  const map = new Map();
  for (const c of $d.candidates) {
    const src = c.sourceName || 'Unknown';
    if (!map.has(src)) map.set(src, { source: src, total: 0, hired: 0, rejected: 0, active: 0 });
    const m = map.get(src);
    m.total++;
    if (c.finalDecision === 'hired') m.hired++;
    else if (c.finalDecision === 'rejected') m.rejected++;
    else m.active++;
  }
  const arr = [...map.values()].filter(x => x.source !== 'Unknown' || x.total > 5);
  return arr.sort((a, b) => b.total - a.total);
});

// Panelists — by name across all stages. Falls back to legacy events when
// new-sheet panelist columns are empty.
export const byPanelist = derived(dataset, $d => {
  const map = new Map();
  const add = (p, stage, decision) => {
    if (!p) return;
    if (!map.has(p)) map.set(p, { panelist: p, interviews: 0, selected: 0, rejected: 0, byStage: {} });
    const m = map.get(p);
    m.interviews++;
    if (decision === 'selected') m.selected++;
    else if (decision === 'rejected') m.rejected++;
    m.byStage[stage] = (m.byStage[stage] || 0) + 1;
  };
  for (const ev of $d.stageEvents || []) {
    add(ev.panelist, ev.stage, ev.decision);
  }
  // Legacy: shortlister column in role-app tabs ("Shortlisted by")
  for (const app of $d.applications || []) {
    if (app.shortlistedBy) add(app.shortlistedBy, 'resumeShortlist', classifyAppDecision(app.selectStatus));
  }
  return [...map.values()].sort((a, b) => b.interviews - a.interviews);
});
function classifyAppDecision(s) {
  if (!s) return '';
  const x = String(s).toLowerCase();
  if (x.includes('select')) return 'selected';
  if (x.includes('reject')) return 'rejected';
  return '';
}

// Rejection heatmap — stage × reason
export const rejectionMatrix = derived(dataset, $d => {
  const map = new Map();   // stage → reason → count
  for (const c of $d.candidates) {
    if (c.finalDecision !== 'rejected') continue;
    const stage = c.rejectionStage || 'sourced';
    const reason = c.rejectionReason || 'Not specified';
    if (!map.has(stage)) map.set(stage, new Map());
    const m = map.get(stage);
    m.set(reason, (m.get(reason) || 0) + 1);
  }
  const out = [];
  for (const [stage, rmap] of map) {
    for (const [reason, count] of rmap) {
      out.push({ stage, reason, count });
    }
  }
  return out.sort((a, b) => b.count - a.count);
});

// Recent activity feed — newest first, merges new-sheet + legacy events
export const recentActivity = derived(dataset, $d => {
  const a = [...$d.stageEvents, ...($d.legacyEvents || [])]
    .filter(e => e.parsedDate);
  a.sort((a, b) => b.parsedDate - a.parsedDate);
  return a.slice(0, 50);
});

// =============================================================
// HIRING PLAN (from old sheet's Summary table)
// =============================================================

// Plan rows indexed by state
export const planByState = derived(dataset, $d => {
  const map = new Map();
  for (const p of $d.hiringPlan || []) {
    if (!map.has(p.state)) map.set(p.state, { state: p.state, positions: 0, hired: 0, universities: new Set(), roles: new Set(), rows: [] });
    const m = map.get(p.state);
    m.positions += p.positions || 0;
    if (p.hired) m.hired++;
    m.universities.add(p.university);
    m.roles.add(p.role);
    m.rows.push(p);
  }
  return [...map.values()].map(s => ({
    ...s,
    universities: [...s.universities],
    roles: [...s.roles],
  })).sort((a, b) => b.positions - a.positions);
});

// Plan rows indexed by university
export const planByUniversity = derived(dataset, $d => {
  const map = new Map();
  for (const p of $d.hiringPlan || []) {
    const key = p.university;
    if (!map.has(key)) map.set(key, {
      university: key, state: p.state, type: p.type,
      positions: 0, hired: 0, roles: {}, rows: [],
    });
    const m = map.get(key);
    m.positions += p.positions || 0;
    if (p.hired) m.hired++;
    m.roles[p.role] = (m.roles[p.role] || 0) + (p.positions || 0);
    m.rows.push(p);
  }
  return [...map.values()].sort((a, b) => b.positions - a.positions);
});

// Plan by role
export const planByRole = derived(dataset, $d => {
  const map = Object.fromEntries(ROLES.map(r => [r, { positions: 0, hired: 0 }]));
  for (const p of $d.hiringPlan || []) {
    if (!map[p.role]) map[p.role] = { positions: 0, hired: 0 };
    map[p.role].positions += p.positions || 0;
    if (p.hired) map[p.role].hired++;
  }
  return map;
});

// =============================================================
// LIFECYCLE
// =============================================================

let refreshTimer = null;

export async function bootstrap() {
  const cfg = loadConfig();
  const sheetUrl = cfg?.sheetUrl || DEFAULT_SHEET_URL;
  config.set({
    sheetUrl,
    refreshSec: cfg?.refreshSec || 300,
    autoRefresh: cfg?.autoRefresh !== false,
    lastSyncedAt: cfg?.lastSyncedAt || null,
  });
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

export async function disconnect() {
  stopAutoRefresh();
  clearConfig();
  config.set({ sheetUrl: DEFAULT_SHEET_URL, refreshSec: 300, autoRefresh: true, lastSyncedAt: null });
  await refreshAll();
  startAutoRefresh();
}

export async function refreshAll() {
  const cfg = get(config);
  if (!cfg.sheetUrl) return;
  syncState.set({ status: 'syncing', message: 'Fetching all tabs…', error: null });
  try {
    const result = await fetchAndMergeAllTabs(cfg.sheetUrl);
    dataset.set(result);
    const ts = new Date().toISOString();
    config.update(c => ({ ...c, lastSyncedAt: ts }));
    saveConfig(get(config));
    const tabsByKind = result.tabSummary.reduce((acc, t) => {
      acc[t.kind] = (acc[t.kind] || 0) + 1;
      return acc;
    }, {});
    const tabsLabel = Object.entries(tabsByKind).map(([k, n]) => `${n} ${k}`).join(' · ');
    syncState.set({
      status: 'ok',
      message: `Synced — ${result.tabSummary.length} tabs (${tabsLabel}) · ${result.candidates.length} candidates · ${result.stageEvents.length} stage events`,
      error: null
    });
  } catch (err) {
    console.error(err);
    syncState.set({ status: 'error', message: '', error: err.message || String(err) });
    toast('Sync failed: ' + (err.message || err), 'error', 6000);
  }
}

// =============================================================
// HELPERS
// =============================================================

export function roleOf(c) {
  let r = (c.role || '').toUpperCase();
  if (r.startsWith('BOA')) return 'BOA';
  if (r.startsWith('PMA')) return 'PMA';
  if (r.startsWith('COS')) return 'COS';
  if (r.startsWith('PM')) return 'PM';
  return 'PM';
}

const STATE_NAMES = [
  'Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Kerala',
  'Maharashtra', 'Gujarat', 'Rajasthan', 'Madhya Pradesh', 'Uttar Pradesh',
  'Bihar', 'West Bengal', 'Odisha', 'Jharkhand', 'Chhattisgarh', 'Assam',
  'Punjab', 'Haryana', 'Delhi', 'Uttarakhand', 'Himachal Pradesh',
  'Jammu and Kashmir', 'Goa', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Sikkim', 'Tripura', 'Arunachal Pradesh', 'Andaman and Nicobar',
  'Chandigarh', 'Puducherry', 'Lakshadweep', 'Dadra and Nagar Haveli',
];
const CITY_TO_STATE = {
  'hyderabad': 'Telangana', 'secunderabad': 'Telangana', 'warangal': 'Telangana',
  'bangalore': 'Karnataka', 'bengaluru': 'Karnataka', 'mysore': 'Karnataka', 'mangalore': 'Karnataka',
  'chennai': 'Tamil Nadu', 'coimbatore': 'Tamil Nadu', 'madurai': 'Tamil Nadu',
  'mumbai': 'Maharashtra', 'pune': 'Maharashtra', 'nagpur': 'Maharashtra', 'nashik': 'Maharashtra',
  'delhi': 'Delhi', 'noida': 'Uttar Pradesh', 'gurgaon': 'Haryana', 'gurugram': 'Haryana',
  'ahmedabad': 'Gujarat', 'surat': 'Gujarat', 'vadodara': 'Gujarat',
  'jaipur': 'Rajasthan', 'jodhpur': 'Rajasthan', 'udaipur': 'Rajasthan',
  'kolkata': 'West Bengal',
  'bhubaneswar': 'Odisha', 'cuttack': 'Odisha',
  'kochi': 'Kerala', 'cochin': 'Kerala', 'thiruvananthapuram': 'Kerala',
  'visakhapatnam': 'Andhra Pradesh', 'vijayawada': 'Andhra Pradesh', 'guntur': 'Andhra Pradesh',
  'lucknow': 'Uttar Pradesh', 'kanpur': 'Uttar Pradesh', 'varanasi': 'Uttar Pradesh', 'agra': 'Uttar Pradesh',
  'patna': 'Bihar',
  'indore': 'Madhya Pradesh', 'bhopal': 'Madhya Pradesh',
  'chandigarh': 'Chandigarh',
  'panipat': 'Haryana', 'meerut': 'Uttar Pradesh',
};

export function extractStates(c) {
  const sources = [
    c.location || '',
    c.currentLocation || '',
    c.details?.preferredLocations || '',
    c.application?.preferredLocation || '',
    c.application?.okLocations || '',
  ].join(' , ');
  const found = new Set();
  const lower = sources.toLowerCase();
  for (const st of STATE_NAMES) {
    if (lower.includes(st.toLowerCase())) found.add(st);
  }
  for (const [city, st] of Object.entries(CITY_TO_STATE)) {
    if (lower.includes(city)) found.add(st);
  }
  return [...found];
}

function locStateMatch(c, state) {
  const states = extractStates(c);
  return states.includes(state);
}

export function extractUniversity(c) {
  const co = (c.currentCompany || '').trim();
  if (!co) return null;
  if (/university|college|institute|iit|nit|iiit|iim|school of/i.test(co)) return co;
  return null;
}

export function getCandidate(uidOrName) {
  const $d = get(dataset);
  const key = nameKey(uidOrName);
  return $d.candidates.find(c => c.nameKey === key || c.uid === uidOrName);
}
