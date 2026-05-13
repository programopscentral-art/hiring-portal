import { parseCSV, trim2D } from './csv.js';

/* =============================================================
   TAB CLASSIFIER — given raw CSV, decide what kind of tab it is.
   Returns one of:
     - 'summary'        per-role aggregate stats
     - 'plan'           clean hiring plan (S.No, State, Location, ...)
     - 'role-tracker'   one role's Resume/R1/R2/R3 columns
     - 'combined'      legacy: all roles + plan in one wide layout
     - 'unknown'
   ============================================================= */
export function classifyTab(csvText) {
  if (!csvText || csvText.trim().length < 30) return 'unknown';
  const rows = parseCSV(csvText).slice(0, 3);
  if (!rows.length) return 'unknown';
  const r0 = (rows[0] || []).map(c => (c || '').toString().trim());
  const r0Lower = r0.map(c => c.toLowerCase());
  const text = csvText.slice(0, 2000).toLowerCase();

  // Summary stats: row 0 has role names (PMA, PM, COS, BOA) in adjacent cells,
  // row 1+ contains "total resumes shortlisted"
  const isRoleName = c => /^(pma|pm|cos|boa)$/i.test(c);
  if (r0Lower.filter(isRoleName).length >= 2 && /total resumes shortlisted/.test(text)) {
    return 'summary';
  }

  // Plan: header row starts with "S.No,State,Location"
  const plainHeader = r0Lower.join(',');
  if (/^s\.?\s*no.*\bstate\b.*\b(location|university)\b.*\brole\b/.test(plainHeader)) {
    return 'plan';
  }

  // Combined tracker: row 0 has "PMA Resume shortlisting" AND "PM Resume shortlisting"
  // AND "Hiring Plan" — all in one sheet
  const r0joined = r0.join(',').toLowerCase();
  const trackerHeaders = r0joined.match(/(pma|pm|cos|boa)\s+(resume\s+shortlisting|shortlisting|r\d\s+status)/g) || [];
  if (trackerHeaders.length >= 3 && r0joined.includes('hiring plan')) {
    return 'combined';
  }

  // Role tracker: single role's tabular layout. First non-empty cell of row 0
  // looks like "<ROLE> Resume shortlisting" or "<ROLE> Shortlisting"
  const firstNonEmpty = r0.find(c => c) || '';
  if (/^(pma|pm|cos|boa)\s+(resume\s+shortlisting|shortlisting)/i.test(firstNonEmpty)) {
    return 'role-tracker';
  }

  return 'unknown';
}

/* =============================================================
   MASTER SUMMARY TAB
   Structure: row 0 has role headers (PMA,,,PM,,,COS,,,BOA),
              rows 1..N are per-role stat rows ("total resumes shortlisted", value)
              followed (after a blank row) by the hiring plan block.
   ============================================================= */
export function parseMasterSummaryTab(csvText) {
  const rows = parseCSV(csvText).map(r => r.map(c => (c ?? '').toString()));
  if (!rows.length) return { roleStats: {}, planRich: [], warnings: ['Empty sheet'] };

  const headerRow = rows[0].map(c => c.trim());
  const roleColumns = [];
  for (let i = 0; i < headerRow.length; i++) {
    const v = headerRow[i].trim();
    if (v && /^(PMA|PM|COS|BOA)$/i.test(v)) {
      roleColumns.push({ role: v.toUpperCase(), nameCol: i, valCol: i + 1 });
    }
  }

  const roleStats = {};
  for (const rc of roleColumns) roleStats[rc.role] = {};

  let planStartRow = -1;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const cell0 = (row[0] || '').trim();
    if (/^S\.?\s*No$/i.test(cell0)) {
      planStartRow = r;
      break;
    }
    if (/^\d+$/.test(cell0) && row.length > 4 && /^(University Partner|Internal)$/i.test(row[3] || '')) {
      planStartRow = r;
      break;
    }
    for (const rc of roleColumns) {
      const name = (row[rc.nameCol] || '').trim();
      const val  = (row[rc.valCol]  || '').trim();
      if (!name) continue;
      const key = normalizeStatKey(name);
      if (!key) continue;
      const num = parseFloat(val);
      if (!Number.isNaN(num)) roleStats[rc.role][key] = num;
    }
  }

  const planRich = [];
  if (planStartRow >= 0) {
    let hr = planStartRow;
    if (!/^S\.?\s*No$/i.test((rows[hr][0] || '').trim())) {
      for (let i = hr - 1; i >= 0; i--) {
        if (/^S\.?\s*No$/i.test((rows[i][0] || '').trim())) { hr = i; break; }
      }
    }
    planRich.push(...parsePlanRows(rows, hr));
  }

  return { roleStats, planRich, warnings: [] };
}

/* =============================================================
   STANDALONE PLAN TAB (gid=118081566 in new sheet)
   Header: S.No,State,Location / University,Location Type,Role,No. of Positions,Decision,Hiring status
   ============================================================= */
export function parsePlanTab(csvText) {
  const rows = parseCSV(csvText).map(r => r.map(c => (c ?? '').toString()));
  if (!rows.length) return [];
  // First row IS the header
  return parsePlanRows(rows, 0);
}

function parsePlanRows(rows, headerRow) {
  const hdr = rows[headerRow].map(c => c.trim().toLowerCase());
  const idxOf = (...names) => {
    for (const n of names) {
      const i = hdr.indexOf(n.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };
  const cSno   = idxOf('s.no', 'sno', 's no', 's. no');
  const cState = idxOf('state');
  const cLoc   = idxOf('location / university', 'location/university', 'location');
  const cType  = idxOf('location type');
  const cRole  = idxOf('role');
  const cPos   = idxOf('no. of positions', 'positions');
  const cCtc   = idxOf('ctc per position (lpa)', 'ctc per position', 'ctc');
  const cTtc   = idxOf('total ctc (lpa)', 'total ctc');
  const cDec   = idxOf('decision');
  const cStat  = idxOf('hiring status', 'status');

  const out = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    const sno = (row[cSno] || '').trim();
    if (!sno || !/^\d+$/.test(sno)) continue;
    const positions = parseInt((row[cPos] || '0').trim(), 10) || 0;
    const ctc       = parseFloat((row[cCtc] || '').trim()) || 0;
    const ttcExplicit = parseFloat((row[cTtc] || '').trim()) || 0;
    const status = (row[cStat] || '').trim();
    out.push({
      sno: parseInt(sno, 10),
      state: (row[cState] || '').trim(),
      location: (row[cLoc] || '').trim(),
      type: (row[cType] || '').trim() || 'University Partner',
      role: (row[cRole] || '').trim(),
      positions,
      ctcPerPosition: ctc,
      totalCtc: ttcExplicit || (positions * ctc),
      decision: (row[cDec] || '').trim(),
      hiringStatus: status,
      hired: status.toLowerCase() === 'hired',
    });
  }
  return out;
}

/* =============================================================
   ROLE-TRACKER TAB (one role's Resume / R1 / R2 / R3 columns)
   Row 0 group headers like "BOA Resume shortlisting,,BOA R1 status,,,BOA R2 status,..."
   Row 1 sub-headers: NAME, RESUME SELECTION STATUS, R1 DATE, NAME, R1 SELECTION STATUS, ...
   Resume stage = 2 cols (NAME, STATUS) starting col 0.
   Each subsequent stage = 3 cols (DATE, NAME, STATUS).
   ============================================================= */
export function parseRoleTrackerTab(csvText) {
  const rows = parseCSV(csvText).map(r => r.map(c => (c ?? '').toString()));
  if (rows.length < 3) return [];

  const groupHeader = rows[0];
  const firstNonEmpty = groupHeader.find(c => (c || '').trim());
  if (!firstNonEmpty) return [];
  const roleMatch = firstNonEmpty.match(/^\s*(PMA|PM|COS|BOA)\b/i);
  if (!roleMatch) return [];
  const role = roleMatch[1].toUpperCase();

  // Build stage list: Resume at cols 0,1; then sweep groupHeader for R1/R2/R3 markers
  const stages = [{ stage: 'Resume', cols: { name: 0, status: 1, date: null } }];
  for (let c = 2; c < groupHeader.length; c++) {
    const header = (groupHeader[c] || '').trim();
    const m = header.match(/R(\d)\s+status/i);
    if (m) {
      stages.push({
        stage: `R${m[1]}`,
        cols: { date: c, name: c + 1, status: c + 2 },
      });
      c += 2; // skip the 3-col group
    }
  }

  const activities = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    for (const s of stages) {
      const name   = (row[s.cols.name]   || '').trim();
      const status = (row[s.cols.status] || '').trim();
      const date   = s.cols.date != null ? (row[s.cols.date] || '').trim() : '';
      if (!name && !status) continue;
      activities.push({
        role,
        stage: s.stage,
        name,
        status,
        date,
        parsedDate: parseFlexibleDate(date),
        decision: classifyDecision(status),
        rowIndex: i,
      });
    }
  }
  return activities;
}

/* =============================================================
   COMBINED TRACKER (legacy layout — gid=0 in new sheet)
   PMA / PM / COS tracks side by side, with Hiring Plan on the right.
   ============================================================= */
const COMBINED_TRACKS = [
  { role: 'PMA', stages: [
    { stage: 'Resume', cols: { name: 0,  status: 1,  date: null } },
    { stage: 'R1',     cols: { name: 4,  status: 5,  date: 3 } },
    { stage: 'R2',     cols: { name: 8,  status: 9,  date: 7 } },
  ]},
  { role: 'PM', stages: [
    { stage: 'Resume', cols: { name: 11, status: 12, date: null } },
    { stage: 'R1',     cols: { name: 15, status: 16, date: 14 } },
    { stage: 'R2',     cols: { name: 19, status: 20, date: 18 } },
    { stage: 'R3',     cols: { name: 23, status: 24, date: 22 } },
  ]},
  { role: 'COS', stages: [
    { stage: 'Resume', cols: { name: 26, status: 27, date: null } },
    { stage: 'R1',     cols: { name: 30, status: 31, date: 29 } },
    { stage: 'R2',     cols: { name: 34, status: 35, date: 33 } },
    { stage: 'R3',     cols: { name: 38, status: 39, date: 37 } },
  ]},
];

const COMBINED_PLAN_COLS = { sno: 41, state: 42, location: 43, type: 44, role: 45, positions: 46 };

export function parseCombinedTab(csvText) {
  const rows = trim2D(parseCSV(csvText));
  if (rows.length < 2) return { activities: [], plan: [] };

  const activities = [];
  const plan = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];

    for (const t of COMBINED_TRACKS) {
      for (const s of t.stages) {
        const name   = (r[s.cols.name]   || '').trim();
        const status = (r[s.cols.status] || '').trim();
        const date   = s.cols.date != null ? (r[s.cols.date] || '').trim() : '';
        if (!name && !status) continue;
        activities.push({
          role: t.role,
          stage: s.stage,
          name,
          status,
          date,
          parsedDate: parseFlexibleDate(date),
          decision: classifyDecision(status),
          rowIndex: i,
        });
      }
    }

    const sno = (r[COMBINED_PLAN_COLS.sno] || '').trim();
    if (sno && /^\d+$/.test(sno)) {
      plan.push({
        sno: parseInt(sno, 10),
        state: (r[COMBINED_PLAN_COLS.state] || '').trim(),
        location: (r[COMBINED_PLAN_COLS.location] || '').trim(),
        type: (r[COMBINED_PLAN_COLS.type] || '').trim() || 'University Partner',
        role: (r[COMBINED_PLAN_COLS.role] || '').trim(),
        positions: parseInt((r[COMBINED_PLAN_COLS.positions] || '0').trim(), 10) || 0,
      });
    }
  }

  return { activities, plan };
}

/* =============================================================
   Master per-candidate tab (the 170-col template, if present)
   ============================================================= */
export function parseMasterSheet(csvText) {
  const rows = trim2D(parseCSV(csvText));
  if (rows.length < 1) return { headers: [], candidates: [], warnings: ['Master sheet is empty.'] };
  const headers = rows[0];
  const idxOf = name => headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase().trim());

  const get = (row, name) => {
    const i = idxOf(name);
    return i >= 0 ? (row[i] || '') : '';
  };

  const candidates = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = get(r, 'Candidate Name');
    if (!name) continue;
    const c = {};
    for (let h = 0; h < headers.length; h++) {
      const key = headers[h];
      if (!key) continue;
      c[key] = r[h] || '';
    }
    c.__id = c['UID'] || `${name}-${i}`;
    c.__name = name;
    c.__phone = c['Phone Number(10)'] || c['Candidate Phone Number'] || '';
    c.__email = c['Candidate Email ID'] || '';
    c.__source = c['Source Name'] || 'Unknown';
    c.__sourceCategory = c['Source Catogory'] || c['Source Category'] || '';
    c.__cycle = c['Cycle'] || '';
    c.__sourcedBy = c['Sourcing done by'] || '';
    c.__downloaded = c['Downloaded date'] || '';
    c.__currentStage = c['Current Stage of the candidate'] || '';
    c.__joinDate = c['Date of Joining'] || '';
    c.__joiningStatus = c['Joining Status'] || '';
    c.__resumeLink = c['Resume Link'] || '';
    c.__linkedIn = c['LinkedIn Profile Link'] || '';
    c.__role = c['Role'] || c['Designation'] || '';
    candidates.push(c);
  }

  return { headers, candidates, warnings: [] };
}

// Kept for backward-compat with old code paths.
export const parseTrackerSheet = parseCombinedTab;

/* =============================================================
   Helpers
   ============================================================= */
export function parseFlexibleDate(s) {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  let d = new Date(t);
  if (!isNaN(d)) return d;
  const m = t.match(/^(\d{1,2})[-\s/](\w{3,9})[-\s/](\d{2,4})$/);
  if (m) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mi = months.indexOf(m[2].slice(0,3).toLowerCase());
    if (mi >= 0) {
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      d = new Date(year, mi, parseInt(m[1], 10));
      if (!isNaN(d)) return d;
    }
  }
  return null;
}

export function classifyDecision(status, stage) {
  const s = (status || '').toLowerCase().trim();
  if (!s) return 'pending';
  if (s.includes('select') && !s.includes('rejected')) return 'selected';
  if (s.includes('reject')) return 'rejected';
  if (s.includes('hold')) return 'hold';
  if (s.includes('reschedul')) return 'rescheduled';
  return 'other';
}

function normalizeStatKey(name) {
  const s = name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (s === 'total resumes shortlisted') return 'resumesTotal';
  if (s === 'resume shortlisting selected') return 'resumesSelected';
  if (s === 'resume shortlisting rejected') return 'resumesRejected';
  if (s === 'resume shortlisting hold') return 'resumesHold';
  if (s === 'total r1') return 'r1Total';
  if (s === 'r1 selected') return 'r1Selected';
  if (s === 'r1 rejected') return 'r1Rejected';
  if (s === 'r1 rescheuled' || s === 'r1 rescheduled') return 'r1Rescheduled';
  if (s === 'r1 hold') return 'r1Hold';
  if (s === 'total r2') return 'r2Total';
  if (s === 'r2 selected') return 'r2Selected';
  if (s === 'r2 rejected') return 'r2Rejected';
  if (s === 'r2 rescheuled' || s === 'r2 rescheduled') return 'r2Rescheduled';
  if (s === 'r2 hold') return 'r2Hold';
  if (s === 'total r3') return 'r3Total';
  if (s === 'r3 selected') return 'r3Selected';
  if (s === 'r3 rejected') return 'r3Rejected';
  if (s === 'r3 rescheuled' || s === 'r3 rescheduled') return 'r3Rescheduled';
  if (s === 'r3 hold') return 'r3Hold';
  return null;
}
