// Parsers for the ProgramOps hiring sheet (1vhoYflwEKI...).
// The sheet has 44 tabs covering a ~20-stage hiring pipeline. Each gid maps
// deterministically to a parser via TAB_MAP in sheets.js.

import { parseCSV, trim2D } from './csv.js';

// ---------- Canonical stage ladder ----------
export const STAGES = [
  { key: 'sourced',     label: 'Sourced',                short: 'SRC' },
  { key: 'bsf',         label: 'BSF Form',               short: 'BSF' },
  { key: 'bsc',         label: 'Basic Screening Call',   short: 'BSC' },
  { key: 'hmReview',    label: 'HM Review',              short: 'HM' },
  { key: 'ti',          label: 'Telephonic Interview',   short: 'TI' },
  { key: 'assignment',  label: 'Assignment',             short: 'ASGN' },
  { key: 'assessment',  label: 'Assessment',             short: 'ASSM' },
  { key: 'r1',          label: 'Interview R1',           short: 'R1' },
  { key: 'r2',          label: 'Interview R2',           short: 'R2' },
  { key: 'r3',          label: 'Interview R3',           short: 'R3' },
  { key: 'hr1',         label: 'HR Round 1',             short: 'HR1' },
  { key: 'empVerify',   label: 'Employee Verification',  short: 'EMV' },
  { key: 'hr2',         label: 'HR Round 2',             short: 'HR2' },
  { key: 'es',          label: 'ES Round',               short: 'ES' },
  { key: 'salNeg',      label: 'Salary Negotiation',     short: 'SAL' },
  { key: 'bgv',         label: 'BGV',                    short: 'BGV' },
  { key: 'offer',       label: 'Offer Letter',           short: 'OFR' },
  { key: 'joined',      label: 'Joined',                 short: 'JOIN' },
];
export const STAGE_KEYS = STAGES.map(s => s.key);
export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

export const ROLES = ['PMA', 'PM', 'COS', 'BOA'];

// ---------- Helpers ----------
const clean = s => (s == null ? '' : String(s)).trim();
const lower = s => clean(s).toLowerCase();

export function parseFlexibleDate(s) {
  if (!s) return null;
  s = clean(s);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = +m[3]; const Y = y < 100 ? 2000 + y : y;
    return new Date(Y, +m[1] - 1, +m[2]);
  }
  m = s.match(/^(\d{1,2})[-\s](\w{3,})[-\s](\d{2,4})/);
  if (m) {
    const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    const mo = months[lower(m[2]).slice(0,3)];
    if (mo != null) {
      const y = +m[3]; const Y = y < 100 ? 2000 + y : y;
      return new Date(Y, mo, +m[1]);
    }
  }
  const d = new Date(s);
  return isNaN(+d) ? null : d;
}

export function nameKey(s) {
  return lower(s).replace(/[^a-z0-9]+/g, ' ').trim();
}

function asNum(s) {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}

export function classifyDecision(s) {
  const x = lower(s);
  if (!x) return 'active';
  if (/(reject|not\s*shortlist|drop|not\s*select|no\s*go|unfit|fail)/.test(x)) return 'rejected';
  if (/(hired|joined|onboard|joining)/.test(x)) return 'hired';
  if (/(select|shortlist|move|pass|next|go\s*ahead|approved|cleared)/.test(x)) return 'selected';
  if (/(hold|on\s*hold|pending|reschedul|defer)/.test(x)) return 'hold';
  return 'active';
}

// =====================================================================
// PARSERS
// =====================================================================

/**
 * Parse one of the role-application tabs (PMA, PM, COS, BOA).
 * These tabs are Google Form responses with a `selects` / `select` column
 * indicating initial recruiter shortlisting.
 */
export function parseRoleApplicationTab(text, role) {
  const rows = trim2D(parseCSV(text));
  if (rows.length < 2) return [];
  const headers = rows[0];
  const findH = re => headers.findIndex(h => re.test(h));
  const cTs = findH(/^timestamp$/i);
  const cName = findH(/^name$/i);
  const cMobile = findH(/mobile|phone/i);
  const cEmail = findH(/email/i);
  const cAge = findH(/^age$/i);
  const cLoc = findH(/current location/i);
  const cLang = findH(/native language/i);
  const cCurCtc = findH(/current ctc/i);
  const cExpCtc = findH(/expected ctc|expecting ctc/i);
  const cNotice = findH(/notice/i);
  const cCompany = findH(/current company/i);
  const cPrefLoc = findH(/preferred top|preffered top/i);
  const cOkLocs = findH(/comfortable.*location|location.*comfortable|work in below/i);
  const cResume = findH(/upload your resume|resume here/i);
  const cLinkedIn = findH(/linkedin/i);
  const cSelects = findH(/^selects?$/i);
  const cShortBy = findH(/shortlisted by/i);
  const cExtra = findH(/anything else.*fit/i);

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = clean(r[cName]);
    if (!name) continue;
    const sel = cSelects >= 0 ? lower(r[cSelects]) : '';
    out.push({
      role,
      timestamp: clean(r[cTs]),
      timestampDate: parseFlexibleDate(r[cTs]),
      name,
      nameKey: nameKey(name),
      mobile: cMobile >= 0 ? clean(r[cMobile]) : '',
      email: cEmail >= 0 ? clean(r[cEmail]) : '',
      age: cAge >= 0 ? asNum(r[cAge]) : null,
      currentLocation: cLoc >= 0 ? clean(r[cLoc]) : '',
      nativeLanguage: cLang >= 0 ? clean(r[cLang]) : '',
      currentCTC: cCurCtc >= 0 ? clean(r[cCurCtc]) : '',
      expectedCTC: cExpCtc >= 0 ? clean(r[cExpCtc]) : '',
      noticePeriod: cNotice >= 0 ? clean(r[cNotice]) : '',
      currentCompany: cCompany >= 0 ? clean(r[cCompany]) : '',
      preferredLocation: cPrefLoc >= 0 ? clean(r[cPrefLoc]) : '',
      okLocations: cOkLocs >= 0 ? clean(r[cOkLocs]) : '',
      resumeLink: cResume >= 0 ? clean(r[cResume]) : '',
      linkedinUrl: cLinkedIn >= 0 ? clean(r[cLinkedIn]) : '',
      selectStatus: sel,
      shortlistedBy: cShortBy >= 0 ? clean(r[cShortBy]) : '',
      extraNote: cExtra >= 0 ? clean(r[cExtra]) : '',
      _raw: r,
    });
  }
  return out;
}

/**
 * Parse the "Details" tab — master roster keyed by candidate name.
 */
export function parseDetailsTab(text) {
  const rows = trim2D(parseCSV(text));
  if (rows.length < 2) return [];
  const headers = rows[0];
  const findH = re => headers.findIndex(h => re.test(h));
  const cName = findH(/^candidate name/i);
  const cLang = findH(/native language/i);
  const cRole = findH(/^role$/i);
  const cCurCtc = findH(/current ctc/i);
  const cExpCtc = findH(/expected ctc/i);
  const cPrefLoc = findH(/preffered locations|preferred locations/i);
  const cR1Rec = findH(/r1 recording/i);
  const cR2Rec = findH(/r2 recording/i);
  const cR3Rec = findH(/r3 recording/i);
  const cResume = findH(/^resume$/i);
  const cRemarks = findH(/^remarks$/i);
  const cPhone = findH(/phone number/i);
  const cStatus = findH(/status of application/i);
  const cCool = findH(/cooling period/i);
  const cMove = findH(/moving status/i);
  const cApproval = findH(/approval/i);
  const cLoc = findH(/^location$/i);
  const cAlfisha = findH(/alfisha remarks/i);

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = clean(r[cName]);
    if (!name) continue;
    out.push({
      name,
      nameKey: nameKey(name),
      nativeLanguage: cLang >= 0 ? clean(r[cLang]) : '',
      role: cRole >= 0 ? clean(r[cRole]) : '',
      currentCTC: cCurCtc >= 0 ? clean(r[cCurCtc]) : '',
      expectedCTC: cExpCtc >= 0 ? clean(r[cExpCtc]) : '',
      preferredLocations: cPrefLoc >= 0 ? clean(r[cPrefLoc]) : '',
      r1Recording: cR1Rec >= 0 ? clean(r[cR1Rec]) : '',
      r2Recording: cR2Rec >= 0 ? clean(r[cR2Rec]) : '',
      r3Recording: cR3Rec >= 0 ? clean(r[cR3Rec]) : '',
      resume: cResume >= 0 ? clean(r[cResume]) : '',
      remarks: cRemarks >= 0 ? clean(r[cRemarks]) : '',
      phone: cPhone >= 0 ? clean(r[cPhone]) : '',
      statusOfApp: cStatus >= 0 ? clean(r[cStatus]) : '',
      coolingPeriod: cCool >= 0 ? clean(r[cCool]) : '',
      movingStatus: cMove >= 0 ? clean(r[cMove]) : '',
      approval: cApproval >= 0 ? clean(r[cApproval]) : '',
      location: cLoc >= 0 ? clean(r[cLoc]) : '',
      alfishaRemarks: cAlfisha >= 0 ? clean(r[cAlfisha]) : '',
      _raw: r,
    });
  }
  return out;
}

/**
 * Generic per-stage tab parser. Most stage tabs share a UID-keyed prefix:
 *   UID, Candidate Name, Phone, Email, Native Lang, Source Name, Source Cat,
 *   Sr. no, Resume Link, LinkedIn, <stage-specific cols...>
 */
export function parseStageTab(text, stageKey) {
  const rows = trim2D(parseCSV(text));
  if (rows.length < 2) return [];
  const headers = rows[0];
  const statusCol = headers.findIndex(h => /status of the candidate|selection status|^status$|round status/i.test(h));
  const dateCol = headers.findIndex(h => /round date$|hr1 date|hr2 date|^date$|interview.*done date/i.test(h));
  const panelistCol = headers.findIndex(h => /panelist name/i.test(h));
  const rejCat = headers.findIndex(h => /^rejection category/i.test(h));
  const rejSub = headers.findIndex(h => /^rejection subcategory/i.test(h));
  const remCol = headers.findIndex(h => /^remarks$/i.test(h));

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const uid = clean(r[0]);
    const name = clean(r[1]);
    if (!uid && !name) continue;
    const stageData = {};
    for (let j = 10; j < headers.length; j++) {
      const h = clean(headers[j]);
      const v = clean(r[j]);
      if (h && v) stageData[h] = v;
    }
    const status = statusCol >= 0 ? clean(r[statusCol]) : '';
    out.push({
      stage: stageKey,
      uid,
      name,
      nameKey: nameKey(name),
      phone: clean(r[2]),
      email: clean(r[3]),
      nativeLanguage: clean(r[4]),
      sourceName: clean(r[5]),
      sourceCategory: clean(r[6]),
      resumeLink: clean(r[8]),
      linkedinUrl: clean(r[9]),
      status,
      decision: classifyDecision(status),
      date: dateCol >= 0 ? clean(r[dateCol]) : '',
      parsedDate: dateCol >= 0 ? parseFlexibleDate(r[dateCol]) : null,
      panelist: panelistCol >= 0 ? clean(r[panelistCol]) : '',
      rejectionCategory: rejCat >= 0 ? clean(r[rejCat]) : '',
      rejectionSub: rejSub >= 0 ? clean(r[rejSub]) : '',
      remarks: remCol >= 0 ? clean(r[remCol]) : '',
      stageData,
      _raw: r,
    });
  }
  return out;
}

/**
 * Parse the master "Candidates Data" (gid=0) tab — 163-column denormalized
 * per-candidate schema. Used primarily as Raw Data viewer schema reference.
 */
export function parseCandidatesDataTab(text) {
  const rows = trim2D(parseCSV(text));
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0];
  const data = rows.slice(1).filter(r => r.some(c => c));
  return { headers, rows: data };
}

/**
 * Parse Role-Based Rejection Dropdowns (gid=1938133357) into a stage
 * taxonomy. Each 4-column block: <Stage> Rejections, Category, SubCategory, blank.
 */
export function parseRejectionTaxonomy(text) {
  const rows = trim2D(parseCSV(text));
  if (!rows.length) return { stages: {}, panelists: [], sources: [], associates: [] };
  const headers = rows[0];
  const stages = {};
  for (let c = 0; c < headers.length; c++) {
    const h = clean(headers[c]);
    if (/rejections?$/i.test(h) || /^(Interview R\d|HR \d|BGV|ES Round|Salary Negotiation|HM Review)$/i.test(h)) {
      const stageName = h.replace(/\s+Rejections?$/i, '');
      const cats = new Set(), subs = new Set();
      for (let i = 1; i < rows.length; i++) {
        const cat = clean(rows[i][c + 1]);
        const sub = clean(rows[i][c + 2]);
        if (cat) cats.add(cat);
        if (sub) subs.add(sub);
      }
      stages[stageName] = { categories: [...cats], subcategories: [...subs] };
    }
  }
  const cAssoc = headers.findIndex(h => /associate name/i.test(h));
  const cPan = headers.findIndex(h => /panelist names/i.test(h));
  const cSrc = headers.findIndex(h => /source names/i.test(h));
  const associates = [], panelists = [], sources = [];
  for (let i = 1; i < rows.length; i++) {
    if (cAssoc >= 0 && rows[i][cAssoc]) associates.push(clean(rows[i][cAssoc]));
    if (cPan >= 0 && rows[i][cPan]) panelists.push(clean(rows[i][cPan]));
    if (cSrc >= 0 && rows[i][cSrc]) sources.push(clean(rows[i][cSrc]));
  }
  return { stages, panelists, sources, associates };
}

/**
 * Parse "Common DropDowns" tab — status enumerations per column.
 */
export function parseStatusEnums(text) {
  const rows = trim2D(parseCSV(text));
  if (!rows.length) return {};
  const headers = rows[0];
  const out = {};
  for (let c = 0; c < headers.length; c++) {
    const key = clean(headers[c]);
    if (!key) continue;
    const vals = [];
    for (let i = 1; i < rows.length; i++) {
      const v = clean(rows[i][c]);
      if (v) vals.push(v);
    }
    if (vals.length) out[key] = vals;
  }
  return out;
}

/**
 * Parse Dashboard data tab — per-role aggregate stats.
 */
export function parseDashboardData(text) {
  const rows = trim2D(parseCSV(text));
  if (!rows.length) return { roles: {} };
  const headers = rows[0];
  const groups = [];
  for (let c = 0; c < headers.length; c++) {
    if (ROLES.includes(clean(headers[c]))) {
      groups.push({ role: clean(headers[c]), start: c });
    }
  }
  const roles = {};
  for (const g of groups) {
    const stats = {};
    for (let i = 1; i < rows.length; i++) {
      const label = clean(rows[i][g.start]);
      const value = clean(rows[i][g.start + 1]);
      if (label && value) stats[label] = value;
    }
    roles[g.role] = stats;
  }
  return { roles };
}

/**
 * Generic raw-data passthrough for the Raw Data viewer.
 */
export function parseRaw(text) {
  const rows = trim2D(parseCSV(text));
  if (!rows.length) return { headers: [], rows: [] };
  return { headers: rows[0], rows: rows.slice(1) };
}

// ---------- Legacy stubs (kept so old imports don't break during transition) ----------
export function classifyTab() { return 'unknown'; }
export function parseMasterSummaryTab() { return { roleStats: {}, planRich: [] }; }
export function parsePlanTab() { return []; }
export function parseRoleTrackerTab() { return []; }
export function parseCombinedTab() { return { activities: [], plan: [] }; }
export function parseMasterSheet() { return { candidates: [] }; }
