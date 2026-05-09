<script>
  import AnimatedNumber from './AnimatedNumber.svelte';
  export let label = '';
  export let value = 0;
  export let delta = '';
  export let kind = 'default'; // default | brand | peach | mauve | ink
  export let icon = '';
  export let format = (n) => Math.round(n).toLocaleString();
</script>

<div class="stat {kind}">
  <div class="row between" style="margin-bottom:18px">
    <div class="lbl">{label}</div>
    {#if icon}
      <div class="ic">{@html icon}</div>
    {/if}
  </div>

  <div class="val display">
    <AnimatedNumber {value} {format} />
  </div>

  {#if delta}
    <div class="dlt">{delta}</div>
  {/if}

  <div class="bg-deco" aria-hidden="true"></div>
</div>

<style>
  .stat {
    position: relative;
    padding: 22px;
    border-radius: var(--r-lg);
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-xs);
    overflow: hidden;
    transition: all var(--t-base) var(--ease);
    min-height: 152px;
    display: flex; flex-direction: column;
  }
  .stat:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-md);
  }

  /* Tuscan variants */
  .stat.brand {
    background: var(--brand);
    border-color: var(--brand-deep);
    color: #fff;
  }
  .stat.peach {
    background: var(--brand-soft);
    border-color: var(--brand);
    color: var(--brand-darker);
  }
  .stat.mauve {
    background: var(--mauve);
    border-color: var(--mauve-deep);
    color: #fff;
  }
  .stat.ink {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--brand-soft);
  }

  .lbl {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .12em;
    font-weight: 700;
    color: inherit;
    opacity: .85;
  }
  .stat.peach .lbl { opacity: .75; }

  .ic {
    width: 36px; height: 36px;
    border-radius: 12px;
    background: rgba(0, 0, 0, .08);
    color: inherit;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .stat.brand .ic, .stat.mauve .ic, .stat.ink .ic { background: rgba(255, 255, 255, .15); }
  .stat.peach .ic { background: rgba(138, 43, 14, .12); }
  .ic :global(svg) { width: 18px; height: 18px; }

  .val {
    font-family: var(--font-display);
    font-size: 56px;
    line-height: 1;
    letter-spacing: -0.04em;
    font-weight: 700;
    color: inherit;
    margin-top: auto;
  }

  .dlt {
    font-size: 12px;
    margin-top: 8px;
    color: inherit;
    opacity: .75;
    font-weight: 500;
  }

  .bg-deco {
    position: absolute;
    inset: auto -50px -60px auto;
    width: 180px; height: 180px;
    background: radial-gradient(circle, rgba(255,255,255,.18) 0%, transparent 70%);
    pointer-events: none;
    transition: transform var(--t-slow) var(--ease);
  }
  .stat:not(.brand):not(.peach):not(.mauve):not(.ink) .bg-deco {
    background: radial-gradient(circle, rgba(227, 83, 54, .12) 0%, transparent 70%);
  }
  .stat.peach .bg-deco { background: radial-gradient(circle, rgba(138, 43, 14, .12) 0%, transparent 70%); }
  .stat:hover .bg-deco { transform: scale(1.2) rotate(15deg); }
</style>
