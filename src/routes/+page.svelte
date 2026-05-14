<script>
  import { base } from '$app/paths';
  import Donut from '$lib/components/Donut.svelte';
  import MonthlyBarChart from '$lib/components/MonthlyBarChart.svelte';
  import RoleStackedFunnel from '$lib/components/RoleStackedFunnel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import {
    dataset, kpis, funnel, stageMatrix, roleStats, monthlyVolume, byState,
    bySource, recentActivity, syncState, planByRole, planByState, planByUniversity,
    STAGES, ROLES,
  } from '$lib/data/stores.js';

  function fmt(n) { return (n || 0).toLocaleString(); }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

  // ---------- Derived narratives ----------
  $: totalPlanned = $planByState.reduce((s, x) => s + x.positions, 0);
  $: totalPlanHired = $planByState.reduce((s, x) => s + x.hired, 0);

  $: stackedStages = STAGES.map(s => ({
    ...s,
    byRole: Object.fromEntries(ROLES.map(r => [r, $stageMatrix[r]?.[s.key] || 0])),
  }));

  $: decisionSegments = [
    { label: 'Active in pipeline', value: $kpis.active,   color: 'var(--brand)' },
    { label: 'Hired (selected at R3)', value: $kpis.hired,    color: 'var(--olive)' },
    { label: 'Rejected',           value: $kpis.rejected, color: 'var(--bad)' },
  ];

  // Top role by application volume
  $: topRole = ROLES.reduce((best, r) => {
    const s = $roleStats[r] || { total: 0 };
    return s.total > (best?.total || 0) ? { role: r, ...s } : best;
  }, null);

  // Stage with biggest drop
  $: biggestDrop = (() => {
    let worst = null;
    for (let i = 1; i < $funnel.length; i++) {
      const prev = $funnel[i - 1].count;
      const cur = $funnel[i].count;
      if (prev > 0) {
        const lost = prev - cur;
        const lossPct = lost / prev;
        if (!worst || lossPct > worst.lossPct) {
          worst = { stage: $funnel[i].label, prev, cur, lost, lossPct };
        }
      }
    }
    return worst;
  })();

  // Best-performing source (by hire rate ≥ 5 applications)
  $: bestSource = $bySource
    .filter(s => s.total >= 5)
    .map(s => ({ ...s, rate: s.total ? s.hired / s.total : 0 }))
    .sort((a, b) => b.rate - a.rate)[0];

  // Hired candidates list for celebration card
  $: hiredCandidates = $dataset.candidates
    .filter(c => c.finalDecision === 'hired')
    .slice(0, 8);

  // Average days from application to R3 selection
  $: avgDaysToHire = (() => {
    const xs = hiredCandidates
      .map(c => {
        const start = c.application?.timestampDate || c.timestampDate;
        const end = c.stages?.r3?.parsedDate || c.stages?.hired?.parsedDate;
        if (!start || !end) return null;
        return Math.round((end - start) / 86400000);
      })
      .filter(x => x != null && x >= 0);
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  })();

  // Active universities (those with at least one planned position)
  $: topPlanUnis = $planByUniversity.slice(0, 6);

  // Top 5 states by planned positions
  $: topStatesByPlan = $planByState.slice(0, 6);
</script>

<svelte:head><title>Overview · ProgramOps Hiring</title></svelte:head>

<!-- HERO -->
<header class="hero fade-up">
  <div class="hero-text">
    <div class="crumb">Quarterly hiring review · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
    <h1 class="serif hero-title">
      We are hiring <span class="hl">{fmt(totalPlanned)}</span> people across
      <span class="hl">{$planByState.length}</span> states and
      <span class="hl">{$planByUniversity.length}</span> university partners.
    </h1>
    <p class="hero-sub">
      The pipeline currently holds <strong>{fmt($kpis.total)}</strong> candidates across
      <strong>{ROLES.length}</strong> roles ({ROLES.join(' · ')}).
      <strong class="ok">{fmt($kpis.hired)}</strong> have cleared all interview rounds and
      <strong>{fmt($kpis.finals)}</strong> are in final stages.
      {#if $syncState.status === 'ok'}
        <span class="muted">· Last synced just now.</span>
      {/if}
    </p>
  </div>

  <div class="hero-kpis">
    <div class="hk">
      <div class="hk-lbl">Applied</div>
      <div class="hk-val display">{fmt($kpis.total)}</div>
      <div class="hk-sub">{fmt($kpis.thisMonth)} this month</div>
    </div>
    <div class="hk hk-brand">
      <div class="hk-lbl">Active</div>
      <div class="hk-val display">{fmt($kpis.active)}</div>
      <div class="hk-sub">{pct($kpis.active, $kpis.total)}% of pool</div>
    </div>
    <div class="hk hk-olive">
      <div class="hk-lbl">Hired</div>
      <div class="hk-val display">{fmt($kpis.hired)}</div>
      <div class="hk-sub">{fmt(totalPlanned - $kpis.hired)} positions open</div>
    </div>
    <div class="hk hk-mauve">
      <div class="hk-lbl">In final</div>
      <div class="hk-val display">{fmt($kpis.finals)}</div>
      <div class="hk-sub">past R2</div>
    </div>
  </div>
</header>

<!-- CARD 1: Pipeline health -->
<section class="card pad-lg story fade-up">
  <div class="story-grid">
    <div class="story-text">
      <div class="card-tag">Pipeline health</div>
      <h2 class="serif card-title">How candidates move through the funnel</h2>
      <p class="card-body">
        Of the <strong>{fmt($kpis.total)}</strong> applicants we received,
        <strong>{fmt($funnel.find(f => f.key === 'resumeShortlist')?.count || 0)}</strong>
        cleared resume shortlisting ({pct($funnel.find(f => f.key === 'resumeShortlist')?.count || 0, $kpis.total)}%),
        <strong>{fmt($funnel.find(f => f.key === 'r1')?.count || 0)}</strong> reached R1,
        <strong>{fmt($funnel.find(f => f.key === 'r2')?.count || 0)}</strong> reached R2,
        and <strong>{fmt($funnel.find(f => f.key === 'r3')?.count || 0)}</strong> reached R3.
      </p>
      {#if biggestDrop}
        <p class="card-body insight">
          <strong class="bad-text">⚠ Biggest drop:</strong>
          {biggestDrop.lost.toLocaleString()} candidates dropped at
          <strong>{biggestDrop.stage}</strong>
          ({Math.round(biggestDrop.lossPct * 100)}% of {biggestDrop.prev.toLocaleString()}).
          This is the stage that most rewards investment in better screening or candidate experience.
        </p>
      {/if}
      <a class="card-cta" href="{base}/pipeline">Open Pipeline →</a>
    </div>
    <div class="story-viz">
      {#if stackedStages.length}
        <RoleStackedFunnel stages={stackedStages} />
      {:else}
        <EmptyState title="Waiting for data." />
      {/if}
    </div>
  </div>
</section>

<!-- CARD 2: Decision split + per-role -->
<section class="card pad-lg story fade-up">
  <div class="story-grid">
    <div class="story-text">
      <div class="card-tag">Outcome split</div>
      <h2 class="serif card-title">{pct($kpis.active, $kpis.total)}% of candidates are still active</h2>
      <p class="card-body">
        We have <strong class="ok-text">{fmt($kpis.active)} active candidates</strong> across the pipeline,
        <strong class="brand-text">{fmt($kpis.hired)} hired</strong>, and
        <strong class="bad-text">{fmt($kpis.rejected)} rejected</strong>.
        Across roles, <strong>{topRole?.role}</strong> drew the largest applicant pool with
        <strong>{fmt(topRole?.total)}</strong> applications.
        {#if avgDaysToHire != null}
          On average, a hired candidate moves from application to R3 selection in
          <strong>{avgDaysToHire} days</strong>.
        {/if}
      </p>
      <a class="card-cta" href="{base}/candidates">Browse all candidates →</a>
    </div>
    <div class="story-viz" style="display:flex;justify-content:center">
      {#if $kpis.total}
        <Donut segments={decisionSegments} centerValue={fmt($kpis.total)} centerLabel="candidates" size={200} stroke={32} />
      {/if}
    </div>
  </div>
</section>

<!-- CARD 3: Per-role drilldown -->
<section class="card pad-lg story fade-up">
  <div class="card-tag">Per-role performance</div>
  <h2 class="serif card-title">Where each role stands today</h2>
  <p class="card-body" style="max-width:780px">
    The four open roles are at different stages of maturity.
    {#each ROLES as r}
      {@const s = $roleStats[r] || { total: 0, active: 0, hired: 0 }}
      {@const planned = $planByRole[r]?.positions || 0}
      <strong>{r}</strong> has <strong>{fmt(s.total)}</strong> applicants and
      <strong>{fmt(planned)}</strong> planned positions{r === ROLES[ROLES.length - 1] ? '.' : '; '}
    {/each}
  </p>

  <div class="role-deck">
    {#each ROLES as r}
      {@const s = $roleStats[r] || { total: 0, active: 0, hired: 0, rejected: 0 }}
      {@const planned = $planByRole[r]?.positions || 0}
      {@const fillRate = planned ? s.hired / planned : 0}
      <a class="role-tile" href="{base}/roles/{r}">
        <div class="rt-head">
          <div class="rt-pill {r.toLowerCase()}">{r}</div>
          <div class="rt-fill">
            <div class="rt-fill-num display">{fmt(s.hired)}<span class="muted">/{fmt(planned)}</span></div>
            <div class="rt-fill-lbl">hired / planned</div>
          </div>
        </div>
        <div class="rt-bar">
          <div class="rt-bar-fill" style="width:{Math.min(100, fillRate * 100)}%"></div>
        </div>
        <dl class="rt-stats">
          <dt>Applied</dt><dd class="mono">{fmt(s.total)}</dd>
          <dt>Active</dt><dd class="mono ok-text">{fmt(s.active)}</dd>
          <dt>Rejected</dt><dd class="mono bad-text">{fmt(s.rejected)}</dd>
          <dt>Fill rate</dt><dd class="mono">{Math.round(fillRate * 100)}%</dd>
        </dl>
        <div class="rt-cta">Drill in →</div>
      </a>
    {/each}
  </div>
</section>

<!-- CARD 4: Geographic footprint -->
<section class="card pad-lg story fade-up">
  <div class="story-grid">
    <div class="story-text">
      <div class="card-tag">Geographic footprint</div>
      <h2 class="serif card-title">{$planByState.length} states · {$planByUniversity.length} universities</h2>
      <p class="card-body">
        The plan concentrates in
        {#each topStatesByPlan.slice(0, 3) as st, i}
          <strong>{st.state}</strong> ({fmt(st.positions)} positions, {st.universities.length} unis){i < 2 ? ', ' : ''}
        {/each}
        which together represent
        <strong>{Math.round(topStatesByPlan.slice(0, 3).reduce((s, x) => s + x.positions, 0) / totalPlanned * 100)}%</strong>
        of all planned positions.
        Candidates are coming in primarily from <strong>{$byState[0]?.state || '—'}</strong>
        ({fmt($byState[0]?.total || 0)} applicants).
      </p>
      <a class="card-cta" href="{base}/locations">View location map →</a>
    </div>
    <div class="story-viz">
      <div class="state-bars">
        {#each topStatesByPlan as st}
          {@const pctBar = st.positions / topStatesByPlan[0].positions}
          <a class="sb-row" href="{base}/locations/{encodeURIComponent(st.state)}">
            <div class="sb-name">{st.state}</div>
            <div class="sb-bar"><div class="sb-fill" style="width:{Math.max(8, pctBar * 100)}%"></div></div>
            <div class="sb-meta">
              <span class="mono"><strong>{fmt(st.positions)}</strong> planned</span>
              <span class="muted small">{st.universities.length} unis</span>
            </div>
          </a>
        {/each}
      </div>
    </div>
  </div>
</section>

<!-- CARD 5: University partners -->
<section class="card pad-lg story fade-up">
  <div class="card-tag">University partners</div>
  <h2 class="serif card-title">Top universities by planned positions</h2>
  <p class="card-body" style="max-width:780px">
    These are the 6 universities with the largest hiring plan.
    Combined, they account for <strong>{topPlanUnis.reduce((s, x) => s + x.positions, 0)}</strong>
    planned positions ({Math.round(topPlanUnis.reduce((s, x) => s + x.positions, 0) / totalPlanned * 100)}% of total).
  </p>
  <div class="uni-deck">
    {#each topPlanUnis as u}
      <a class="uni-card" href="{base}/locations/{encodeURIComponent(u.state)}">
        <div class="uni-head">
          <div class="uni-name">{u.university}</div>
          <div class="uni-state muted">{u.state}</div>
        </div>
        <div class="uni-stat">
          <span class="display">{fmt(u.positions)}</span>
          <span class="muted small">positions</span>
        </div>
        <div class="uni-roles">
          {#each Object.entries(u.roles) as [r, n]}
            <span class="role-mini {r.toLowerCase()}">{r}·{n}</span>
          {/each}
        </div>
        {#if u.hired}
          <div class="uni-hired ok-text">{u.hired} hired</div>
        {:else}
          <div class="uni-hired muted">No hires yet</div>
        {/if}
      </a>
    {/each}
  </div>
  <a class="card-cta" href="{base}/locations" style="margin-top:14px;display:inline-block">All {$planByUniversity.length} universities →</a>
</section>

<!-- CARD 6: Recent hires (celebration) -->
{#if hiredCandidates.length}
  <section class="card pad-lg story fade-up celebrate">
    <div class="card-tag ok-text">🎉 Recent selections</div>
    <h2 class="serif card-title">{fmt($kpis.hired)} candidates cleared all rounds</h2>
    <p class="card-body" style="max-width:780px">
      Below are candidates who were marked Selected in their final interview round.
      They represent the closest signal to a confirmed hire in the current dataset
      (downstream HR1+ stages don't yet have populated records).
    </p>
    <div class="hire-deck">
      {#each hiredCandidates as c}
        <a class="hire-card" href="{base}/candidates/{encodeURIComponent(c.nameKey)}">
          <div class="hire-avatar">{(c.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}</div>
          <div class="hire-info">
            <div class="hire-name">{c.name}</div>
            <div class="hire-meta">
              <span class="role-mini {(c.role || 'pm').toLowerCase()}">{c.role || '?'}</span>
              {#if c.stages?.r3?.parsedDate}
                <span class="muted small">{c.stages.r3.parsedDate.toLocaleDateString()}</span>
              {/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  </section>
{/if}

<!-- CARD 7: Application volume -->
{#if $monthlyVolume.length}
  <section class="card pad-lg story fade-up">
    <div class="story-grid">
      <div class="story-text">
        <div class="card-tag">Application velocity</div>
        <h2 class="serif card-title">Volume over time</h2>
        <p class="card-body">
          {fmt($kpis.thisMonth)} new applications this month.
          {#if $monthlyVolume.length >= 2}
            {@const last = $monthlyVolume[$monthlyVolume.length - 1].total}
            {@const prev = $monthlyVolume[$monthlyVolume.length - 2].total}
            {#if prev}
              That's a <strong class={last >= prev ? 'ok-text' : 'bad-text'}>{last >= prev ? '+' : ''}{Math.round(((last - prev) / prev) * 100)}%</strong> change vs last month.
            {/if}
          {/if}
        </p>
      </div>
      <div class="story-viz">
        <MonthlyBarChart
          data={$monthlyVolume}
          series={[
            { key: 'PMA', label: 'PMA', color: 'var(--brand)' },
            { key: 'PM',  label: 'PM',  color: 'var(--mauve)' },
            { key: 'COS', label: 'COS', color: 'var(--olive)' },
            { key: 'BOA', label: 'BOA', color: 'var(--gold, #C49A47)' },
          ]}
        />
      </div>
    </div>
  </section>
{/if}

<!-- CARD 8: Recent activity feed -->
{#if $recentActivity.length}
  <section class="card pad-lg story fade-up">
    <div class="card-tag">Recent activity</div>
    <h2 class="serif card-title">Latest interview events</h2>
    <p class="card-body" style="max-width:780px">
      The 12 most recent stage events across all candidates and roles.
    </p>
    <div class="feed">
      {#each $recentActivity.slice(0, 12) as ev}
        <a class="feed-row" href="{base}/candidates/{encodeURIComponent(ev.nameKey)}">
          <div class="feed-date mono">{ev.parsedDate?.toLocaleDateString() || '—'}</div>
          <div class="feed-stage">{STAGES.find(s => s.key === ev.stage)?.short || ev.stage.toUpperCase()}</div>
          <div class="feed-name">{ev.name}</div>
          {#if ev.role}<div><span class="role-mini {ev.role.toLowerCase()}">{ev.role}</span></div>{:else}<div></div>{/if}
          <StatusPill decision={ev.decision || 'pending'} />
        </a>
      {/each}
    </div>
    <a class="card-cta" href="{base}/insights" style="margin-top:14px;display:inline-block">Full insights →</a>
  </section>
{/if}

<style>
  /* HERO */
  .hero {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 32px;
    align-items: center;
    padding: 32px 0 28px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 28px;
  }
  @media (max-width: 1000px) { .hero { grid-template-columns: 1fr; } }
  .hero-title {
    font-size: 44px;
    line-height: 1.1;
    letter-spacing: -0.025em;
    margin: 8px 0 16px;
    color: var(--ink);
  }
  @media (max-width: 700px) { .hero-title { font-size: 30px; } }
  .hero-title .hl {
    color: var(--brand);
    font-weight: 600;
  }
  .hero-sub { font-size: 15px; line-height: 1.6; color: var(--ink-2); max-width: 640px; }
  .hero-sub strong { color: var(--ink); font-weight: 700; }
  .hero-sub .ok { color: var(--ok); }

  .hero-kpis {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .hk {
    padding: 18px;
    border-radius: var(--r-md);
    background: var(--surface);
    border: 1px solid var(--line);
    transition: all var(--t-fast) var(--ease);
  }
  .hk:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
  .hk-brand { background: var(--brand); color: #fff; border-color: var(--brand-deep); }
  .hk-olive { background: var(--olive); color: #fff; border-color: #4A5634; }
  .hk-mauve { background: var(--mauve); color: #fff; border-color: var(--mauve-deep); }
  .hk-lbl {
    font-size: 10.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .1em;
    opacity: .8;
  }
  .hk-val { font-size: 36px; line-height: 1.05; margin: 6px 0 4px; }
  .hk-sub { font-size: 11px; opacity: .75; font-weight: 600; }

  /* STORY CARDS */
  .story {
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
  }
  .story-grid {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 32px;
    align-items: center;
  }
  @media (max-width: 1000px) { .story-grid { grid-template-columns: 1fr; gap: 20px; } }
  .card-tag {
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .12em;
    color: var(--brand);
    margin-bottom: 8px;
  }
  .card-title {
    font-size: 28px;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: var(--ink);
    margin: 0 0 14px;
    max-width: 600px;
  }
  .card-body {
    font-size: 14px;
    line-height: 1.7;
    color: var(--ink-2);
    margin: 0 0 14px;
  }
  .card-body strong { color: var(--ink); font-weight: 700; }
  .card-body.insight {
    padding: 12px 14px;
    background: var(--surface-soft);
    border-left: 3px solid var(--brand);
    border-radius: 4px;
    margin-top: 10px;
  }
  .card-cta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 700;
    color: var(--brand-deep);
    margin-top: 4px;
  }
  .card-cta:hover { color: var(--brand); }
  .ok-text { color: var(--ok); }
  .brand-text { color: var(--brand); }
  .bad-text { color: var(--bad); }
  .small { font-size: 11.5px; }

  /* Role tiles */
  .role-deck {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 8px;
  }
  @media (max-width: 1100px) { .role-deck { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 600px) { .role-deck { grid-template-columns: 1fr; } }
  .role-tile {
    padding: 18px;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--surface);
    transition: all var(--t-fast) var(--ease);
    display: flex; flex-direction: column;
  }
  .role-tile:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--brand); }
  .rt-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .rt-pill {
    width: 44px; height: 44px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 12px; color: #fff;
  }
  .rt-pill.pma { background: var(--brand); }
  .rt-pill.pm  { background: var(--mauve); }
  .rt-pill.cos { background: var(--olive); }
  .rt-pill.boa { background: var(--gold, #C49A47); }
  .rt-fill { text-align: right; }
  .rt-fill-num { font-size: 22px; font-weight: 700; line-height: 1; }
  .rt-fill-num .muted { color: var(--ink-3); font-size: 14px; }
  .rt-fill-lbl { font-size: 10px; color: var(--ink-3); font-weight: 600; text-transform: uppercase; margin-top: 4px; }
  .rt-bar { height: 6px; background: var(--surface-sunk); border-radius: 3px; overflow: hidden; margin-bottom: 14px; }
  .rt-bar-fill { height: 100%; background: linear-gradient(90deg, var(--olive), #4A5634); }
  .rt-stats {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 12px;
    margin: 0 0 12px;
    font-size: 12px;
  }
  .rt-stats dt { color: var(--ink-3); font-weight: 600; }
  .rt-stats dd { margin: 0; text-align: right; font-weight: 700; color: var(--ink); }
  .rt-cta { margin-top: auto; font-size: 12px; font-weight: 700; color: var(--brand-deep); }

  /* State bars */
  .state-bars { display: flex; flex-direction: column; gap: 8px; }
  .sb-row {
    display: grid;
    grid-template-columns: 120px 1fr 140px;
    gap: 12px;
    align-items: center;
    padding: 8px 12px;
    border-radius: var(--r-sm);
    transition: background var(--t-fast) var(--ease);
  }
  .sb-row:hover { background: var(--surface-soft); }
  .sb-name { font-size: 13px; font-weight: 700; color: var(--ink); }
  .sb-bar { height: 12px; background: var(--surface-sunk); border-radius: 6px; overflow: hidden; }
  .sb-fill { height: 100%; background: linear-gradient(90deg, var(--gold, #C49A47), #8E6B36); }
  .sb-meta { text-align: right; display: flex; flex-direction: column; gap: 2px; }
  .sb-meta .mono { font-size: 12px; color: var(--ink); }
  .sb-meta .small { font-size: 10.5px; }

  /* University deck */
  .uni-deck {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 12px;
  }
  @media (max-width: 1000px) { .uni-deck { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 600px) { .uni-deck { grid-template-columns: 1fr; } }
  .uni-card {
    padding: 18px;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--surface);
    transition: all var(--t-fast) var(--ease);
  }
  .uni-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); border-color: var(--brand); }
  .uni-head { margin-bottom: 12px; }
  .uni-name { font-size: 15px; font-weight: 700; color: var(--ink); line-height: 1.3; }
  .uni-state { font-size: 11px; margin-top: 2px; }
  .uni-stat { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
  .uni-stat .display { font-size: 28px; line-height: 1; color: var(--brand); }
  .uni-roles { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
  .uni-hired { font-size: 12px; font-weight: 700; }
  .role-mini {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 800;
    color: #fff;
    letter-spacing: .02em;
  }
  .role-mini.pma { background: var(--brand); }
  .role-mini.pm  { background: var(--mauve); }
  .role-mini.cos { background: var(--olive); }
  .role-mini.boa { background: var(--gold, #C49A47); }

  /* Hire deck */
  .celebrate { background: linear-gradient(135deg, var(--ok-soft) 0%, var(--surface) 60%); }
  .hire-deck {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
  }
  @media (max-width: 1000px) { .hire-deck { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .hire-card {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    transition: all var(--t-fast) var(--ease);
  }
  .hire-card:hover { transform: translateY(-2px); border-color: var(--ok); }
  .hire-avatar {
    width: 44px; height: 44px;
    border-radius: 50%;
    background: var(--ok);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 14px;
    flex-shrink: 0;
  }
  .hire-info { min-width: 0; flex: 1; }
  .hire-name { font-size: 13px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hire-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; }

  /* Feed */
  .feed { display: flex; flex-direction: column; gap: 2px; margin-top: 12px; }
  .feed-row {
    display: grid;
    grid-template-columns: 100px 60px 1fr 60px 100px;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: var(--r-sm);
    font-size: 13px;
    transition: background var(--t-fast) var(--ease);
  }
  .feed-row:hover { background: var(--surface-soft); }
  .feed-date { font-size: 11px; color: var(--ink-3); }
  .feed-stage {
    font-size: 10px; font-weight: 800;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--brand-soft);
    color: var(--brand-deep);
    text-align: center;
  }
  .feed-name { font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
