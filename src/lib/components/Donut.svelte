<script>
  // Compact donut chart
  export let value = 0;
  export let max = 100;
  export let size = 120;
  export let stroke = 12;
  export let color = 'var(--brand)';
  export let track = 'var(--surface-sunk)';
  export let label = '';
  export let sublabel = '';

  $: pct = max ? Math.min(1, Math.max(0, value / max)) : 0;
  $: r = (size - stroke) / 2;
  $: c = 2 * Math.PI * r;
  $: dash = c * pct;
</script>

<div class="donut" style="width:{size}px;height:{size}px">
  <svg width={size} height={size} viewBox="0 0 {size} {size}">
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} stroke-width={stroke} />
    <circle
      cx={size/2} cy={size/2} r={r}
      fill="none" stroke={color} stroke-width={stroke}
      stroke-dasharray="{dash} {c}"
      stroke-linecap="round"
      transform="rotate(-90 {size/2} {size/2})"
      style="transition: stroke-dasharray 800ms var(--ease)"
    />
  </svg>
  <div class="label">
    <div class="serif big">{label}</div>
    {#if sublabel}<div class="muted sub">{sublabel}</div>{/if}
  </div>
</div>

<style>
  .donut { position: relative; display: inline-block; }
  .label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .big { font-size: 24px; line-height: 1; }
  .sub { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; margin-top: 4px; }
</style>
