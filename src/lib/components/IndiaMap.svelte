<script>
  import { project, projectLatLon } from '$lib/data/states.js';
  import { lookupUniversity } from '$lib/data/university-coords.js';
  import { INDIA_STATE_PATHS, INDIA_VIEWBOX } from '$lib/data/india-svg.js';
  import { fly, fade } from 'svelte/transition';
  import { quintOut, cubicOut } from 'svelte/easing';
  import { tweened } from 'svelte/motion';
  import { onMount } from 'svelte';

  export let universities = [];
  export let activeUniversity = '';
  export let activeState = '';
  export let onSelect = () => {};
  export let onSelectState = () => {};

  const W = INDIA_VIEWBOX.w;
  const H = INDIA_VIEWBOX.h;
  let mounted = false;
  let hovered = null;
  onMount(() => { mounted = true; });

  const STATE_ALIASES = {};
  function canonical(name) { return STATE_ALIASES[name] || name; }

  const viewBox = tweened([0, 0, W, H], { duration: 700, easing: cubicOut });
  $: viewBoxStr = $viewBox.map(n => n.toFixed(1)).join(' ');

  $: { if (activeState) zoomTo(activeState); else zoomOut(); }

  function zoomTo(stateName) {
    const target = INDIA_STATE_PATHS.find(s => canonical(s.name) === stateName);
    if (!target || !target.bbox) return;
    const [x1, y1, x2, y2] = target.bbox;
    const w = x2 - x1, h = y2 - y1;
    const pad = Math.max(w, h) * 0.35;
    const targetAspect = W / H;
    let bw = w + pad * 2, bh = h + pad * 2;
    if (bw / bh > targetAspect) bh = bw / targetAspect;
    else bw = bh * targetAspect;
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    viewBox.set([cx - bw / 2, cy - bh / 2, bw, bh]);
  }
  function zoomOut() { viewBox.set([0, 0, W, H]); }

  $: activeStates = new Set(universities.map(u => u.state));

  // Tiny deterministic jitter for universities WITHOUT a coords lookup.
  // This is a fallback only — most universities have explicit coords.
  function jitterFor(name, idxInGroup, totalInGroup) {
    if (totalInGroup <= 1) return { dx: 0, dy: 0 };
    const r = 8 + Math.min(10, totalInGroup * 1.2);
    const angle = (idxInGroup / totalInGroup) * Math.PI * 2 + (hash(name) % 100) / 100 * Math.PI;
    return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
  }
  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  $: positioned = (() => {
    // First pass: try real lat/lon for each university
    const out = [];
    const fallbackByState = new Map(); // state → list of universities lacking coords

    for (const u of universities) {
      const coords = lookupUniversity(u.state, u.name);
      if (coords) {
        const p = projectLatLon(coords.lat, coords.lon, W, H, 24);
        out.push({ ...u, x: p.x, y: p.y, hasRealCoords: true });
      } else {
        if (!fallbackByState.has(u.state)) fallbackByState.set(u.state, []);
        fallbackByState.get(u.state).push(u);
      }
    }

    // Second pass: state centroid + jitter for the unknowns
    for (const [state, list] of fallbackByState) {
      const centroid = project(state, W, H, 24);
      if (!centroid) continue;
      const sorted = list.slice().sort((a, b) => a.name.localeCompare(b.name));
      sorted.forEach((u, i) => {
        const j = jitterFor(u.name, i, sorted.length);
        out.push({ ...u, x: centroid.x + j.dx, y: centroid.y + j.dy, hasRealCoords: false });
      });
    }

    return out;
  })();

  $: maxPos = Math.max(1, ...positioned.map(u => u.positions || 0));
  function fillStatus(u) { return u.positions ? Math.round((u.hired / u.positions) * 100) : 0; }

  $: tooltipStyle = (() => {
    if (!hovered) return '';
    const [vx, vy, vw, vh] = $viewBox;
    const xPct = ((hovered.x - vx) / vw) * 100;
    const yPct = ((hovered.y - vy) / vh) * 100;
    const cx = Math.min(82, Math.max(18, xPct));
    return `left: ${cx}%; top: ${yPct}%;`;
  })();

  function clickState(geoStateName) {
    const real = canonical(geoStateName);
    onSelectState(activeState === real ? '' : real);
  }
</script>

<div class="map-wrap">
  <svg viewBox={viewBoxStr} preserveAspectRatio="xMidYMid meet" class="map">
    <defs>
      <pattern id="dotgrid" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="11" cy="11" r="0.55" fill="#1A0F08" opacity=".10"/>
      </pattern>
      <radialGradient id="pinGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#E35336" stop-opacity=".55"/>
        <stop offset="60%" stop-color="#E35336" stop-opacity=".10"/>
        <stop offset="100%" stop-color="#E35336" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="indiaFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity=".95"/>
        <stop offset="100%" stop-color="#FAF6EC" stop-opacity=".90"/>
      </linearGradient>
      <linearGradient id="activeStateFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFD3AC" stop-opacity=".90"/>
        <stop offset="100%" stop-color="#E35336" stop-opacity=".40"/>
      </linearGradient>
      <linearGradient id="focusedStateFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFD3AC" stop-opacity="1"/>
        <stop offset="100%" stop-color="#E35336" stop-opacity=".65"/>
      </linearGradient>
      <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="1" stdDeviation=".8" flood-color="#1A0F08" flood-opacity=".30"/>
      </filter>
    </defs>

    <rect x={$viewBox[0]} y={$viewBox[1]} width={$viewBox[2]} height={$viewBox[3]} fill="url(#dotgrid)" />

    <g class="india">
      {#each INDIA_STATE_PATHS as s (s.name)}
        {@const cn = canonical(s.name)}
        {@const isFocused = activeState === cn}
        {@const isActive = activeStates.has(cn)}
        {@const isDimmed = activeState && !isFocused}
        <path
          d={s.path}
          class="state"
          class:focused={isFocused}
          class:active={isActive}
          class:dimmed={isDimmed}
          fill={isFocused ? 'url(#focusedStateFill)' : isActive ? 'url(#activeStateFill)' : 'url(#indiaFill)'}
          on:click={() => clickState(s.name)}
          on:keydown={(e) => { if (e.key === 'Enter') clickState(s.name); }}
          role="button"
          tabindex="0"
          aria-label={cn}
        >
          <title>{cn}</title>
        </path>
      {/each}
    </g>

    {#if mounted}
      <!-- Map pins — inlined SVG so CSS can style the path -->
      {#each positioned as u, i (u.name + u.state)}
        {@const inFocus = !activeState || u.state === activeState}
        {@const isActive = activeUniversity === u.name}
        {@const isHired = u.hired > 0}
        <g
          class="pin"
          class:active={isActive}
          class:hovered={hovered?.name === u.name}
          class:dimmed={!inFocus}
          class:hired={isHired}
          class:approx={!u.hasRealCoords}
          role="button"
          tabindex="0"
          aria-label="{u.name}, {u.state} — {u.positions} positions"
          on:click={() => onSelect(u)}
          on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(u); } }}
          on:mouseenter={() => hovered = u}
          on:mouseleave={() => { if (hovered?.name === u.name) hovered = null; }}
          on:focus={() => hovered = u}
          on:blur={() => { if (hovered?.name === u.name) hovered = null; }}
          in:fly={{ y: -6, delay: 60 + i * 12, duration: 380, easing: quintOut }}
          transform="translate({u.x}, {u.y})"
        >
          <!-- Invisible hit-area circle: big enough that hover never breaks even when cursor wiggles -->
          <circle class="pin-hit" cx="0" cy="-8" r="14" fill="transparent" />
          <!-- The visible pin: scales on hover via .pin-shape, NOT the whole <g> -->
          <g class="pin-shape">
            <path
              class="pin-body"
              d="M0,0 C-2.8,-3.5 -6,-6.5 -6,-10 C-6,-13.3 -3.3,-16 0,-16 C3.3,-16 6,-13.3 6,-10 C6,-6.5 2.8,-3.5 0,0 Z"
              filter="url(#pinShadow)"
            />
            <circle class="pin-dot" cx="0" cy="-10" r="2.4" fill="#FFFFFF" />
          </g>
        </g>
      {/each}
    {/if}
  </svg>

  {#if hovered}
    <div class="tooltip" in:fade={{ duration: 140 }} style={tooltipStyle}>
      <div class="tt-name display">{hovered.name}</div>
      <div class="tt-meta">
        <svg width="9" height="11" viewBox="0 0 12 14" fill="none" stroke="currentColor" stroke-width="1.8" style="vertical-align:-1px"><path d="M6 13s-5-4.4-5-8a5 5 0 0 1 10 0c0 3.6-5 8-5 8z"/><circle cx="6" cy="5" r="1.6"/></svg>
        {hovered.state} · {hovered.type || 'University Partner'}
        {#if !hovered.hasRealCoords}<span class="tt-approx" title="Approximate location">~</span>{/if}
      </div>

      <div class="tt-stats">
        <div class="tt-stat">
          <div class="tt-stat-num display">{hovered.positions}</div>
          <div class="tt-stat-lbl">Positions</div>
        </div>
        <div class="tt-stat">
          <div class="tt-stat-num display" style="color:#A8C58A">{hovered.hired || 0}</div>
          <div class="tt-stat-lbl">Hired</div>
        </div>
        <div class="tt-stat">
          <div class="tt-stat-num display" style="color:var(--brand-soft)">{hovered.positions - (hovered.hired || 0)}</div>
          <div class="tt-stat-lbl">Open</div>
        </div>
      </div>

      {#if hovered.totalCtc > 0}
        <div class="tt-ctc">
          <span class="tt-ctc-lbl">Total CTC</span>
          <span class="tt-ctc-val mono">{hovered.totalCtc >= 100 ? '₹' + (Math.round(hovered.totalCtc / 10) / 10).toFixed(1) + ' Cr' : '₹' + (Math.round(hovered.totalCtc * 10) / 10) + ' L'}</span>
        </div>
      {/if}

      {#if hovered.roles && Object.keys(hovered.roles).length}
        <div class="tt-roles">
          {#each Object.entries(hovered.roles) as [role, n]}
            <span class="role-tag">{role} <b>{n}</b></span>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if activeState}
    <button class="zoom-out" on:click={() => onSelectState('')} in:fly={{ y: -8, duration: 240 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 18l-6-6 6-6"/></svg>
      All states
    </button>
    <div class="focus-tag" in:fly={{ y: -8, duration: 240, delay: 80 }}>
      <span class="ft-lbl">Viewing</span>
      <span class="ft-name display">{activeState}</span>
    </div>
  {/if}

  <div class="legend">
    <div class="row gap-sm" style="margin-bottom:4px">
      <span class="dot live"></span>
      <span style="font-size:11.5px;font-weight:700;color:var(--ink)">{positioned.length} unis · {[...new Set(positioned.map(u => u.state))].length} states</span>
    </div>
    <div style="font-size:10.5px;color:var(--ink-3);font-weight:500">
      {activeState ? 'Click "All states" to zoom out' : 'Click any state to zoom in'}
    </div>
  </div>
</div>

<style>
  .map-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    background:
      radial-gradient(900px 700px at 80% 0%, rgba(227, 83, 54, .10), transparent 50%),
      radial-gradient(700px 500px at 10% 100%, rgba(153, 136, 161, .08), transparent 50%),
      var(--surface-soft);
    border-radius: var(--r-lg);
    overflow: visible;          /* tooltip needs to escape when pin is near edge */
    border: 1px solid var(--line);
  }
  .map { width: 100%; height: 100%; display: block; border-radius: var(--r-lg); }

  .state {
    stroke: rgba(26, 15, 8, .35);
    stroke-width: .6;
    stroke-linejoin: round;
    cursor: pointer;
    transition: opacity 600ms var(--ease), fill 600ms var(--ease), stroke 600ms var(--ease), stroke-width 600ms var(--ease);
  }
  .state:hover { fill: var(--brand-soft); stroke: var(--brand); stroke-width: 1; }
  .state.active { stroke: var(--brand-deep); stroke-width: 1; }
  .state.focused { stroke: var(--brand-deep); stroke-width: 2; filter: drop-shadow(0 4px 12px rgba(227, 83, 54, .25)); }
  .state.dimmed { opacity: .12; pointer-events: none; }
  .state:focus { outline: none; }

  /* Map pins — compact teardrop. The outer <g> uses transform="translate"
     for positioning. The inner .pin-shape <g> scales on hover. The .pin-hit
     invisible circle keeps the cursor "on" the pin during hover so we never
     get hover-flicker from the cursor falling out of the shape. */
  .pin {
    cursor: pointer;
    transition: opacity 400ms var(--ease);
  }
  .pin.dimmed { opacity: 0; pointer-events: none; }
  .pin-hit { cursor: pointer; }
  .pin-shape {
    transition: scale 160ms ease-out;
    transform-box: fill-box;
    transform-origin: center bottom;
    scale: 1;
    pointer-events: none;  /* hit-area is handled by .pin-hit only */
  }
  .pin:hover .pin-shape, .pin.hovered .pin-shape, .pin:focus-visible .pin-shape {
    scale: 1.25;
  }
  .pin .pin-body {
    fill: var(--brand);
    stroke: #FFFFFF;
    stroke-width: 1.4;
    stroke-linejoin: round;
    transition: fill 160ms var(--ease), stroke 160ms var(--ease);
  }
  .pin.hired .pin-body { fill: var(--brand-deep); }
  .pin.active .pin-body { fill: var(--ink); stroke: var(--brand); stroke-width: 2; }
  .pin:hover .pin-body, .pin.hovered .pin-body { stroke: var(--ink); stroke-width: 1.6; }
  .pin.approx .pin-body { opacity: .82; }
  .pin:focus { outline: none; }

  .tooltip {
    position: absolute;
    transform: translate(-50%, calc(-100% - 18px));
    background: var(--ink);
    color: #fff;
    border-radius: 16px;
    padding: 16px 18px;
    box-shadow: 0 18px 48px rgba(26, 15, 8, .35), 0 4px 12px rgba(26, 15, 8, .12);
    pointer-events: none;
    z-index: 50;
    min-width: 240px;
    max-width: 300px;
    border: 1px solid var(--brand-soft);
  }
  .tooltip::after {
    content: ""; position: absolute; bottom: -7px; left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 14px; height: 14px;
    background: var(--ink);
    border-right: 1px solid var(--brand-soft);
    border-bottom: 1px solid var(--brand-soft);
  }
  .tt-name { font-size: 18px; line-height: 1.15; font-weight: 700; margin-bottom: 4px; color: var(--brand-soft); }
  .tt-meta { font-size: 11.5px; color: rgba(255,255,255,.7); margin-bottom: 14px; display: flex; align-items: center; gap: 4px; }
  .tt-approx { font-family: var(--font-mono); margin-left: 4px; opacity: .55; cursor: help; }
  .tt-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    padding: 12px 0;
    border-top: 1px solid rgba(255,255,255,.12);
    border-bottom: 1px solid rgba(255,255,255,.12);
  }
  .tt-stat { padding: 0 6px; border-right: 1px solid rgba(255,255,255,.08); }
  .tt-stat:last-child { border-right: 0; }
  .tt-stat-num { font-size: 22px; line-height: 1; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
  .tt-stat-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: rgba(255,255,255,.55); margin-top: 5px; font-weight: 600; }
  .tt-ctc { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.12); }
  .tt-ctc-lbl { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: rgba(255,255,255,.55); font-weight: 600; }
  .tt-ctc-val { font-size: 14px; color: var(--brand-soft); font-weight: 700; }
  .tt-roles { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 12px; }
  .role-tag { background: rgba(255,255,255,.1); color: #fff; padding: 3px 9px; border-radius: 99px; font-size: 10.5px; font-weight: 600; }
  .role-tag b { margin-left: 4px; color: var(--brand-soft); font-weight: 700; }

  .zoom-out {
    position: absolute;
    top: 16px; left: 18px;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px;
    background: var(--ink);
    color: var(--brand-soft);
    border-radius: 99px;
    font-size: 12px; font-weight: 600;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(26, 15, 8, .22);
    z-index: 5;
    transition: transform var(--t-fast) var(--ease);
  }
  .zoom-out:hover { transform: translateY(-1px) scale(1.03); }

  .focus-tag {
    position: absolute;
    top: 16px; right: 18px;
    background: rgba(255, 255, 255, .96);
    backdrop-filter: blur(12px);
    padding: 8px 14px;
    border-radius: 12px;
    border: 1px solid var(--line);
    box-shadow: var(--shadow-sm);
    text-align: right;
    z-index: 5;
  }
  .ft-lbl { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-3); font-weight: 700; margin-bottom: 2px; }
  .ft-name { font-size: 16px; font-weight: 700; color: var(--brand-deep); letter-spacing: -0.01em; }

  .legend {
    position: absolute;
    bottom: 16px; left: 18px;
    background: rgba(255, 255, 255, .96);
    backdrop-filter: blur(12px);
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--line);
    box-shadow: var(--shadow-sm);
    z-index: 5;
  }
</style>
