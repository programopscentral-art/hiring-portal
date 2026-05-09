<script>
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  export let value = 0;
  export let duration = 900;
  export let format = (n) => Math.round(n).toLocaleString();
  const t = tweened(0, { duration, easing: cubicOut });
  $: t.set(Number(value) || 0);
</script>

<span>{format($t)}</span>
