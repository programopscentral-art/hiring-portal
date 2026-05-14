<script>
  import { fade } from 'svelte/transition';
  // data: [{ month: 'YYYY-MM', sourced: n, interviewed: n, selected: n, joined: n }, ...]
  export let data = [];
  export let height = 280;
  export let series = [
    { key: 'interviewed', label: 'Interviewed', color: 'var(--brand)',  colorDeep: 'var(--brand-deep)' },
    { key: 'selected',    label: 'Selected',    color: 'var(--olive)',  colorDeep: '#4A5634' },
    { key: 'sourced',     label: 'Sourced',     color: 'var(--gold)',   colorDeep: '#8E6B36' },
  ];

  const W = 800;
  $: H = height;
  $: padX = 36;
  $: padTop = 18;
  $: padBottom = 32;
  $: chartW = W - padX * 2;
  $: chartH = H - padTop - padBottom;

  // Find global max across all visible series
  $: max = Math.max(1, ...data.flatMap(d => series.map(s => d[s.key] || 0)));
  $: nice = niceMax(max);

  function niceMax(m) {
    if (m <= 5) return 5;
    if (m <= 10) return 10;
    if (m <= 20) return 20;
    if (m <= 50) return 50;
    if (m <= 100) return Math.ceil(m / 20) * 20;
    if (m <= 500) return Math.ceil(m / 50) * 50;
    if (m <= 2000) return Math.ceil(m / 100) * 100;
    return Math.ceil(m / 500) * 500;
  }

  function shortMonth(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(m, 10) - 1] || ym;
  }

  // Layout: each month gets a slot. Within each slot, side-by-side bars per series.
  $: slotW = data.length ? chartW / data.length : chartW;
  $: barGap = 2;
  $: groupPad = Math.max(6, slotW * 0.14);
  $: barAreaW = slotW - groupPad * 2;
  $: barW = data.length ? Math.max(4, (barAreaW - barGap * (series.length - 1)) / series.length) : 0;

  $: bars = data.flatMap((d, i) => series.map((s, si) => {
    const slotX = padX + i * slotW;
    const x = slotX + groupPad + si * (barW + barGap);
    const val = d[s.key] || 0;
    const h = (val / nice) * chartH;
    const y = padTop + chartH - h;
    return {
      key: `${i}-${si}`,
      monthIdx: i,
      seriesIdx: si,
      x, y, w: barW, h,
      val, label: d.month, short: shortMonth(d.month),
      color: s.color, colorDeep: s.colorDeep, seriesLabel: s.label,
    };
  }));

  // X-axis labels — show every month if <= 12, otherwise every other
  $: xLabels = data.map((d, i) => ({
    x: padX + i * slotW + slotW / 2,
    label: shortMonth(d.month),
    show: data.length <= 12 || i % 2 === 0 || i === data.length - 1,
  }));

  let hovered = null;
  let svgEl;

  function onMove(e) {
    if (!data.length) return;
    const rect = svgEl.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const sx = xRatio * W;
    const idx = Math.min(data.length - 1, Math.max(0, Math.floor((sx - padX) / slotW)));
    hovered = { idx, ...data[idx] };
  }
  function onLeave() { hovered = null; }
</script>

<div class="chart-wrap" style="height: {height}px">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {W} {H}"
    preserveAspectRatio="none"
    width="100%" height="100%"
    on:mousemove={onMove}
    on:mouseleave={onLeave}
    role="img"
    aria-label="Monthly metrics breakdown"
  >
    <!-- Y-axis gridlines + labels -->
    <g class="grid">
      {#each [0, 0.25, 0.5, 0.75, 1] as t}
        {@const y = padTop + chartH * (1 - t)}
        <line x1={padX} y1={y} x2={W - padX} y2={y} />
        <text class="axis-label" x={padX - 8} y={y + 3} text-anchor="end">
          {Math.round(nice * t)}
        </text>
      {/each}
    </g>

    <!-- Hover slot highlight -->
    {#if hovered}
      <rect
        x={padX + hovered.idx * slotW}
        y={padTop}
        width={slotW}
        height={chartH}
        fill="var(--brand-soft-2)"
        opacity=".5"
      />
    {/if}

    <!-- Bars -->
    {#each bars as b (b.key)}
      <g class="bar-g">
        <rect
          class="bar"
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx="2"
          fill={b.color}
        />
      </g>
    {/each}

    <!-- X-axis month labels -->
    {#each xLabels as lbl}
      {#if lbl.show}
        <text class="axis-label x" x={lbl.x} y={H - 10} text-anchor="middle">{lbl.label}</text>
      {/if}
    {/each}
  </svg>

  <!-- Hover tooltip card -->
  {#if hovered}
    {@const xPct = ((padX + hovered.idx * slotW + slotW / 2) / W) * 100}
    {@const cx = Math.min(85, Math.max(15, xPct))}
    <div class="tt" in:fade={{ duration: 100 }} style="left: {cx}%">
      <div class="tt-month">{hovered.month}</div>
      <div class="tt-rows">
        {#each series as s}
          <div class="tt-row">
            <span class="tt-sw" style="background: {s.color}"></span>
            <span class="tt-lbl">{s.label}</span>
            <span class="tt-val mono">{hovered[s.key] || 0}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .chart-wrap {
    position: relative;
    width: 100%;
  }
  svg { display: block; cursor: crosshair; }

  .grid line {
    stroke: var(--line);
    stroke-dasharray: 2 4;
    opacity: .65;
  }
  .axis-label {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--muted);
    font-weight: 500;
  }
  .axis-label.x { font-size: 11px; font-weight: 600; }

  .bar { transition: opacity 140ms var(--ease); }
  .bar-g:hover .bar { opacity: .85; }

  .tt {
    position: absolute;
    bottom: 100%;
    transform: translate(-50%, -8px);
    background: var(--ink);
    color: #fff;
    padding: 10px 12px;
    border-radius: 10px;
    box-shadow: 0 12px 28px rgba(26, 15, 8, .25);
    pointer-events: none;
    z-index: 10;
    border: 1px solid var(--brand);
    min-width: 150px;
  }
  .tt::after {
    content: "";
    position: absolute; bottom: -5px; left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 10px; height: 10px;
    background: var(--ink);
    border-right: 1px solid var(--brand);
    border-bottom: 1px solid var(--brand);
  }
  .tt-month { font-size: 10px; color: var(--brand-soft); text-transform: uppercase; letter-spacing: .08em; font-weight: 700; margin-bottom: 6px; }
  .tt-rows { display: flex; flex-direction: column; gap: 4px; }
  .tt-row { display: grid; grid-template-columns: 10px 1fr auto; gap: 8px; align-items: center; font-size: 12px; }
  .tt-sw { width: 10px; height: 10px; border-radius: 2px; }
  .tt-lbl { color: rgba(255,255,255,.85); }
  .tt-val { color: #fff; font-weight: 700; }
</style>
