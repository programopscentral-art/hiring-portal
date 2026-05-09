// Merge master sheet (per-candidate) with tracker sheet (per-stage activity).
// We key on candidate name (lowercased, trimmed). The tracker sheet doesn't
// have a UID, so name is the only join key available.

export function mergeData({ candidates, activities, plan, masterHeaders }) {
  const candByKey = new Map();
  for (const c of candidates) {
    const k = normName(c.__name);
    if (k) candByKey.set(k, c);
  }

  // Group activities by candidate name → list of stage events
  const eventsByCand = new Map();
  for (const a of activities) {
    const k = normName(a.name);
    if (!k) continue;
    if (!eventsByCand.has(k)) eventsByCand.set(k, []);
    eventsByCand.get(k).push(a);
  }

  // Attach events to candidates that exist in master, OR build "shadow" candidates
  // for activities whose name has no master record.
  const shadowCandidates = [];
  for (const [k, events] of eventsByCand) {
    const master = candByKey.get(k);
    if (master) {
      master.__events = events;
      master.__role = master.__role || mostCommonRole(events);
      master.__lastEvent = lastByDate(events);
    } else {
      const first = events[0];
      shadowCandidates.push({
        __id: `shadow-${k}`,
        __name: first.name,
        __role: mostCommonRole(events),
        __source: 'Unknown',
        __cycle: '',
        __events: events,
        __lastEvent: lastByDate(events),
        __isShadow: true,
      });
    }
  }

  // Make sure every master candidate has an events array
  for (const c of candidates) if (!c.__events) c.__events = [];

  return {
    candidates: candidates.concat(shadowCandidates),
    activities,
    plan,
    masterHeaders: masterHeaders || [],
  };
}

function normName(n) {
  return (n || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
}

function mostCommonRole(events) {
  const counts = {};
  for (const e of events) counts[e.role] = (counts[e.role] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function lastByDate(events) {
  return events
    .slice()
    .sort((a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0))[0];
}

// Map short tracker role codes (PMA / PM / COS) to plan role codes (PMA1 / PM1 / COS1 / BOA1)
export function trackerRoleToPlanRole(role) {
  if (!role) return '';
  if (role === 'PMA') return 'PMA1';
  if (role === 'PM')  return 'PM1';
  if (role === 'COS') return 'COS1';
  return role;
}
export function planRoleToTrackerRole(role) {
  if (!role) return '';
  if (role.startsWith('PMA')) return 'PMA';
  if (role.startsWith('PM'))  return 'PM';
  if (role.startsWith('COS')) return 'COS';
  if (role.startsWith('BOA')) return 'BOA';
  return role;
}
