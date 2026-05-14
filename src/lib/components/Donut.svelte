<script>
  // segments: [{ label, value, color }]
  export let segments = [];
  export let size = 180;
  export let stroke = 28;
  export let centerLabel = '';
  export let centerValue = '';

  $: total = segments.reduce((s, x) => s + (x.value || 0), 0);
  $: radius = (size - stroke) / 2;
  $: cx = size / 2;
  $: cy = size / 2;
  $: circumference = 2 * Math.PI * radius;

  $: layout = (() => {
    let running = 0;
    return segments.map((s) => {
      const frac = total ? (s.value || 0) / total : 0;
      const dash = frac * circumference;
      const offset = -running * circumference;
      running += frac;
      return { ...s, dash, gap: circumference - dash, offset, pct: frac };
    });
  })();
</script>

<div class="donut">
  <svg width={size} height={size} viewBox="0 0 {size} {size}">
    <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--surface-sunk)" stroke-width={stroke} />
    {#each layout as seg}
      <circle
        cx={cx} cy={cy} r={radius} fill="none"
        stroke={seg.color}
        stroke-width={stroke}
        stroke-dasharray="{seg.dash} {seg.gap}"
        stroke-dashoffset={seg.offset}
        transform="rotate(-90 {cx} {cy})"
        style="transition: stroke-dasharray 600ms var(--ease)"
      />
    {/each}
    <text x={cx} y={cy - 6} text-anchor="middle" class="d-val">{centerValue || total.toLocaleString()}</text>
    {#if centerLabel}
      <text x={cx} y={cy + 14} text-anchor="middle" class="d-lbl">{centerLabel}</text>
    {/if}
  </svg>

  <div class="legend">
    {#each layout as seg}
      <div class="leg-row">
        <span class="sw" style="background: {seg.color}"></span>
        <span class="lbl">{seg.label}</span>
        <span class="val mono">{seg.value.toLocaleString()}</span>
        <span class="pct mono">{Math.round(seg.pct * 100)}%</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .donut { display: flex; align-items: center; gap: 24px; }
  svg { flex-shrink: 0; }
  .d-val {
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 700;
    fill: var(--ink);
    letter-spacing: -0.02em;
  }
  .d-lbl {
    font-size: 10px;
    font-weight: 700;
    fill: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: .08em;
  }
  .legend { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
  .leg-row {
    display: grid;
    grid-template-columns: 14px 1fr 60px 50px;
    gap: 10px;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid var(--line-soft);
    font-size: 12.5px;
  }
  .leg-row:last-child { border-bottom: 0; }
  .sw { width: 12px; height: 12px; border-radius: 3px; }
  .lbl { color: var(--ink); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .val { text-align: right; font-weight: 700; }
  .pct { text-align: right; color: var(--ink-3); font-size: 11px; }
</style>
