<script>
  import { fade } from 'svelte/transition';
  // data: [{ month: 'YYYY-MM', interviewed: number, ... }]
  export let data = [];
  export let height = 200;
  export let color = 'var(--brand)';
  export let colorDeep = 'var(--brand-deep)';

  // Internal viewBox dims — scales to container width
  const W = 600;
  $: H = height;
  $: padX = 28;
  $: padTop = 22;
  $: padBottom = 36;
  $: chartW = W - padX * 2;
  $: chartH = H - padTop - padBottom;

  $: max = Math.max(1, ...data.map(d => d.interviewed || 0));
  $: nice = niceMax(max);

  function niceMax(m) {
    if (m <= 10) return Math.ceil(m / 2) * 2;
    if (m <= 100) return Math.ceil(m / 10) * 10;
    if (m <= 1000) return Math.ceil(m / 100) * 100;
    return Math.ceil(m / 1000) * 1000;
  }

  $: pts = data.map((d, i) => ({
    x: padX + (data.length <= 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: padTop + chartH - ((d.interviewed || 0) / nice) * chartH,
    val: d.interviewed || 0,
    label: d.month,
    short: shortMonth(d.month),
  }));

  function shortMonth(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(m, 10) - 1] || ym;
  }

  $: pathLine = pts.length
    ? pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ')
    : '';
  $: pathArea = pts.length
    ? pathLine + ` L ${pts[pts.length - 1].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`
    : '';

  $: total = data.reduce((s, d) => s + (d.interviewed || 0), 0);
  $: peakIdx = pts.findIndex(p => p.val === Math.max(...pts.map(x => x.val)));
  $: peakPt = pts[peakIdx];

  let hovered = null;
  let svgEl;

  function onMove(e) {
    if (!pts.length) return;
    const rect = svgEl.getBoundingClientRect();
    // Map mouse x from screen → SVG coords
    const xRatio = (e.clientX - rect.left) / rect.width;
    const sx = xRatio * W;
    // Find nearest pt
    let best = pts[0], bestD = Infinity;
    for (const p of pts) {
      const d = Math.abs(p.x - sx);
      if (d < bestD) { bestD = d; best = p; }
    }
    hovered = best;
  }
  function onLeave() { hovered = null; }
</script>

<div class="chart-wrap" style="height: {height}px">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {W} {H}"
    preserveAspectRatio="none"
    width="100%"
    height="100%"
    on:mousemove={onMove}
    on:mouseleave={onLeave}
    role="img"
    aria-label="Interview volume over last 12 months"
  >
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color={color} stop-opacity=".30"/>
        <stop offset="100%" stop-color={color} stop-opacity="0"/>
      </linearGradient>
    </defs>

    <!-- Y-axis gridlines + labels -->
    <g class="grid" vector-effect="non-scaling-stroke">
      {#each [0, 0.25, 0.5, 0.75, 1] as t}
        {@const y = padTop + chartH * (1 - t)}
        <line x1={padX} y1={y} x2={W - padX} y2={y} />
        <text class="axis-label" x={padX - 6} y={y + 3} text-anchor="end">
          {Math.round(nice * t)}
        </text>
      {/each}
    </g>

    <!-- Area fill -->
    {#if pathArea}
      <path d={pathArea} fill="url(#areaGrad)" />
    {/if}

    <!-- Line -->
    {#if pathLine}
      <path
        d={pathLine}
        fill="none"
        stroke={color}
        stroke-width="2.2"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
    {/if}

    <!-- Peak marker -->
    {#if peakPt && peakPt.val > 0}
      <circle cx={peakPt.x} cy={peakPt.y} r="6" fill={color} opacity=".25" />
      <circle cx={peakPt.x} cy={peakPt.y} r="3" fill={colorDeep} />
    {/if}

    <!-- All points -->
    {#each pts as p}
      <circle cx={p.x} cy={p.y} r="2.2" fill="#fff" stroke={color} stroke-width="1.6"/>
    {/each}

    <!-- Hover line + dot -->
    {#if hovered}
      <line
        x1={hovered.x} y1={padTop} x2={hovered.x} y2={padTop + chartH}
        stroke={colorDeep} stroke-width="1" stroke-dasharray="3 3" opacity=".6"
      />
      <circle cx={hovered.x} cy={hovered.y} r="5" fill={colorDeep} stroke="#fff" stroke-width="2" />
    {/if}

    <!-- X-axis month labels -->
    {#each pts as p, i}
      {#if (i % 2 === 0) || i === pts.length - 1}
        <text class="axis-label x" x={p.x} y={H - 12} text-anchor="middle">{p.short}</text>
      {/if}
    {/each}
  </svg>

  <!-- Hover tooltip card (HTML, so it doesn't get distorted) -->
  {#if hovered}
    {@const xPct = (hovered.x / W) * 100}
    {@const yPct = (hovered.y / H) * 100}
    <div class="tt" in:fade={{ duration: 100 }} style="left: {Math.min(85, Math.max(15, xPct))}%; top: {yPct}%">
      <div class="tt-month">{hovered.label}</div>
      <div class="tt-val display">{hovered.val}</div>
      <div class="tt-lbl">interviews</div>
    </div>
  {/if}

  <!-- Footer summary -->
  <div class="chart-summary">
    <div>
      <div class="cs-num display">{total.toLocaleString()}</div>
      <div class="cs-lbl">total · {data.length} months</div>
    </div>
    {#if peakPt}
      <div style="text-align:right">
        <div class="cs-num display" style="color: {colorDeep}">{peakPt.val}</div>
        <div class="cs-lbl">peak · {peakPt.short}</div>
      </div>
    {/if}
  </div>
</div>

<style>
  .chart-wrap {
    position: relative;
    width: 100%;
    color: var(--ink-3);
  }
  svg { display: block; }

  .grid line {
    stroke: var(--line);
    stroke-dasharray: 2 4;
    opacity: .65;
  }
  .axis-label {
    font-family: var(--font-mono);
    font-size: 9.5px;
    fill: var(--muted);
    font-weight: 500;
  }
  .axis-label.x { font-size: 10px; }

  .tt {
    position: absolute;
    transform: translate(-50%, calc(-100% - 14px));
    background: var(--ink);
    color: #fff;
    padding: 8px 12px;
    border-radius: 10px;
    box-shadow: 0 12px 28px rgba(26, 15, 8, .25);
    pointer-events: none;
    z-index: 10;
    border: 1px solid var(--brand);
    text-align: center;
    min-width: 80px;
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
  .tt-month { font-size: 9.5px; color: var(--brand-soft); text-transform: uppercase; letter-spacing: .08em; font-weight: 600; }
  .tt-val { font-size: 22px; line-height: 1; margin: 4px 0 2px; color: var(--brand-soft); font-weight: 700; }
  .tt-lbl { font-size: 9.5px; color: rgba(255, 255, 255, .55); }

  .chart-summary {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 16px;
    margin-top: 4px;
    padding-top: 12px;
    border-top: 1px solid var(--line-soft);
  }
  .cs-num { font-size: 22px; line-height: 1; color: var(--ink); font-weight: 700; letter-spacing: -0.02em; }
  .cs-lbl { font-size: 10.5px; color: var(--ink-3); margin-top: 4px; text-transform: uppercase; letter-spacing: .08em; font-weight: 600; }
</style>
