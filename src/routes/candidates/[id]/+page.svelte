<script>
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dataset, STAGES, STAGE_INDEX } from '$lib/data/stores.js';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  $: id = decodeURIComponent($page.params.id);
  $: c = $dataset.candidates.find(x => x.nameKey === id || x.uid === id);

  $: stageEntries = c
    ? STAGES.map(s => ({ ...s, event: c.stages[s.key] }))
      .filter(s => s.event || s.key === c.currentStage)
      .sort((a, b) => (STAGE_INDEX[a.key] ?? 0) - (STAGE_INDEX[b.key] ?? 0))
    : [];

  $: appFields = c?.application ? Object.entries({
    'Age': c.application.age,
    'Current location': c.application.currentLocation,
    'Native language': c.application.nativeLanguage,
    'Current company': c.application.currentCompany,
    'Current CTC': c.application.currentCTC,
    'Expected CTC': c.application.expectedCTC,
    'Notice period': c.application.noticePeriod,
    'Preferred location': c.application.preferredLocation,
    'OK locations': c.application.okLocations,
    'Mobile': c.application.mobile,
    'Email': c.application.email,
    'LinkedIn': c.application.linkedinUrl,
    'Resume': c.application.resumeLink,
    'Select status': c.application.selectStatus,
    'Shortlisted by': c.application.shortlistedBy,
    'Free text': c.application.extraNote,
    'Submitted at': c.application.timestamp,
  }).filter(([_, v]) => v) : [];

  $: detailFields = c?.details ? Object.entries({
    'Role': c.details.role,
    'Status of application': c.details.statusOfApp,
    'Cooling period': c.details.coolingPeriod,
    'Moving status': c.details.movingStatus,
    'Approval': c.details.approval,
    'Location': c.details.location,
    'Preferred locations': c.details.preferredLocations,
    'R1 recording': c.details.r1Recording,
    'R2 recording': c.details.r2Recording,
    'R3 recording': c.details.r3Recording,
    'Resume': c.details.resume,
    'Remarks': c.details.remarks,
    'Alfisha remarks': c.details.alfishaRemarks,
  }).filter(([_, v]) => v) : [];
</script>

<svelte:head><title>{c?.name || 'Candidate'} · Hiring Portal</title></svelte:head>

<a class="back" href="{base}/candidates">← Back to candidates</a>

{#if !c}
  <EmptyState title="Candidate not found." body="The name key didn't match any candidate in the dataset." actionLabel="Browse all candidates" actionHref="{base}/candidates" />
{:else}
  <header class="hero card pad-lg fade-up">
    <div class="hero-main">
      <div class="hero-avatar">{(c.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}</div>
      <div>
        <h1 class="serif" style="margin:0;font-size:36px;letter-spacing:-0.02em">{c.name}</h1>
        <div class="hero-meta">
          {#if c.role}<span class="role-pill {c.role.toLowerCase().replace(/\s+\d+/, '')}">{c.role}</span>{/if}
          <StatusPill decision={c.finalDecision === 'hired' ? 'selected' : c.finalDecision === 'active' ? 'pending' : c.finalDecision} />
          {#if c.uid}<span class="muted mono">UID: {c.uid}</span>{/if}
          <span class="muted">{c.email || ''}</span>
          <span class="muted mono">{c.phone || ''}</span>
        </div>
      </div>
    </div>
    <div class="hero-stat">
      <div class="hero-stat-lbl">Current stage</div>
      <div class="hero-stat-val display">{STAGES.find(s => s.key === c.currentStage)?.label || '—'}</div>
      <div class="muted small">{c.currentStageStatus || '—'}</div>
    </div>
  </header>

  <section class="row gap" style="margin-top:20px;align-items:flex-start">
    <!-- Timeline -->
    <div class="card pad-lg" style="flex:1.4;min-width:0">
      <h2 class="serif" style="font-size:22px;margin-bottom:16px">Pipeline timeline</h2>
      {#if stageEntries.length}
        <div class="timeline">
          {#each stageEntries as st}
            {@const isCurrent = st.key === c.currentStage}
            <div class="t-row" class:current={isCurrent}>
              <div class="t-dot" class:rej={st.event?.decision === 'rejected'} class:ok={st.event?.decision === 'selected' || st.event?.decision === 'hired'}>
                {st.short}
              </div>
              <div class="t-content">
                <div class="row between" style="align-items:center">
                  <h3 style="margin:0;font-size:15px;color:var(--ink);font-weight:700">{st.label}</h3>
                  {#if st.event?.decision}<StatusPill decision={st.event.decision} />{/if}
                </div>
                <div class="muted small" style="margin-top:4px">
                  {#if st.event?.parsedDate}{st.event.parsedDate.toLocaleDateString()} · {/if}
                  {#if st.event?.panelist}Panelist: {st.event.panelist}{/if}
                </div>
                {#if st.event}
                  <div class="t-fields">
                    {#if st.event.status}<div><b>Status:</b> {st.event.status}</div>{/if}
                    {#if st.event.rejectionCategory}<div><b>Rejection:</b> {st.event.rejectionCategory}{st.event.rejectionSub ? ` · ${st.event.rejectionSub}` : ''}</div>{/if}
                    {#if st.event.remarks}<div class="muted">{st.event.remarks}</div>{/if}
                    {#if st.event.stageData}
                      {#each Object.entries(st.event.stageData).slice(0, 12) as [k, v]}
                        <div class="t-extra"><span class="muted">{k}:</span> {v}</div>
                      {/each}
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <EmptyState title="No stage events yet." />
      {/if}
    </div>

    <!-- Sidebar: application + details -->
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:16px">
      {#if appFields.length}
        <div class="card pad-lg">
          <h2 class="serif" style="font-size:18px;margin-bottom:12px">Application</h2>
          <dl class="kv">
            {#each appFields as [k, v]}
              <dt>{k}</dt>
              <dd>
                {#if String(v).startsWith('http')}
                  <a href={String(v)} target="_blank" rel="noopener">{String(v).replace(/^https?:\/\//, '').slice(0, 40)}…</a>
                {:else}
                  {v}
                {/if}
              </dd>
            {/each}
          </dl>
        </div>
      {/if}

      {#if detailFields.length}
        <div class="card pad-lg">
          <h2 class="serif" style="font-size:18px;margin-bottom:12px">Master roster</h2>
          <dl class="kv">
            {#each detailFields as [k, v]}
              <dt>{k}</dt>
              <dd>
                {#if String(v).startsWith('http')}
                  <a href={String(v)} target="_blank" rel="noopener">View →</a>
                {:else}
                  {v}
                {/if}
              </dd>
            {/each}
          </dl>
        </div>
      {/if}

      {#if c.panelists.length}
        <div class="card pad-lg">
          <h2 class="serif" style="font-size:18px;margin-bottom:12px">Panelists</h2>
          <div class="row gap-sm" style="flex-wrap:wrap">
            {#each c.panelists as p}<span class="pill solid">{p}</span>{/each}
          </div>
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  .back {
    display: inline-block;
    margin-bottom: 16px;
    color: var(--ink-2);
    font-size: 13px;
    font-weight: 600;
  }
  .back:hover { color: var(--brand); }

  .hero { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
  .hero-main { display: flex; align-items: center; gap: 20px; }
  .hero-avatar {
    width: 80px; height: 80px;
    border-radius: 20px;
    background: var(--ink);
    color: var(--brand-soft);
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: 800;
    flex-shrink: 0;
  }
  .hero-meta { display: flex; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
  .hero-stat { text-align: right; }
  .hero-stat-lbl { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); }
  .hero-stat-val { font-size: 28px; line-height: 1.1; margin-top: 4px; }

  .role-pill {
    padding: 4px 12px;
    border-radius: 99px;
    font-weight: 800;
    font-size: 11px;
    color: #fff;
    background: var(--brand);
  }
  .role-pill.pm  { background: var(--mauve); }
  .role-pill.cos { background: var(--olive); }
  .role-pill.boa { background: var(--gold); }
  .role-pill.pma { background: var(--brand); }

  .timeline { display: flex; flex-direction: column; gap: 0; position: relative; }
  .timeline::before {
    content: '';
    position: absolute;
    left: 24px; top: 24px; bottom: 24px;
    width: 2px;
    background: var(--line);
  }
  .t-row {
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: 12px;
    padding: 14px 0;
    position: relative;
  }
  .t-dot {
    width: 50px; height: 50px;
    border-radius: 14px;
    background: var(--surface);
    border: 2px solid var(--line);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800;
    color: var(--ink-3);
    z-index: 1;
    position: relative;
  }
  .t-row.current .t-dot { background: var(--brand); color: #fff; border-color: var(--brand-deep); box-shadow: 0 0 0 6px var(--brand-soft); }
  .t-dot.ok { background: var(--ok); color: #fff; border-color: var(--ok); }
  .t-dot.rej { background: var(--bad); color: #fff; border-color: var(--bad); }
  .t-content { padding-top: 6px; }
  .t-fields {
    margin-top: 8px;
    padding: 10px 12px;
    background: var(--surface-soft);
    border-radius: var(--r-sm);
    font-size: 12.5px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .t-extra { font-size: 11.5px; color: var(--ink-2); }

  dl.kv { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; font-size: 12.5px; }
  dl.kv dt { font-weight: 700; color: var(--ink-3); text-transform: uppercase; font-size: 10.5px; letter-spacing: .04em; padding-top: 2px; }
  dl.kv dd { color: var(--ink); margin: 0; word-break: break-word; }
  dl.kv dd a { color: var(--brand-deep); font-weight: 600; }
  .small { font-size: 12px; }
</style>
