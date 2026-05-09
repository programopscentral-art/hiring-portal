import { parseCSV, trim2D } from './csv.js';

/* =============================================================
   Sheet 1 — "Master sheet" default tab
   --------------------------------------------------------------
   Structure (verified from real data):
     Row 0: PMA | _ | _ | PM | _ | _ | COS | _ | _ | BOA | _ | _
     Rows 1..N: stat-name, value, _, stat-name, value, _, ...
       stats include:
         total resumes shortlisted
         RESUME shortlisting selected
         RESUME shortlisting rejected
         RESUME shortlisting hold
         total r1
         R1 selected
         r1 rejected
         r1 rescheuled
         r1 hold
         total r2 / r2 selected / r2 rejected / r2 rescheuled / r2 hold
         total r3 / r3 selected / r3 rejected / r3 rescheuled / r3 hold
     Then a blank row, then a richer Hiring Plan block:
       S.No, State, Location/University, Location Type, Role, No. of Positions,
       CTC per Position (LPA), Total CTC (LPA), Decision, Hiring status
   ============================================================= */
export function parseMasterSummaryTab(csvText) {
  const rows = parseCSV(csvText).map(r => r.map(c => (c ?? '').toString()));
  if (!rows.length) return { roleStats: {}, planRich: [], warnings: ['Empty sheet'] };

  // ---- 1. Stats block (rows 0..first blank row) ----
  const headerRow = rows[0].map(c => c.trim());
  const roleColumns = []; // [{ role, statCol, valCol }]
  for (let i = 0; i < headerRow.length; i++) {
    const v = headerRow[i].trim();
    if (v && /^(PMA|PM|COS|BOA)$/i.test(v)) {
      // Stats follow this header in (i, i+1) pairs (name, value), with i+2 typically blank
      roleColumns.push({ role: v.toUpperCase(), nameCol: i, valCol: i + 1 });
    }
  }

  const roleStats = {};
  for (const rc of roleColumns) roleStats[rc.role] = {};

  let planStartRow = -1;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    // Plan section starts when we see "S.No" or numeric "1" in col 0 with State pattern
    const cell0 = (row[0] || '').trim();
    if (/^S\.?\s*No$/i.test(cell0) || /^Sno$/i.test(cell0)) {
      planStartRow = r;
      break;
    }
    if (/^\d+$/.test(cell0) && row.length > 4 && /^(University Partner|Internal)$/i.test(row[3] || '')) {
      planStartRow = r;
      break;
    }
    // Stats — pull (name,value) pairs per role column
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

  // ---- 2. Plan block ----
  const planRich = [];
  if (planStartRow >= 0) {
    // Find header row first; the block may start on a header line ("S.No,State,...")
    let hr = planStartRow;
    if (!/^S\.?\s*No$/i.test((rows[hr][0] || '').trim())) {
      // First numeric row — back up to find header above it
      for (let i = hr - 1; i >= 0; i--) {
        if (/^S\.?\s*No$/i.test((rows[i][0] || '').trim())) { hr = i; break; }
      }
    }
    const hdr = rows[hr].map(c => c.trim().toLowerCase());
    const idxOf = (...names) => {
      for (const n of names) {
        const i = hdr.indexOf(n.toLowerCase());
        if (i >= 0) return i;
      }
      return -1;
    };
    const cSno   = idxOf('s.no', 'sno', 's no');
    const cState = idxOf('state');
    const cLoc   = idxOf('location / university', 'location/university', 'location');
    const cType  = idxOf('location type');
    const cRole  = idxOf('role');
    const cPos   = idxOf('no. of positions', 'positions');
    const cCtc   = idxOf('ctc per position (lpa)', 'ctc per position', 'ctc');
    const cTtc   = idxOf('total ctc (lpa)', 'total ctc');
    const cDec   = idxOf('decision');
    const cStat  = idxOf('hiring status', 'status');

    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r];
      const sno = (row[cSno] || '').trim();
      if (!sno || !/^\d+$/.test(sno)) continue;
      const positions = parseInt((row[cPos] || '0').trim(), 10) || 0;
      const ctc       = parseFloat((row[cCtc] || '').trim()) || 0;
      planRich.push({
        sno: parseInt(sno, 10),
        state: (row[cState] || '').trim(),
        location: (row[cLoc] || '').trim(),
        type: (row[cType] || '').trim() || 'University Partner',
        role: (row[cRole] || '').trim(),
        positions,
        ctcPerPosition: ctc,
        totalCtc: parseFloat((row[cTtc] || '').trim()) || (positions * ctc),
        decision: (row[cDec] || '').trim(),
        hiringStatus: (row[cStat] || '').trim(),
        hired: ((row[cStat] || '').trim().toLowerCase() === 'hired'),
      });
    }
  }

  return { roleStats, planRich, warnings: [] };
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

/* =============================================================
   Sheet 1 — Per-candidate template (gid=0) — kept for backward compat.
   Used when the URL points at the empty 170-column template tab.
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

/* =============================================================
   Sheet 2 — Active weekly tracker + Hiring Plan
   (unchanged from before — column-group offsets)
   ============================================================= */
const TRACKS = [
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

const PLAN_COLS = { sno: 41, state: 42, location: 43, type: 44, role: 45, positions: 46 };

export function parseTrackerSheet(csvText) {
  const rows = trim2D(parseCSV(csvText));
  if (rows.length < 2) return { activities: [], plan: [], warnings: ['Tracker sheet has no data rows.'] };

  const activities = [];
  const plan = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];

    for (const t of TRACKS) {
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
          decision: classifyDecision(status, s.stage),
          rowIndex: i,
        });
      }
    }

    const sno = (r[PLAN_COLS.sno] || '').trim();
    if (sno && /^\d+$/.test(sno)) {
      plan.push({
        sno: parseInt(sno, 10),
        state: (r[PLAN_COLS.state] || '').trim(),
        location: (r[PLAN_COLS.location] || '').trim(),
        type: (r[PLAN_COLS.type] || '').trim() || 'University Partner',
        role: (r[PLAN_COLS.role] || '').trim(),
        positions: parseInt((r[PLAN_COLS.positions] || '0').trim(), 10) || 0,
      });
    }
  }

  return { activities, plan, warnings: [] };
}

/* =============================================================
   Helpers
   ============================================================= */
export function parseFlexibleDate(s) {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  let d = new Date(t);
  if (!isNaN(d)) return d;
  const m = t.match(/^(\d{1,2})[-\s/](\w{3,9})[-\s/](\d{4})$/);
  if (m) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mi = months.indexOf(m[2].slice(0,3).toLowerCase());
    if (mi >= 0) {
      d = new Date(parseInt(m[3]), mi, parseInt(m[1]));
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
