<script>
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  export let university;
  export let active = false;
  export let onSelect = () => {};
  export let index = 0;

  $: progress = university.positions ? Math.round(((university.hired || 0) / university.positions) * 100) : 0;
  $: open = university.positions - (university.hired || 0);

  function initialsFor(name) {
    const words = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    if (words.length === 1) {
      const w = words[0];
      const isAcronym = /^[A-Z][A-Z0-9.]*$/.test(w);
      return (isAcronym ? w.slice(0, 4) : w.slice(0, 2)).toUpperCase();
    }
    const stop = new Set(['of', 'the', 'and', 'for', 'a', 'an']);
    const real = words.filter(w => !stop.has(w.toLowerCase()));
    return ((real[0]?.[0] || '') + (real[1]?.[0] || '')).toUpperCase();
  }
  $: initials = initialsFor(university.name);

  // Tuscan Sunset palette variants per university
  const PALETTES = [
    { bg: 'var(--brand)',      fg: '#fff',                 deco: 'var(--brand-deep)' },     // terracotta
    { bg: 'var(--brand-soft)', fg: 'var(--brand-darker)',  deco: 'var(--brand)' },           // peach
    { bg: 'var(--mauve)',      fg: '#fff',                 deco: 'var(--mauve-deep)' },     // dusty mauve
    { bg: 'var(--brand-deep)', fg: 'var(--brand-soft)',    deco: 'var(--brand)' },           // deep rust
    { bg: 'var(--ink)',        fg: 'var(--brand-soft)',    deco: 'var(--brand)' },           // ink
  ];
  function paletteFor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return PALETTES[h % PALETTES.length];
  }
  $: palette = paletteFor(university.name);

  function fmtCtc(n) {
    if (!n) return '';
    const r = Math.round(n * 10) / 10;
    if (r >= 100) return `₹${(r / 100).toFixed(1)}Cr`;
    return `₹${r}L`;
  }
</script>

<button
  class="uni"
  class:active
  class:hired={university.hired > 0}
  on:click={onSelect}
  in:fly={{ y: 16, delay: index * 25, duration: 480, easing: quintOut }}
>
  <!-- Top color block -->
  <div class="thumb" style="background:{palette.bg};color:{palette.fg}">
    <div class="thumb-deco" style="background:{palette.deco}"></div>
    <div class="thumb-deco-2" style="border-color:{palette.deco}"></div>

    <div class="state-tag">
      <svg width="9" height="11" viewBox="0 0 12 14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 13s-5-4.4-5-8a5 5 0 0 1 10 0c0 3.6-5 8-5 8z"/><circle cx="6" cy="5" r="1.6"/></svg>
      {university.state}
    </div>

    {#if university.hired > 0}
      <div class="hired-badge">
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 8l4 4 6-8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        {university.hired} hired
      </div>
    {/if}

    <div class="initials display">{initials}</div>

    {#if university.totalCtc}
      <div class="ctc-tag">{fmtCtc(university.totalCtc)} pkg</div>
    {/if}
  </div>

  <!-- Body -->
  <div class="body">
    <h3 class="name">{university.name}</h3>

    {#if Object.keys(university.roles || {}).length}
      <div class="roles">
        {#each Object.entries(university.roles) as [role, n]}
          <span class="role-pill">{role} <span class="role-count">{n}</span></span>
        {/each}
      </div>
    {/if}

    <div class="stats">
      <div class="stat">
        <div class="stat-num display">{university.positions}</div>
        <div class="stat-lbl">Positions</div>
      </div>
      <div class="stat">
        <div class="stat-num display" style="color:var(--ok)">{university.hired || 0}</div>
        <div class="stat-lbl">Hired</div>
      </div>
      <div class="stat">
        <div class="stat-num display" style="color:var(--brand)">{open}</div>
        <div class="stat-lbl">Open</div>
      </div>
    </div>

    <div class="progress">
      <div class="prog-track"><div class="prog-fill" style="width:{progress}%"></div></div>
      <span class="prog-pct mono">{progress}%</span>
    </div>
  </div>
</button>

<style>
  .uni {
    display: flex; flex-direction: column;
    text-align: left;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    overflow: hidden;
    cursor: pointer;
    transition: all var(--t-base) var(--ease);
    box-shadow: var(--shadow-xs);
    width: 100%;
    color: inherit;
    padding: 0;
  }
  .uni:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
    border-color: var(--brand);
  }
  .uni.active {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px var(--brand-soft), var(--shadow-md);
  }

  /* Thumb header (color block) */
  .thumb {
    position: relative;
    height: 150px;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .thumb-deco {
    position: absolute;
    width: 130px; height: 130px;
    border-radius: 50%;
    bottom: -65px; right: -50px;
    opacity: .35;
    transition: transform var(--t-slow) var(--ease);
  }
  .thumb-deco-2 {
    position: absolute;
    width: 80px; height: 80px;
    top: -30px; left: -25px;
    border: 2px solid;
    border-radius: 16px;
    opacity: .25;
    transform: rotate(20deg);
    transition: transform var(--t-slow) var(--ease);
  }
  .uni:hover .thumb-deco { transform: scale(1.15) translate(-10px, -10px); }
  .uni:hover .thumb-deco-2 { transform: rotate(35deg) scale(1.1); }

  .state-tag {
    position: absolute; top: 14px; left: 14px;
    display: inline-flex; align-items: center; gap: 5px;
    background: rgba(255, 255, 255, .92);
    color: var(--ink);
    padding: 5px 10px;
    border-radius: 99px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: .02em;
    z-index: 2;
  }
  .hired-badge {
    position: absolute; top: 14px; right: 14px;
    display: inline-flex; align-items: center; gap: 5px;
    background: var(--ink);
    color: var(--brand-soft);
    padding: 5px 10px;
    border-radius: 99px;
    font-size: 10.5px;
    font-weight: 700;
    z-index: 2;
  }
  .initials {
    position: relative;
    font-size: clamp(40px, 22cqw, 64px);
    line-height: 1;
    letter-spacing: -0.045em;
    font-weight: 700;
    z-index: 1;
    transition: transform var(--t-slow) var(--ease);
  }
  .uni:hover .initials { transform: scale(1.08) rotate(-3deg); }

  .ctc-tag {
    position: absolute; bottom: 14px; right: 14px;
    background: rgba(0, 0, 0, .12);
    backdrop-filter: blur(6px);
    color: inherit;
    padding: 5px 10px;
    border-radius: 99px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    z-index: 2;
  }

  /* Body */
  .body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
  .name {
    font-family: var(--font-display);
    font-size: 19px;
    line-height: 1.2;
    letter-spacing: -0.015em;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
    overflow: hidden;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }

  .roles { display: flex; flex-wrap: wrap; gap: 4px; }
  .role-pill {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 4px 3px 10px;
    background: var(--surface-sunk);
    color: var(--ink-2);
    border-radius: 99px;
    font-size: 10.5px;
    font-weight: 700;
  }
  .role-count {
    background: var(--ink);
    color: var(--brand-soft);
    font-family: var(--font-mono);
    font-size: 9.5px;
    padding: 1px 7px;
    border-radius: 99px;
    font-weight: 700;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding: 12px 0;
    border-top: 1px solid var(--line-soft);
    border-bottom: 1px solid var(--line-soft);
  }
  .stat { padding: 0 4px; border-right: 1px solid var(--line-soft); }
  .stat:last-child { border-right: 0; }
  .stat-num { font-size: 22px; line-height: 1; color: var(--ink); font-weight: 700; letter-spacing: -0.02em; }
  .stat-lbl { font-size: 9.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); margin-top: 6px; font-weight: 700; }

  .progress { display: flex; align-items: center; gap: 12px; }
  .prog-track { flex: 1; height: 6px; background: var(--surface-sunk); border-radius: 99px; overflow: hidden; }
  .prog-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--brand) 0%, var(--brand-deep) 100%);
    border-radius: 99px;
    transition: width 600ms var(--ease);
  }
  .uni.hired .prog-fill { background: linear-gradient(90deg, var(--ok) 0%, #4A5634 100%); }
  .prog-pct { font-size: 11px; color: var(--ink); font-weight: 700; min-width: 36px; text-align: right; }
</style>
