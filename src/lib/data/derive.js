// Derived metrics — funnel, plan vs actual, source effectiveness, etc.

const STAGE_ORDER = [
  'Sourced',
  'Screening Form',
  'Basic Screening',
  'Recruiter Shortlist',
  'HM Shortlist',
  'TI Call',
  'Assignment',
  'Assessment',
  'Interview R1',
  'Interview R2',
  'Interview R3',
  'HR1',
  'EMPV',
  'HR2',
  'ES',
  'Salary Negotiation',
  'BGV',
  'Offer Letter',
  'Joined',
];

// ---- Plan vs Actual ----
export function computePlanProgress({ plan, candidates, activities }) {
  // Group plan rows by State + Location → role buckets
  const byLoc = new Map();
  for (const p of plan) {
    const key = `${p.state}::${p.location}`;
    if (!byLoc.has(key)) byLoc.set(key, {
      state: p.state, location: p.location, type: p.type,
      roles: {}, positions: 0, filled: 0, inPipeline: 0,
      totalCtc: 0,
    });
    const loc = byLoc.get(key);
    loc.roles[p.role] = (loc.roles[p.role] || 0) + p.positions;
    loc.positions += p.positions;
    if (p.hired) loc.filled += p.positions;
    loc.totalCtc += (p.totalCtc || 0);
  }

  // In pipeline: tracker activities with selected/hold + no joined record
  const inPipelineByRole = {};
  const seen = new Set();
  for (const a of activities) {
    const k = `${a.role}::${a.name?.toLowerCase() || ''}`;
    if (seen.has(k)) continue;
    if (a.decision === 'selected' || a.decision === 'hold' || a.decision === 'pending') {
      seen.add(k);
      inPipelineByRole[a.role] = (inPipelineByRole[a.role] || 0) + 1;
    }
  }

  return {
    locations: [...byLoc.values()],
    inPipelineByRole,
    totals: {
      positions: plan.reduce((s, p) => s + p.positions, 0),
      filled: plan.reduce((s, p) => s + (p.hired ? p.positions : 0), 0),
      totalCtc: plan.reduce((s, p) => s + (p.totalCtc || 0), 0),
      locations: byLoc.size,
      states: new Set(plan.map(p => p.state)).size,
    }
  };
}

// ---- State summary for the map ----
export function computeStateSummary({ plan, activities }) {
  const byState = new Map();
  for (const p of plan) {
    if (!byState.has(p.state)) byState.set(p.state, {
      state: p.state,
      positions: 0,
      universities: new Set(),
      roles: {},
      activitySelected: 0,
      activityRejected: 0,
      activityPending: 0,
    });
    const s = byState.get(p.state);
    s.positions += p.positions;
    s.universities.add(p.location);
    s.roles[p.role] = (s.roles[p.role] || 0) + p.positions;
  }
  return [...byState.values()].map(s => ({
    ...s,
    universities: [...s.universities],
    universityCount: s.universities.size,
  }));
}

// ---- Summary funnel from master roleStats (authoritative) ----
export function computeSummaryFunnel(roleStats) {
  if (!roleStats || !Object.keys(roleStats).length) return [];
  return Object.entries(roleStats).map(([role, s]) => ({
    role,
    stages: [
      { stage: 'Resumes',     count: s.resumesTotal    || 0 },
      { stage: 'Resume sel.', count: s.resumesSelected || 0 },
      { stage: 'R1 done',     count: s.r1Total         || 0 },
      { stage: 'R1 sel.',     count: s.r1Selected      || 0 },
      { stage: 'R2 done',     count: s.r2Total         || 0 },
      { stage: 'R2 sel.',     count: s.r2Selected      || 0 },
      { stage: 'R3 done',     count: s.r3Total         || 0 },
      { stage: 'R3 sel.',     count: s.r3Selected      || 0 },
    ].filter((x, i, a) => i < 2 || x.count > 0 || (a[i-1]?.count || 0) > 0),
  }));
}

// ---- Funnel ----
export function computeFunnel({ candidates, activities, roleStats }) {
  // We have two signals:
  //  1. Master candidates' "Current Stage" (if populated)
  //  2. Tracker activities (resume → R1 → R2 → R3) per role
  // We'll build TWO funnels and let the UI choose.

  // Master-derived stage funnel (counts unique candidates that ever reached each stage,
  // inferred by which stage columns are populated)
  const stageCounts = {};
  for (const stage of STAGE_ORDER) stageCounts[stage] = 0;
  for (const c of candidates) {
    if (c.__isShadow) continue;
    if (c.__downloaded) stageCounts['Sourced']++;
    if (c['Screening Form Filled date']) stageCounts['Screening Form']++;
    if (c['Basic Screening Call Done Date']) stageCounts['Basic Screening']++;
    if (c['Selection Status by Recruiter']) stageCounts['Recruiter Shortlist']++;
    if (c['Selection Status by HM']) stageCounts['HM Shortlist']++;
    if (c['TI Call done date']) stageCounts['TI Call']++;
    if (c['Assignment Submission status']) stageCounts['Assignment']++;
    if (c['Assessment Submission status']) stageCounts['Assessment']++;
    if (c['Interview R1 done date']) stageCounts['Interview R1']++;
    if (c['Interview R2 done date']) stageCounts['Interview R2']++;
    if (c['Interview R3 done date']) stageCounts['Interview R3']++;
    if (c['HR 1 done date']) stageCounts['HR1']++;
    if (c['Employee Verification form Submission status']) stageCounts['EMPV']++;
    if (c['HR 2 done date']) stageCounts['HR2']++;
    if (c['ES Date']) stageCounts['ES']++;
    if (c['Salary Negotiation Round Date']) stageCounts['Salary Negotiation']++;
    if (c['BGV Final Status']) stageCounts['BGV']++;
    if (c['Offer Letter Sent Date']) stageCounts['Offer Letter']++;
    if ((c.__joiningStatus || '').toLowerCase() === 'joined') stageCounts['Joined']++;
  }
  const masterFunnel = STAGE_ORDER.map(s => ({ stage: s, count: stageCounts[s] }));

  // Tracker-derived funnel (Resume → R1 → R2 → R3) per role
  const byRole = {};
  for (const a of activities) {
    if (!byRole[a.role]) byRole[a.role] = { Resume: new Set(), R1: new Set(), R2: new Set(), R3: new Set() };
    if (a.name) byRole[a.role][a.stage]?.add(a.name.toLowerCase());
  }
  const trackerFunnel = Object.entries(byRole).map(([role, stages]) => ({
    role,
    stages: ['Resume','R1','R2','R3'].map(s => ({ stage: s, count: stages[s]?.size || 0 })),
  }));

  return { masterFunnel, trackerFunnel };
}

// ---- Source effectiveness ----
export function computeSourceStats({ candidates }) {
  const map = new Map();
  for (const c of candidates) {
    if (c.__isShadow) continue;
    const src = c.__source || 'Unknown';
    if (!map.has(src)) map.set(src, { source: src, total: 0, joined: 0, inPipeline: 0, rejected: 0 });
    const s = map.get(src);
    s.total++;
    const js = (c.__joiningStatus || '').toLowerCase();
    if (js === 'joined') s.joined++;
    else if ((c.__currentStage || '').toLowerCase().includes('reject')) s.rejected++;
    else s.inPipeline++;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

// ---- Source from tracker (when master is empty) ----
export function computeTrackerSourceStats({ activities }) {
  // Fallback: count distinct candidates per role/stage (no source data in tracker)
  const byRole = {};
  for (const a of activities) {
    const k = a.name?.toLowerCase().trim();
    if (!k) continue;
    if (!byRole[a.role]) byRole[a.role] = new Set();
    byRole[a.role].add(k);
  }
  return Object.entries(byRole).map(([role, set]) => ({ source: role, total: set.size }));
}

// ---- People productivity (sourcers / panelists) ----
export function computePeopleStats({ candidates }) {
  const sourcer = new Map();
  const panelist = new Map();
  const recruiter = new Map();
  for (const c of candidates) {
    if (c.__isShadow) continue;
    const src = c.__sourcedBy;
    if (src) {
      if (!sourcer.has(src)) sourcer.set(src, { name: src, sourced: 0, joined: 0 });
      sourcer.get(src).sourced++;
      if ((c.__joiningStatus || '').toLowerCase() === 'joined') sourcer.get(src).joined++;
    }
    for (const round of ['Interview R1 Panelist', 'Interview R2 Panelist']) {
      const p = c[round];
      if (!p) continue;
      if (!panelist.has(p)) panelist.set(p, { name: p, interviews: 0, selected: 0, rejected: 0 });
      panelist.get(p).interviews++;
      const stat = (c[round.replace('Panelist', 'Status of the candidate')] || '').toLowerCase();
      if (stat.includes('select')) panelist.get(p).selected++;
      else if (stat.includes('reject')) panelist.get(p).rejected++;
    }
  }
  return {
    sourcers: [...sourcer.values()].sort((a, b) => b.sourced - a.sourced),
    panelists: [...panelist.values()].sort((a, b) => b.interviews - a.interviews),
    recruiters: [...recruiter.values()],
  };
}

// ---- Tracker-based people productivity (fallback) ----
export function computeTrackerPanelistStats({ activities, candidates }) {
  // Tracker doesn't name panelists per row, but it shows who reviewed at each stage
  // (the "Name" cell at R1/R2/R3 is the candidate, not the panelist) — so fall back to
  // counting per-role event volume and outcomes.
  const byRole = {};
  for (const a of activities) {
    if (a.stage === 'Resume') continue;
    if (!byRole[a.role]) byRole[a.role] = { role: a.role, conducted: 0, selected: 0, rejected: 0, hold: 0 };
    byRole[a.role].conducted++;
    if (a.decision === 'selected') byRole[a.role].selected++;
    else if (a.decision === 'rejected') byRole[a.role].rejected++;
    else if (a.decision === 'hold') byRole[a.role].hold++;
  }
  return Object.values(byRole);
}

// ---- Time-series / trends ----
export function computeMonthlyTrend({ activities, candidates }) {
  const months = new Map();
  const bump = (d, key) => {
    if (!d || isNaN(d)) return;
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months.has(m)) months.set(m, { month: m, sourced: 0, interviewed: 0, selected: 0, joined: 0 });
    months.get(m)[key]++;
  };
  for (const a of activities) {
    if (!a.parsedDate) continue;
    if (a.stage !== 'Resume') bump(a.parsedDate, 'interviewed');
    if (a.decision === 'selected') bump(a.parsedDate, 'selected');
  }
  for (const c of candidates) {
    if (c.__isShadow) continue;
    bump(parseDate(c.__downloaded), 'sourced');
    if ((c.__joiningStatus || '').toLowerCase() === 'joined') bump(parseDate(c.__joinDate), 'joined');
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// ---- SLA / aging queues (master sheet) ----
export function computeQueues({ candidates, today = new Date() }) {
  const queues = {
    awaitingScreening: [],
    assignmentOverdue: [],
    awaitingR1: [],
    awaitingHR2: [],
    bgvInProgress: [],
    awaitingJoining: [],
  };
  for (const c of candidates) {
    if (c.__isShadow) continue;
    const stage = (c.__currentStage || '').toLowerCase();
    if (c['Screening Form Sent Status'] && !c['Screening Form Filled date']) queues.awaitingScreening.push(c);
    if (c['Assignment Sent date'] && !c['Assignment submission date']) {
      const sent = parseDate(c['Assignment Sent date']);
      if (sent && (today - sent) / 86400000 > 5) queues.assignmentOverdue.push(c);
    }
    if (c['Interview R1 scheduling done date'] && !c['Interview R1 done date']) queues.awaitingR1.push(c);
    if (c['HR 2 scheduling done date'] && !c['HR 2 done date']) queues.awaitingHR2.push(c);
    if (c['BGV Initiation Date'] && !c['BGV Final Status']) queues.bgvInProgress.push(c);
    if (c['Offer Letter Signed Status'] && !c['Date of Joining']) queues.awaitingJoining.push(c);
  }
  return queues;
}

// ---- Recent activity feed ----
export function computeRecentActivity({ activities, limit = 30 }) {
  return activities
    .filter(a => a.parsedDate)
    .sort((a, b) => b.parsedDate - a.parsedDate)
    .slice(0, limit);
}

// ---- Drop-off analysis ----
export function computeDropoff({ trackerFunnel }) {
  return trackerFunnel.map(t => {
    const drops = [];
    for (let i = 0; i < t.stages.length - 1; i++) {
      const a = t.stages[i].count, b = t.stages[i + 1].count;
      drops.push({
        from: t.stages[i].stage,
        to: t.stages[i + 1].stage,
        absDrop: a - b,
        pctDrop: a ? Math.round(((a - b) / a) * 100) : 0,
        carryPct: a ? Math.round((b / a) * 100) : 0,
      });
    }
    return { role: t.role, drops };
  });
}

export { STAGE_ORDER };
