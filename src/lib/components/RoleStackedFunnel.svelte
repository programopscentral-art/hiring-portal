<script>
  // stages: [{ key, label, short, byRole: { PMA, PM, COS, BOA } }]
  // roleColors: { PMA, PM, COS, BOA }
  export let stages = [];
  export let roleColors = {
    PMA: 'var(--brand)',
    PM:  'var(--mauve)',
    COS: 'var(--olive)',
    BOA: 'var(--gold)',
  };
  export let title = '';

  $: maxTotal = Math.max(1, ...stages.map(s => Object.values(s.byRole).reduce((a, b) => a + b, 0)));
  $: roles = Object.keys(roleColors);

  function rowTotal(s) { return roles.reduce((a, r) => a + (s.byRole?.[r] || 0), 0); }
  let hovered = null;
</script>

<div class="rsf">
  {#if title}<div class="rsf-title">{title}</div>{/if}

  <div class="rsf-legend">
    {#each roles as r}
      <div class="leg"><span class="sw" style="background: {roleColors[r]}"></span>{r}</div>
    {/each}
  </div>

  <div class="rsf-stages">
    {#each stages as s, i}
      {@const total = rowTotal(s)}
      {@const w = !maxTotal ? 0 : Math.max(2, (total / maxTotal) * 100)}
      {@const prev = i > 0 ? rowTotal(stages[i - 1]) : null}
      {@const carry = prev != null && prev > 0 ? Math.round((total / prev) * 100) : null}
      <div class="row-wrap">
        <div class="meta">
          <span class="lbl">{s.label}</span>
          <span class="cnt mono">{total.toLocaleString()}</span>
        </div>
        <div
          class="bar"
          on:mouseenter={() => hovered = i}
          on:mouseleave={() => { if (hovered === i) hovered = null; }}
        >
          <div class="bar-fill" style="width: {w}%">
            {#each roles as r}
              {@const v = s.byRole?.[r] || 0}
              {@const segPct = total ? (v / total) * 100 : 0}
              {#if v > 0}
                <div class="seg" style="width: {segPct}%; background: {roleColors[r]}">
                  {#if segPct > 12}<span class="seg-lbl">{r} {v}</span>{/if}
                </div>
              {/if}
            {/each}
          </div>
        </div>
        {#if hovered === i && total > 0}
          <div class="tip">
            {#each roles as r}
              {@const v = s.byRole?.[r] || 0}
              {#if v > 0}
                <div class="tip-row"><span class="tsw" style="background: {roleColors[r]}"></span>{r}: <strong>{v.toLocaleString()}</strong></div>
              {/if}
            {/each}
          </div>
        {/if}
        {#if carry != null && i > 0}
          <div class="carry">
            <span class="arrow">↓</span>
            <span class={carry >= 50 ? 'ok' : carry >= 25 ? 'warn' : 'bad'}>{carry}% carry</span>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .rsf { display: flex; flex-direction: column; gap: 8px; }
  .rsf-title { font-family: var(--font-serif); font-size: 18px; }
  .rsf-legend { display: flex; gap: 14px; margin-bottom: 4px; }
  .leg { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--ink-2); }
  .sw { width: 12px; height: 12px; border-radius: 3px; }
  .rsf-stages { display: flex; flex-direction: column; gap: 4px; }
  .row-wrap { position: relative; padding: 6px 0; }
  .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
  .lbl { color: var(--ink-2); font-weight: 600; }
  .cnt { color: var(--ink); font-weight: 700; font-size: 13px; }
  .bar { height: 28px; border-radius: 8px; background: var(--surface-sunk); overflow: hidden; position: relative; }
  .bar-fill {
    height: 100%;
    display: flex;
    transition: width 700ms var(--ease);
  }
  .seg {
    height: 100%;
    display: flex; align-items: center; justify-content: center;
    transition: width 500ms var(--ease);
    color: #fff;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: .02em;
    overflow: hidden;
    white-space: nowrap;
  }
  .seg-lbl { padding: 0 4px; text-shadow: 0 1px 2px rgba(0,0,0,.2); }
  .tip {
    position: absolute;
    top: 100%; left: 12px;
    background: var(--ink);
    color: var(--brand-soft);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11.5px;
    z-index: 5;
    box-shadow: var(--shadow-md);
    min-width: 120px;
    margin-top: 4px;
  }
  .tip-row { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
  .tsw { width: 10px; height: 10px; border-radius: 2px; }
  .carry {
    position: absolute;
    top: 100%; right: 0;
    font-size: 10.5px;
    margin-top: 2px;
    color: var(--muted);
  }
  .carry .arrow { color: var(--muted-2); }
  .carry .ok { color: var(--ok); font-weight: 700; }
  .carry .warn { color: #8E6726; font-weight: 700; }
  .carry .bad { color: var(--bad); font-weight: 700; }
</style>
