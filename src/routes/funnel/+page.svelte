<script>
  import { funnel, summaryFunnel, dropoff, data } from '$lib/data/stores.js';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import Funnel from '$lib/components/Funnel.svelte';
  import StatCard from '$lib/components/StatCard.svelte';

  $: hasMaster = $funnel.masterFunnel.some(s => s.count > 0);
  $: hasTracker = $funnel.trackerFunnel.length > 0;
  $: hasSummary = $summaryFunnel.length > 0;

  $: totals = (() => {
    if (hasSummary) {
      let resumes = 0, selected = 0, r1 = 0, r2 = 0, r3 = 0, r1sel = 0, r2sel = 0, r3sel = 0;
      for (const t of $summaryFunnel) {
        const get = n => t.stages.find(s => s.stage === n)?.count || 0;
        resumes += get('Resumes');
        selected += get('Resume sel.');
        r1 += get('R1 done');
        r2 += get('R2 done');
        r3 += get('R3 done');
        r1sel += get('R1 sel.');
        r2sel += get('R2 sel.');
        r3sel += get('R3 sel.');
      }
      return { resumes, selected, r1, r2, r3, r1sel, r2sel, r3sel,
        conv: resumes ? Math.round(((r3sel + r2sel + r1sel) / resumes) * 100) : 0 };
    }
    // Fallback to tracker
    const t = $funnel.trackerFunnel;
    let resume = 0, interviewed = 0, selectedFinal = 0;
    for (const r of t) {
      resume += r.stages.find(s => s.stage === 'Resume')?.count || 0;
      interviewed += r.stages.find(s => s.stage === 'R1')?.count || 0;
      selectedFinal += r.stages[r.stages.length - 1]?.count || 0;
    }
    return { resumes: resume, selected: 0, r1: interviewed, r2: 0, r3: 0,
      r1sel: 0, r2sel: 0, r3sel: selectedFinal,
      conv: resume ? Math.round((selectedFinal / resume) * 100) : 0 };
  })();
</script>

<svelte:head><title>Funnel · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">Pipeline analytics</div>
    <h1>Funnel & conversion</h1>
  </div>
  {#if hasSummary}
    <span class="pill brand"><span class="dot live"></span> Live from master sheet</span>
  {/if}
</header>

<section class="kpi-grid stagger">
  <StatCard label="Resumes reviewed" value={totals.resumes} kind="default" />
  <StatCard label="R1 conducted" value={totals.r1} kind="brand" delta={totals.resumes ? Math.round((totals.r1 / totals.resumes) * 100) + '% of resumes' : ''} />
  <StatCard label="R2 conducted" value={totals.r2} kind="peach" delta={totals.r1 ? Math.round((totals.r2 / totals.r1) * 100) + '% of R1' : ''} />
  <StatCard label="Selected at R3" value={totals.r3sel} kind="mauve" />
</section>

{#if hasSummary}
  <section class="card pad" style="margin-bottom:20px">
    <div class="section-h"><div class="title"><h2>Per-role funnel</h2><span class="count">authoritative — from master summary</span></div></div>
    <div class="role-grid">
      {#each $summaryFunnel as t, i (t.role)}
        <div class="role-funnel" in:fly={{ y: 8, delay: i * 60, duration: 400, easing: quintOut }}>
          <div class="role-h">
            <span class="pill brand" style="font-size:12px;font-weight:600">{t.role}</span>
            <span class="muted" style="font-size:11px">{t.stages[0]?.count || 0} sourced → {t.stages[t.stages.length - 1]?.count || 0} selected</span>
          </div>
          <Funnel stages={t.stages} accent={t.role === 'PMA' ? 'brand' : t.role === 'PM' ? 'sage' : t.role === 'COS' ? 'plum' : 'gold'} />
        </div>
      {/each}
    </div>
  </section>
{:else if hasTracker}
  <section class="card pad" style="margin-bottom:20px">
    <div class="section-h"><div class="title"><h2>Per-role funnel</h2><span class="count">computed from tracker activity</span></div></div>
    <div class="role-grid">
      {#each $funnel.trackerFunnel as t, i (t.role)}
        <div class="role-funnel" in:fly={{ y: 8, delay: i * 60, duration: 400, easing: quintOut }}>
          <div class="role-h">
            <span class="pill brand" style="font-size:12px;font-weight:600">{t.role}</span>
          </div>
          <Funnel stages={t.stages} accent={t.role === 'PMA' ? 'brand' : t.role === 'PM' ? 'sage' : 'plum'} />
        </div>
      {/each}
    </div>
  </section>
{/if}

{#if hasTracker}
  <section class="card pad" style="margin-bottom:20px">
    <div class="section-h"><div class="title"><h2>Drop-off between stages</h2><span class="count">where candidates leak (tracker)</span></div></div>
    <div class="dropoff-grid">
      {#each $dropoff as d (d.role)}
        <div class="drop-card">
          <div class="row between" style="margin-bottom:10px">
            <strong>{d.role}</strong>
            <span class="muted" style="font-size:11px">stage transitions</span>
          </div>
          {#each d.drops as t}
            <div class="drop-row">
              <div class="grow">
                <div style="font-size:12px">{t.from} <span class="muted">→</span> {t.to}</div>
                <div class="bar" style="margin-top:4px"><span style="width:{t.carryPct}%;background:linear-gradient(90deg,var(--sage),#76B59A)"></span></div>
              </div>
              <div style="text-align:right">
                <div class="serif" style="font-size:18px;line-height:1">{t.carryPct}%</div>
                <div class="muted" style="font-size:10.5px">−{t.absDrop}</div>
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </section>
{/if}

{#if hasMaster}
  <section class="card pad">
    <div class="section-h"><div class="title"><h2>Master pipeline funnel</h2><span class="count">from sourced to joined</span></div></div>
    <Funnel stages={$funnel.masterFunnel.filter(s => s.count > 0)} accent="brand" />
  </section>
{:else if !hasSummary && !hasTracker}
  <section class="card" style="padding:48px;text-align:center;background:var(--surface-soft)">
    <div class="serif" style="font-size:20px">No funnel data yet.</div>
    <div class="muted" style="margin-top:6px">Connect both sheets in Settings to see numbers.</div>
  </section>
{/if}

<style>
  .role-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
  .role-funnel { display: flex; flex-direction: column; gap: 8px; }
  .role-h { display: flex; align-items: center; justify-content: space-between; }

  .dropoff-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
  .drop-card { background: var(--surface-soft); border-radius: var(--r-md); padding: 16px; }
  .drop-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line-soft); }
  .drop-row:first-of-type { border-top: 0; }
</style>
