<script>
  export let values = [];
  export let color = 'var(--brand)';
  export let height = 36;
  $: max = Math.max(1, ...values);
  $: w = 120;
  $: pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w;
    const y = height - (v / max) * (height - 4) - 2;
    return [x, y];
  });
  $: path = pts.length ? pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') : '';
  $: area = pts.length ? `${path} L ${w} ${height} L 0 ${height} Z` : '';
</script>

<svg viewBox="0 0 {w} {height}" width="100%" height={height} preserveAspectRatio="none">
  <defs>
    <linearGradient id="grad-{color.replace(/[^a-z0-9]/gi,'')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color={color} stop-opacity="0.25"/>
      <stop offset="100%" stop-color={color} stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path d={area} fill="url(#grad-{color.replace(/[^a-z0-9]/gi,'')})" />
  <path d={path} fill="none" stroke={color} stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
