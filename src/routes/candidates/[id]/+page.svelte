<script>
  import { page } from '$app/stores';
  import { data } from '$lib/data/stores.js';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import { base } from '$app/paths';

  $: id = decodeURIComponent($page.params.id);
  $: candidate = $data.candidates.find(c => c.__id === id);

  // Pretty timeline events from the master sheet's many date columns
  const TIMELINE_FIELDS = [
    { date: 'Downloaded date', stage: 'Sourced', extra: ['Source Name', 'Sourcing done by'] },
    { date: 'Screening Form Sent Date', stage: 'Screening Form Sent', extra: [] },
    { date: 'Screening Form Filled date', stage: 'Screening Form Filled', extra: [] },
    { date: 'Basic Screening Call Done Date', stage: 'Basic Screening Call', extra: ['Basic Screening Call Done by', 'Basic Screening Call Remarks'] },
    { date: 'Shortlisting Done Date', stage: 'Recruiter Shortlist', extra: ['Selection Status by Recruiter'] },
    { date: 'TI Call done date', stage: 'TI Call', extra: ['TI Call done by', 'TI remarks'] },
    { date: 'Assignment Sent date', stage: 'Assignment Sent', extra: [] },
    { date: 'Assignment submission date', stage: 'Assignment Submitted', extra: [] },
    { date: 'Assignment Evaluation status updated date', stage: 'Assignment Evaluated', extra: ['Assignment Evaluation status', 'Assignment Evaluation done by'] },
    { date: 'Assessment Sent date', stage: 'Assessment Sent', extra: [] },
    { date: 'Assessment submission date', stage: 'Assessment Submitted', extra: [] },
    { date: 'Interview R1 done date', stage: 'Interview R1', extra: ['Interview R1 Panelist', 'Interview R1 Status of the candidate', 'Interview R1 Remarks'] },
    { date: 'Interview R2 done date', stage: 'Interview R2', extra: ['Interview R2 Panelist', 'Interview R2 Status of the candidate', 'Interview R2 Remarks'] },
    { date: 'Interview R3 done date', stage: 'Interview R3', extra: ['Interview R3 done by', 'Interview 3 Status of the Candidate', 'Interview R3 Remarks'] },
    { date: 'HR 1 done date', stage: 'HR Round 1', extra: ['HR 1 Status', 'HR 1 Remarks'] },
    { date: 'Selection mail sent date', stage: 'Selection Mail Sent', extra: ['Selection mail sent by'] },
    { date: 'Employee Verification form sent date', stage: 'EMPV Form Sent', extra: [] },
    { date: 'Employee Verification form Submission date', stage: 'EMPV Form Submitted', extra: ['EMPV Form Validation Status'] },
    { date: 'HR 2 done date', stage: 'HR Round 2', extra: ['HR 2 Status', 'HR 2 Remarks'] },
    { date: 'ES Date', stage: 'ES Round', extra: ['ES Panelist Name', 'ES Status', 'ES Remarks'] },
    { date: 'Salary Negotiation Round Date', stage: 'Salary Negotiation', extra: ['Salary negotiation round status', 'Salary negotiation Remarks'] },
    { date: 'BGV Initiation Date', stage: 'BGV Initiated', extra: ['BGV Status'] },
    { date: 'BGV Final Status updated data', stage: 'BGV Completed', extra: ['BGV Final Status'] },
    { date: 'Offer Letter Sent Date', stage: 'Offer Sent', extra: ['Offer Letter Status', 'Offer Letter Signed Status'] },
    { date: 'Date of Joining', stage: 'Joined', extra: ['Joining Status'] },
  ];

  function timelineFor(c) {
    if (!c) return [];
    const events = [];
    // Master timeline (only for non-shadow candidates)
    if (!c.__isShadow) {
      for (const f of TIMELINE_FIELDS) {
        const d = c[f.date];
        if (!d) continue;
        events.push({
          stage: f.stage,
          date: d,
          parsed: parseDate(d),
          details: f.extra.map(k => ({ k, v: c[k] })).filter(p => p.v),
          source: 'master',
        });
      }
    }
    // Tracker events
    for (const e of (c.__events || [])) {
      events.push({
        stage: `${e.role} · ${e.stage}`,
        date: e.date,
        parsed: e.parsedDate,
        details: e.status ? [{ k: 'Status', v: e.status }] : [],
        source: 'tracker',
        decision: e.decision,
      });
    }
    return events
      .sort((a, b) => (a.parsed?.getTime() || 0) - (b.parsed?.getTime() || 0));
  }

  function parseDate(s) { const d = new Date(s); return isNaN(d) ? null : d; }

  $: events = timelineFor(candidate);
</script>

<svelte:head><title>{candidate?.__name || 'Candidate'} · Hiring Portal</title></svelte:head>

<a href="{base}/candidates" class="btn ghost sm" style="margin-bottom:18px">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15 18l-6-6 6-6"/></svg>
  All candidates
</a>

{#if !candidate}
  <div class="card" style="padding:48px;text-align:center">
    <div class="serif" style="font-size:22px">Candidate not found.</div>
    <div class="muted" style="margin-top:6px">This UID may have been removed or never existed.</div>
  </div>
{:else}

  <section class="hero card fade-up" style="padding:32px;display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap">
    <div class="big-avatar">
      {candidate.__name?.split(' ').filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase() || '?'}
    </div>
    <div class="grow">
      <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.1em">{candidate.__cycle || 'Candidate'}</div>
      <h1 class="serif" style="font-size:32px;margin-top:4px">{candidate.__name}</h1>
      <div class="row gap" style="margin-top:8px;flex-wrap:wrap">
        {#if candidate.__role}<span class="pill brand">{candidate.__role}</span>{/if}
        {#if candidate.__source}<span class="pill">{candidate.__source}</span>{/if}
        {#if candidate.__currentStage}<span class="pill outline">{candidate.__currentStage}</span>{/if}
        {#if candidate.__joiningStatus}
          <span class="pill {candidate.__joiningStatus.toLowerCase() === 'joined' ? 'ok' : 'warn'}">{candidate.__joiningStatus}</span>
        {/if}
      </div>
    </div>
    <div class="contacts">
      {#if candidate.__phone}<div class="contact-row"><span class="muted">Phone</span><span class="mono">{candidate.__phone}</span></div>{/if}
      {#if candidate.__email}<div class="contact-row"><span class="muted">Email</span><span class="mono">{candidate.__email}</span></div>{/if}
      {#if candidate.__sourcedBy}<div class="contact-row"><span class="muted">Sourcer</span><span>{candidate.__sourcedBy}</span></div>{/if}
      {#if candidate.__resumeLink}<div class="contact-row"><a class="btn sm" href={candidate.__resumeLink} target="_blank" rel="noopener">↗ Resume</a></div>{/if}
      {#if candidate.__linkedIn}<div class="contact-row"><a class="btn sm" href={candidate.__linkedIn} target="_blank" rel="noopener">↗ LinkedIn</a></div>{/if}
    </div>
  </section>

  <section class="split" style="margin-top:20px">
    <div class="card" style="padding:24px">
      <div class="section-h"><div class="title"><h2>Timeline</h2><span class="count">{events.length} events</span></div></div>
      <div class="tl">
        {#each events as e, i (i + e.stage)}
          <div class="tl-row" in:fly={{ x: -8, delay: i * 30, duration: 360, easing: quintOut }}>
            <div class="tl-axis">
              <div class="tl-dot {e.decision || ''}"></div>
              {#if i < events.length - 1}<div class="tl-line"></div>{/if}
            </div>
            <div class="tl-body">
              <div class="row between" style="gap:8px">
                <strong style="font-weight:600">{e.stage}</strong>
                <span class="muted mono" style="font-size:11px">{e.parsed?.toLocaleDateString() || e.date}</span>
              </div>
              {#if e.details?.length}
                <div class="tl-details">
                  {#each e.details as d}
                    <div class="dl"><span class="muted">{d.k}</span><span>{d.v}</span></div>
                  {/each}
                </div>
              {/if}
              <span class="pill outline" style="font-size:10px;margin-top:6px">{e.source}</span>
            </div>
          </div>
        {:else}
          <div class="empty">No timeline events recorded yet.</div>
        {/each}
      </div>
    </div>

    <div class="col gap" style="gap:16px">
      <div class="card pad">
        <div class="muted" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.08em">Snapshot</div>
        <div class="serif" style="font-size:20px;margin:6px 0 12px">Quick facts</div>
        <div class="kv">
          <div class="muted">UID</div><div class="mono">{candidate.UID || candidate.__id}</div>
          <div class="muted">Cycle</div><div>{candidate.__cycle || '—'}</div>
          <div class="muted">Source</div><div>{candidate.__source || '—'}</div>
          <div class="muted">Sourced by</div><div>{candidate.__sourcedBy || '—'}</div>
          <div class="muted">Downloaded</div><div>{candidate.__downloaded || '—'}</div>
          <div class="muted">Joining date</div><div>{candidate.__joinDate || '—'}</div>
        </div>
      </div>

      {#if !candidate.__isShadow}
        <details class="card" style="padding:20px">
          <summary style="cursor:pointer;font-family:var(--font-serif);font-size:18px;list-style:none">All fields</summary>
          <div class="raw" style="margin-top:12px">
            {#each Object.entries(candidate).filter(([k,v]) => !k.startsWith('__') && v) as [k, v]}
              <div class="kv-row">
                <span class="muted">{k}</span>
                <span>{v}</span>
              </div>
            {/each}
          </div>
        </details>
      {/if}
    </div>
  </section>

{/if}

<style>
  .big-avatar {
    width: 96px; height: 96px;
    border-radius: 28px;
    background: linear-gradient(135deg, var(--brand-soft), var(--gold-soft));
    color: var(--brand-deep);
    font-family: var(--font-serif);
    font-size: 36px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .contacts {
    display: flex; flex-direction: column; gap: 8px;
    background: var(--surface-soft);
    padding: 16px;
    border-radius: var(--r-md);
    min-width: 280px;
    font-size: 13px;
  }
  .contact-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

  .split { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; align-items: flex-start; }
  @media (max-width: 1100px) { .split { grid-template-columns: 1fr; } }

  .tl { display: flex; flex-direction: column; gap: 4px; }
  .tl-row { display: flex; gap: 16px; }
  .tl-axis { display: flex; flex-direction: column; align-items: center; padding-top: 4px; }
  .tl-dot {
    width: 12px; height: 12px; border-radius: 99px;
    background: var(--muted-2);
    border: 3px solid var(--surface);
    box-shadow: 0 0 0 1px var(--line);
  }
  .tl-dot.selected { background: var(--ok); }
  .tl-dot.rejected { background: var(--bad); }
  .tl-dot.hold { background: var(--warn); }
  .tl-line { width: 2px; flex: 1; min-height: 18px; background: var(--line); margin-top: 4px; }
  .tl-body {
    flex: 1;
    padding-bottom: 18px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .tl-details { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; background: var(--surface-soft); border-radius: 8px; margin-top: 4px; }
  .dl { display: flex; gap: 10px; font-size: 12px; }

  .kv { display: grid; grid-template-columns: 110px 1fr; gap: 8px 12px; font-size: 13px; }
  .kv-row { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--line-soft); font-size: 12px; }
  .kv-row .muted { min-width: 220px; }
  .raw { max-height: 400px; overflow: auto; }
</style>
