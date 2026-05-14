// Fetch + merge the ProgramOps hiring sheet.
//
// The sheet has 44 named tabs. Each gid is mapped deterministically to its
// role in the pipeline via TAB_MAP below. We fetch every tab in parallel,
// parse with the right parser, and produce a unified data model keyed by
// candidate (joined across role-app tabs + Details + per-stage tabs).

import {
  parseRoleApplicationTab,
  parseDetailsTab,
  parseStageTab,
  parseCandidatesDataTab,
  parseRejectionTaxonomy,
  parseStatusEnums,
  parseDashboardData,
  parseRaw,
  parseLegacyRoleTracker,
  parseHiringPlan,
  parseLegacyDashboardData,
  nameKey,
  classifyDecision,
  STAGE_KEYS,
  STAGE_INDEX,
} from './parse.js';

export const DEFAULT_SHEET_ID = '1vhoYflwEKI-SnKSb95x-wKhL4vgMTSsbS0dVEvsxOuE';
export const DEFAULT_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/edit?usp=sharing`;

// Secondary sheet (legacy plan + BOA + dashboard data). Always fetched.
export const PLAN_SHEET_ID = '1NShjSPanzLulrNAk0grZgu94ibEO31lYJKupMjkrZJY';
export const PLAN_TABS = {
  '1244970599': { name: 'BOA (legacy)',          kind: 'legacyRole', role: 'BOA' },
  '1831507878': { name: 'PMA (legacy)',          kind: 'legacyRole', role: 'PMA' },
  '2092953225': { name: 'PM (legacy)',           kind: 'legacyRole', role: 'PM' },
  '389019874':  { name: 'COS (legacy)',          kind: 'legacyRole', role: 'COS' },
  '118081566':  { name: 'Hiring Plan',           kind: 'plan' },
  '672534942':  { name: 'Dashboard data (legacy)', kind: 'legacyDashboard' },
};

// Deterministic mapping from gid → (kind, displayName, parser hint).
// `kind` drives merging logic. `stageKey` (if present) is the canonical
// stage key from parse.STAGES.
export const TAB_MAP = {
  '689156164':   { name: '📊 Dashboard',           kind: 'ignore' },
  '698072942':   { name: 'Dashboard data',          kind: 'dashboardData' },
  '187488553':   { name: 'PMA',                     kind: 'roleApp', role: 'PMA' },
  '646589924':   { name: 'Resume Shortlisting - PMA', kind: 'roleShortlist', role: 'PMA' },
  '651211669':   { name: 'Interview R1 - PMA',      kind: 'roleStage', role: 'PMA', stageKey: 'r1' },
  '2112273250':  { name: 'PMA R2',                  kind: 'roleStage', role: 'PMA', stageKey: 'r2' },
  '605256926':   { name: 'PM',                      kind: 'roleApp', role: 'PM' },
  '416168819':   { name: 'Resume Shortlisting - PM', kind: 'roleShortlist', role: 'PM' },
  '35565132':    { name: 'Interview R1 - PM',       kind: 'roleStage', role: 'PM', stageKey: 'r1' },
  '1896011046':  { name: 'R2 - PM',                 kind: 'roleStage', role: 'PM', stageKey: 'r2' },
  '396607892':   { name: 'R3 - PM',                 kind: 'roleStage', role: 'PM', stageKey: 'r3' },
  '2006028202':  { name: 'COS',                     kind: 'roleApp', role: 'COS' },
  '619962516':   { name: 'Resume Shortlisting - COS', kind: 'roleShortlist', role: 'COS' },
  '1067762702':  { name: 'Interview R1 - COS',      kind: 'roleStage', role: 'COS', stageKey: 'r1' },
  '1884677328':  { name: 'Interview R2 - COS',      kind: 'roleStage', role: 'COS', stageKey: 'r2' },
  '167378717':   { name: 'Interview R3 - COS',      kind: 'roleStage', role: 'COS', stageKey: 'r3' },
  '1032909525':  { name: 'Details',                 kind: 'details' },
  '1480942623':  { name: 'Common DropDowns',        kind: 'statusEnums' },
  '1938133357':  { name: 'Role Based DropDowns',    kind: 'rejectionTax' },
  '749041276':   { name: 'Report',                  kind: 'raw' },
  '1537233953':  { name: 'Sheet89',                 kind: 'raw' },
  '1105935918':  { name: 'HeadHunting Sheet',       kind: 'raw' },
  '567780607':   { name: 'Raw Data',                kind: 'raw' },
  '1984825503':  { name: 'Data to Add in Candidates Data', kind: 'raw' },
  '0':           { name: 'Candidates Data',         kind: 'candidatesData' },
  '1040347175':  { name: 'BSF Responses',           kind: 'raw' },
  '1691591316':  { name: 'BSF → Raw Staging',       kind: 'raw' },
  '1838948044':  { name: 'CV Vetting Staging',      kind: 'raw' },
  '1124731102':  { name: 'CV Vetting',              kind: 'stage', stageKey: 'bsf' },
  '1784715601':  { name: 'TI Staging',              kind: 'raw' },
  '1384870553':  { name: 'Telephonic Interview',    kind: 'stage', stageKey: 'ti' },
  '850698559':   { name: 'TI Questionnaire',        kind: 'raw' },
  '47675028':    { name: 'R1 Questionnaire',        kind: 'raw' },
  '1410624870':  { name: 'Assignment Staging',      kind: 'raw' },
  '213183006':   { name: 'Assignment',              kind: 'stage', stageKey: 'assignment' },
  '525758960':   { name: 'Assignment Responses',    kind: 'raw' },
  '1170354080':  { name: 'Assessment',              kind: 'stage', stageKey: 'assessment' },
  '587522552':   { name: 'Assessment Responses',    kind: 'raw' },
  '1088859135':  { name: 'Assessment Score',        kind: 'raw' },
  '26965253':    { name: 'Interview R1 Staging',    kind: 'raw' },
  '1828573776':  { name: 'HR Round 1',              kind: 'stage', stageKey: 'hr1' },
  '1560801049':  { name: 'HR Round 2',              kind: 'stage', stageKey: 'hr2' },
  '213008015':   { name: 'ES Round',                kind: 'stage', stageKey: 'es' },
  '1717931262':  { name: 'Salary Negotiation',      kind: 'stage', stageKey: 'salNeg' },
};

export function extractSheetId(input) {
  const m = (input || '').match(/\/d\/([a-zA-Z0-9-_]+)/) || (input || '').match(/^([a-zA-Z0-9-_]{30,})$/);
  return m ? m[1] : null;
}

function buildCsvUrl(sheetId, gid) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}&_t=${Date.now()}`;
}

async function fetchCsv(sheetId, gid) {
  const res = await fetch(buildCsvUrl(sheetId, gid), { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for gid=${gid}`);
  const text = await res.text();
  if (text.trim().startsWith('<')) throw new Error(`Got HTML for gid=${gid} — sheet is private`);
  return text;
}

async function discoverGids(sheetId) {
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview?_t=${Date.now()}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const html = await res.text();
  return [...new Set([...html.matchAll(/gid=(\d+)/g)].map(m => m[1]))];
}

// ---------- Candidate merger ----------
function emptyCandidate(name) {
  return {
    uid: '',
    name,
    nameKey: nameKey(name),
    role: '',
    phone: '',
    email: '',
    nativeLanguage: '',
    currentLocation: '',
    location: '',
    sourceName: '',
    sourceCategory: '',
    currentCTC: '',
    expectedCTC: '',
    currentCompany: '',
    noticePeriod: '',
    resumeLink: '',
    linkedinUrl: '',
    timestamp: '',
    timestampDate: null,
    application: null,          // role-app tab record
    details: null,              // Details tab record
    stages: {},                 // stageKey → record
    stageKeysPresent: [],       // ordered by STAGE_INDEX
    currentStage: '',
    currentStageStatus: '',
    currentStageDate: null,
    finalDecision: 'active',    // active | hired | rejected
    rejectionStage: '',
    rejectionReason: '',
    panelists: [],              // unique panelists across stages
  };
}

function mergeCandidate(cand, src, kind) {
  for (const k of ['mobile','phone','email','nativeLanguage','currentLocation','location',
    'sourceName','sourceCategory','currentCTC','expectedCTC','currentCompany',
    'noticePeriod','resumeLink','linkedinUrl']) {
    if (!cand[k] && src[k]) cand[k] = src[k];
  }
  // Mobile → phone fallback
  if (!cand.phone && src.mobile) cand.phone = src.mobile;
  if (kind === 'roleApp') {
    cand.role = cand.role || src.role;
    cand.application = src;
    cand.timestamp = src.timestamp;
    cand.timestampDate = src.timestampDate;
  } else if (kind === 'details') {
    cand.details = src;
    if (!cand.role && src.role) cand.role = src.role.replace(/\s+\d+$/, '');  // "PM 2" → "PM"
    if (!cand.location && src.location) cand.location = src.location;
  } else if (kind === 'stage') {
    if (src.uid && !cand.uid) cand.uid = src.uid;
    cand.stages[src.stage] = src;
    if (src.panelist && !cand.panelists.includes(src.panelist)) cand.panelists.push(src.panelist);
  }
}

function finalizeCandidate(c) {
  // Determine current stage = highest STAGE_INDEX among populated stages,
  // with role-app counting as 'sourced' if no later stage exists.
  const stageKeys = Object.keys(c.stages);
  stageKeys.sort((a, b) => (STAGE_INDEX[a] ?? -1) - (STAGE_INDEX[b] ?? -1));
  c.stageKeysPresent = stageKeys;

  let latestKey = stageKeys[stageKeys.length - 1];
  if (!latestKey) latestKey = c.application ? 'sourced' : '';

  c.currentStage = latestKey;
  if (latestKey && c.stages[latestKey]) {
    c.currentStageStatus = c.stages[latestKey].status || '';
    c.currentStageDate = c.stages[latestKey].parsedDate;
  } else if (c.application) {
    c.currentStageStatus = c.application.selectStatus || 'sourced';
    c.currentStageDate = c.application.timestampDate;
  }

  // Final decision: rejection stage wins, then 'hired' if joined/offer, else active
  let finalDecision = 'active';
  let rejStage = '', rejReason = '';
  for (const k of stageKeys) {
    const s = c.stages[k];
    if (s.decision === 'rejected') {
      finalDecision = 'rejected';
      rejStage = k;
      rejReason = [s.rejectionCategory, s.rejectionSub].filter(Boolean).join(' · ');
      break;
    }
    if (s.decision === 'hired') finalDecision = 'hired';
  }
  if (c.application?.selectStatus === 'rejected' && finalDecision === 'active') {
    finalDecision = 'rejected';
    rejStage = 'sourced';
  }
  c.finalDecision = finalDecision;
  c.rejectionStage = rejStage;
  c.rejectionReason = rejReason;
}

// ---------- Main entry ----------
export async function fetchAndMergeAllTabs(sheetUrl) {
  const sheetId = extractSheetId(sheetUrl) || DEFAULT_SHEET_ID;
  const discovered = await discoverGids(sheetId);
  const gids = discovered.length ? discovered : Object.keys(TAB_MAP);

  // Fetch both sheets in parallel: primary tabs + secondary plan tabs
  const planGids = Object.keys(PLAN_TABS);
  const [primaryFetches, planFetches] = await Promise.all([
    Promise.allSettled(gids.map(async gid => ({ gid, text: await fetchCsv(sheetId, gid) }))),
    Promise.allSettled(planGids.map(async gid => ({ gid, text: await fetchCsv(PLAN_SHEET_ID, gid) }))),
  ]);
  const fetches = primaryFetches;

  const tabSummary = [];
  const warnings = [];
  const rawTabs = {};               // gid → { headers, rows } for raw viewer

  const applications = [];          // role-app rows
  const details = [];               // Details rows
  const stageEvents = [];           // per-stage records
  let candidatesDataSchema = null;
  let rejectionTaxonomy = null;
  let statusEnums = null;
  let dashboardData = null;

  // --- Parse secondary (plan) sheet first ---
  let hiringPlan = [];
  let legacyDashboard = null;
  const legacyEvents = [];          // legacy role-tracker events (R1/R2/R3 per round)
  for (const r of planFetches) {
    if (r.status !== 'fulfilled') {
      warnings.push(`Plan sheet: ${r.reason?.message || r.reason}`);
      continue;
    }
    const { gid, text } = r.value;
    const meta = PLAN_TABS[gid];
    if (!meta) continue;
    const summary = { gid, name: meta.name, kind: meta.kind, source: 'plan-sheet', bytes: text.length, rows: text.split('\n').length };
    tabSummary.push(summary);
    rawTabs[`plan-${gid}`] = { ...meta, gid: `plan-${gid}`, source: 'plan-sheet', ...parseRaw(text) };
    if (meta.kind === 'legacyRole') {
      const evs = parseLegacyRoleTracker(text, meta.role);
      summary.events = evs.length;
      legacyEvents.push(...evs);
    } else if (meta.kind === 'plan') {
      hiringPlan = parseHiringPlan(text);
      summary.planRows = hiringPlan.length;
    } else if (meta.kind === 'legacyDashboard') {
      legacyDashboard = parseLegacyDashboardData(text);
    }
  }

  for (const r of fetches) {
    if (r.status !== 'fulfilled') {
      warnings.push(String(r.reason?.message || r.reason));
      continue;
    }
    const { gid, text } = r.value;
    const meta = TAB_MAP[gid] || { name: `Tab ${gid}`, kind: 'raw' };
    const bytes = text.length;
    const rowCount = text.split('\n').length;
    const summary = { gid, name: meta.name, kind: meta.kind, bytes, rows: rowCount };
    tabSummary.push(summary);

    // Always parse for the raw viewer
    rawTabs[gid] = { ...meta, gid, ...parseRaw(text) };

    if (meta.kind === 'roleApp') {
      const recs = parseRoleApplicationTab(text, meta.role);
      summary.candidates = recs.length;
      applications.push(...recs);
    } else if (meta.kind === 'roleShortlist') {
      const recs = parseRoleApplicationTab(text, meta.role);
      summary.candidates = recs.length;
      // Treat shortlist tab as same role-app stream (recruiter-reviewed slice)
      applications.push(...recs);
    } else if (meta.kind === 'roleStage') {
      // Per-role stage tab (e.g. "Interview R1 - PMA"). Parse as generic stage
      // and tag with both stage and role.
      const recs = parseStageTab(text, meta.stageKey);
      for (const rec of recs) rec.role = meta.role;
      summary.events = recs.length;
      stageEvents.push(...recs);
    } else if (meta.kind === 'stage') {
      const recs = parseStageTab(text, meta.stageKey);
      summary.events = recs.length;
      stageEvents.push(...recs);
    } else if (meta.kind === 'details') {
      const recs = parseDetailsTab(text);
      summary.candidates = recs.length;
      details.push(...recs);
    } else if (meta.kind === 'candidatesData') {
      candidatesDataSchema = parseCandidatesDataTab(text);
    } else if (meta.kind === 'rejectionTax') {
      rejectionTaxonomy = parseRejectionTaxonomy(text);
    } else if (meta.kind === 'statusEnums') {
      statusEnums = parseStatusEnums(text);
    } else if (meta.kind === 'dashboardData') {
      dashboardData = parseDashboardData(text);
    }
    // 'raw' / 'ignore' fall through — only included in rawTabs
  }

  // ---------- Merge into candidates keyed by (uid OR nameKey) ----------
  const byKey = new Map();
  const upsertByName = (name) => {
    const key = nameKey(name);
    if (!key) return null;
    if (!byKey.has(key)) byKey.set(key, emptyCandidate(name));
    return byKey.get(key);
  };

  for (const app of applications) {
    const c = upsertByName(app.name);
    if (c) mergeCandidate(c, app, 'roleApp');
  }
  for (const d of details) {
    const c = upsertByName(d.name);
    if (c) mergeCandidate(c, d, 'details');
  }
  for (const ev of stageEvents) {
    const c = upsertByName(ev.name);
    if (c) {
      if (ev.role && !c.role) c.role = ev.role;
      mergeCandidate(c, ev, 'stage');
    }
  }
  // Legacy role-tracker events: new-sheet candidates take priority, but if a
  // candidate only exists in legacy (e.g. all BOA, or PMA/PM/COS people the
  // new sheet doesn't know about), they become candidates too. For existing
  // candidates we add legacy-only events as `legacyStages[stage]` without
  // overwriting the rich new-sheet stage data.
  for (const ev of legacyEvents) {
    const c = upsertByName(ev.name);
    if (!c) continue;
    if (!c.role) c.role = ev.role;
    if (!c.legacyStages) c.legacyStages = {};
    // Pick the latest by date if multiple events for same stage
    const existing = c.legacyStages[ev.stage];
    if (!existing || (ev.parsedDate && (!existing.parsedDate || ev.parsedDate > existing.parsedDate))) {
      c.legacyStages[ev.stage] = ev;
    }
    // If no new-sheet stage exists for this stage, also use legacy as the primary stage
    if (!c.stages[ev.stage] && ev.decision) {
      c.stages[ev.stage] = { ...ev, panelist: '', stageData: {} };
    }
  }

  for (const c of byKey.values()) finalizeCandidate(c);
  const candidates = [...byKey.values()];

  return {
    sheetId,
    tabSummary,
    warnings,
    rawTabs,
    applications,
    details,
    stageEvents,
    legacyEvents,
    candidates,
    candidatesDataSchema,
    rejectionTaxonomy,
    statusEnums,
    dashboardData,
    hiringPlan,
    legacyDashboard,
  };
}
