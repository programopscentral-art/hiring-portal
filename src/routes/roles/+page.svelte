<script>
  import { base } from '$app/paths';
  import { roleStats, ROLES } from '$lib/data/stores.js';

  function fmt(n) { return (n || 0).toLocaleString(); }
</script>

<svelte:head><title>Roles · Hiring Portal</title></svelte:head>

<header class="page-head fade-up">
  <div>
    <div class="crumb">Hiring portal</div>
    <h1 class="serif">Roles</h1>
    <p class="muted lead">Choose a role to drill into its funnel, candidates, top sources, and rejection reasons.</p>
  </div>
</header>

<section class="role-grid">
  {#each ROLES as r}
    {@const s = $roleStats[r] || { total: 0, active: 0, hired: 0, rejected: 0 }}
    <a class="role-card" href="{base}/roles/{r}">
      <div class="role-pill {r.toLowerCase()}">{r}</div>
      <h2 class="serif" style="font-size:24px;margin:14px 0 4px 0">{r}</h2>
      <div class="role-total display">{fmt(s.total)}</div>
      <div class="muted small">candidates total</div>
      <div class="role-foot">
        <div><span class="ok mono">{fmt(s.active)}</span> <span class="lbl">active</span></div>
        <div><span class="brand mono">{fmt(s.hired)}</span> <span class="lbl">hired</span></div>
        <div><span class="bad mono">{fmt(s.rejected)}</span> <span class="lbl">rejected</span></div>
      </div>
      <div class="role-cta">View funnel →</div>
    </a>
  {/each}
</section>

<style>
  .role-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-top: 18px;
  }
  @media (max-width: 1100px) { .role-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 600px) { .role-grid { grid-template-columns: 1fr; } }

  .role-card {
    position: relative;
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    background: var(--surface);
    overflow: hidden;
    transition: all var(--t-base) var(--ease);
    min-height: 240px;
    display: flex; flex-direction: column;
  }
  .role-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }

  .role-pill {
    width: 52px; height: 52px;
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 14px; color: #fff;
    box-shadow: 0 6px 18px rgba(0,0,0,.18);
  }
  .role-pill.pma { background: var(--brand); }
  .role-pill.pm  { background: var(--mauve); }
  .role-pill.cos { background: var(--olive); }
  .role-pill.boa { background: var(--gold); }

  .role-total {
    font-size: 56px;
    line-height: 1;
    letter-spacing: -0.04em;
    color: var(--ink);
  }
  .small { font-size: 11.5px; }

  .role-foot {
    display: flex;
    gap: 12px;
    margin-top: auto;
    padding-top: 18px;
    border-top: 1px solid var(--line-soft);
  }
  .role-foot > div { display: flex; flex-direction: column; gap: 2px; }
  .role-foot .mono { font-size: 16px; font-weight: 800; }
  .role-foot .lbl { font-size: 10px; color: var(--ink-3); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .role-foot .ok { color: var(--ok); }
  .role-foot .brand { color: var(--brand); }
  .role-foot .bad { color: var(--bad); }

  .role-cta {
    margin-top: 12px;
    font-size: 12px;
    font-weight: 700;
    color: var(--brand-deep);
  }
</style>
