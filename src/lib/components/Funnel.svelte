<script>
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  export let stages = []; // [{ stage, count }]
  export let title = '';
  export let accent = 'brand'; // brand | sage | gold | plum
  $: max = Math.max(1, ...stages.map(s => s.count));
</script>

<div class="funnel">
  {#if title}<div class="ttl">{title}</div>{/if}
  <div class="bars">
    {#each stages as s, i (s.stage)}
      {@const w = !s.count || !max ? 0 : Math.max(2, (s.count / max) * 100)}
      {@const next = stages[i + 1]?.count ?? null}
      {@const conv = next != null && s.count ? Math.round((next / s.count) * 100) : null}
      <div class="step" in:fly={{ x: -8, delay: i * 60, duration: 500, easing: quintOut }}>
        <div class="meta">
          <span class="lbl">{s.stage}</span>
          <span class="cnt mono">{s.count.toLocaleString()}</span>
        </div>
        <div class="track">
          <div class="fill {accent}" style="width:{w}%"></div>
        </div>
        {#if conv != null}
          <div class="conv">
            <span class="arrow">↓</span>
            <span class={conv >= 50 ? 'ok' : conv >= 25 ? 'warn' : 'bad'}>{conv}% carry</span>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .funnel { display: flex; flex-direction: column; gap: 8px; }
  .ttl { font-family: var(--font-serif); font-size: 18px; margin-bottom: 4px; }
  .bars { display: flex; flex-direction: column; gap: 4px; }
  .step { display: flex; flex-direction: column; gap: 4px; padding: 4px 0; }
  .meta { display: flex; justify-content: space-between; font-size: 12px; }
  .lbl { color: var(--ink-2); font-weight: 500; }
  .cnt { color: var(--ink); font-weight: 600; font-size: 13px; }
  .track {
    height: 22px;
    border-radius: 8px;
    background: var(--surface-sunk);
    overflow: hidden;
    position: relative;
  }
  .fill {
    height: 100%;
    border-radius: 8px;
    background: linear-gradient(90deg, var(--brand) 0%, var(--brand-deep) 100%);
    transition: width 600ms var(--ease);
  }
  .fill.brand { background: linear-gradient(90deg, var(--brand) 0%, var(--brand-deep) 100%); }
  .fill.olive { background: linear-gradient(90deg, var(--olive) 0%, #4A5634 100%); }
  .fill.gold  { background: linear-gradient(90deg, var(--gold) 0%, #8E6B36 100%); }
  .fill.mauve { background: linear-gradient(90deg, var(--mauve) 0%, var(--mauve-deep) 100%); }
  .fill.peach { background: linear-gradient(90deg, var(--brand-soft) 0%, var(--brand) 100%); }
  /* Back-compat aliases for old class names */
  .fill.sage { background: linear-gradient(90deg, var(--olive) 0%, #4A5634 100%); }
  .fill.plum { background: linear-gradient(90deg, var(--mauve) 0%, var(--mauve-deep) 100%); }
  .conv {
    align-self: center;
    display: flex; align-items: center; gap: 6px;
    font-size: 10.5px; color: var(--muted);
    margin: 2px 0;
  }
  .conv .arrow { color: var(--muted-2); }
  .conv .ok { color: var(--ok); font-weight: 500; }
  .conv .warn { color: #8E6726; font-weight: 500; }
  .conv .bad { color: var(--bad); font-weight: 500; }
</style>
