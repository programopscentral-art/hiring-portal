// Sheet URL handling.
// Single-URL workflow: paste one Google Sheet URL and the portal auto-discovers
// every tab, classifies it (summary / plan / role-tracker / etc.), and merges.

import { classifyTab, parseMasterSummaryTab, parsePlanTab, parseRoleTrackerTab, parseCombinedTab, parseMasterSheet } from './parse.js';

export function buildFetchUrl(input, opts = {}) {
  const t = (input || '').trim();
  if (!t) return null;

  if (/script\.google\.com\/macros\/s\//.test(t)) {
    let url = t;
    if (opts.sheet) url += (url.includes('?') ? '&' : '?') + 'sheet=' + encodeURIComponent(opts.sheet);
    return url;
  }

  if (/\/pub(?:\?|\/)/.test(t) && /(?:output|format)=csv/.test(t)) return t;
  if (/\/pub(?:\?|\/)/.test(t)) {
    return t.includes('?') ? t + '&output=csv' : t + '?output=csv';
  }

  const m = t.match(/\/d\/([a-zA-Z0-9-_]+)/) || t.match(/^([a-zA-Z0-9-_]{30,})$/);
  if (!m) return null;
  const id = m[1];

  const gid = opts.gid != null
    ? String(opts.gid)
    : (t.match(/[#&?]gid=(\d+)/)?.[1] || '');

  let url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  if (gid) url += `&gid=${gid}`;
  return url;
}

export function extractSheetId(input) {
  const m = (input || '').match(/\/d\/([a-zA-Z0-9-_]+)/) || (input || '').match(/^([a-zA-Z0-9-_]{30,})$/);
  return m ? m[1] : null;
}

export async function fetchSheetCSV(url, opts = {}) {
  const fetchUrl = buildFetchUrl(url, opts);
  if (!fetchUrl) throw new Error('Could not parse the sheet URL.');
  const cacheBust = (fetchUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const res = await fetch(fetchUrl + cacheBust, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();
  if (text.trim().startsWith('<')) {
    throw new Error('Got HTML instead of CSV. Either the sheet is private or the share permission is set incorrectly.');
  }
  return text;
}

// Discover every tab gid in a Google Sheet by scraping the public htmlview page.
export async function discoverTabs(sheetUrl) {
  const id = extractSheetId(sheetUrl);
  if (!id) return [];
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${id}/htmlview?_t=${Date.now()}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const html = await res.text();
  return [...new Set([...html.matchAll(/gid=(\d+)/g)].map(m => m[1]))];
}

/**
 * Fetch every tab in the sheet, classify by content, and return a merged
 * dataset. Any tab the classifier doesn't recognize is included in `unknown`
 * for surfacing.
 */
export async function fetchAndMergeAllTabs(sheetUrl) {
  if (!sheetUrl) {
    return { roleStats: {}, plan: [], activities: [], candidates: [], tabSummary: [], warnings: ['No sheet URL configured.'] };
  }
  const id = extractSheetId(sheetUrl);
  if (!id) {
    return { roleStats: {}, plan: [], activities: [], candidates: [], tabSummary: [], warnings: ['Could not extract sheet ID from URL.'] };
  }

  const gids = await discoverTabs(sheetUrl);
  if (!gids.length) {
    return { roleStats: {}, plan: [], activities: [], candidates: [], tabSummary: [], warnings: ['No tabs discovered. Check sharing permissions (must be "Anyone with the link can view").'] };
  }

  // Fetch every tab in parallel
  const fetches = await Promise.allSettled(
    gids.map(async gid => {
      const text = await fetchSheetCSV(sheetUrl, { gid });
      return { gid, text };
    })
  );

  // Classify + parse each fulfilled fetch
  let roleStats = {};
  let plan = [];
  let activities = [];
  let candidates = [];
  const tabSummary = [];
  const warnings = [];

  for (const r of fetches) {
    if (r.status !== 'fulfilled') {
      warnings.push(`Tab fetch failed: ${r.reason?.message || r.reason}`);
      continue;
    }
    const { gid, text } = r.value;
    const kind = classifyTab(text);
    const row = { gid, kind, bytes: text.length, rows: text.split('\n').length };
    tabSummary.push(row);

    if (kind === 'summary') {
      const s = parseMasterSummaryTab(text);
      // Merge — later tabs of the same type win (rare but safe)
      Object.assign(roleStats, s.roleStats);
      if (s.planRich.length) row.planRows = s.planRich.length;
      // Only adopt summary's plan if we don't already have a dedicated plan tab
      if (!plan.length && s.planRich.length) plan = s.planRich;

    } else if (kind === 'plan') {
      const p = parsePlanTab(text);
      // Dedicated plan tab wins over summary's embedded plan
      plan = p;
      row.planRows = p.length;

    } else if (kind === 'role-tracker') {
      const acts = parseRoleTrackerTab(text);
      row.role = acts[0]?.role || '?';
      row.events = acts.length;
      activities.push(...acts);

    } else if (kind === 'combined') {
      const c = parseCombinedTab(text);
      // Combined is treated as a SUPPLEMENT to per-role tabs — only adopt
      // its data if we have nothing from dedicated tabs.
      if (!activities.length) activities = c.activities;
      if (!plan.length) plan = c.plan;
      row.events = c.activities.length;
      row.planRows = c.plan.length;

    } else if (kind === 'unknown') {
      // Could be a candidate roster (UID, Candidate Name, ...)
      // Try parsing as the master per-candidate sheet — keep if any candidates parse.
      const m = parseMasterSheet(text);
      if (m.candidates.length > 0) {
        row.kind = 'candidates';
        row.candidates = m.candidates.length;
        candidates.push(...m.candidates);
      }
    }
  }

  // Deduplicate activities (in case combined + per-role both contributed)
  const seen = new Set();
  activities = activities.filter(a => {
    const k = `${a.role}|${a.stage}|${(a.name || '').toLowerCase()}|${a.date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Deduplicate candidates by name
  const seenC = new Set();
  candidates = candidates.filter(c => {
    const k = (c.__name || '').toLowerCase();
    if (!k || seenC.has(k)) return false;
    seenC.add(k);
    return true;
  });

  return { roleStats, plan, activities, candidates, tabSummary, warnings };
}
