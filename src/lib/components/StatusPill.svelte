<script>
  export let decision = '';
  export let label = '';

  $: cls = decision === 'selected' ? 'sp-ok'
         : decision === 'rejected' ? 'sp-bad'
         : decision === 'hold' ? 'sp-warn'
         : decision === 'rescheduled' ? 'sp-mauve'
         : decision === 'pending' ? 'sp-pending'
         : 'sp-info';
  $: text = label || (decision ? (decision.charAt(0).toUpperCase() + decision.slice(1)) : '—');
</script>

<span class="sp {cls}">{text}</span>

<style>
  .sp {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 99px;
    font-size: 10.5px;
    font-weight: 700;
    line-height: 1.4;
    letter-spacing: .02em;
    white-space: nowrap;
    text-align: center;
    vertical-align: middle;
  }
  .sp-pending { background: var(--surface-sunk); color: var(--ink-2); }
  .sp-info    { background: var(--info-soft); color: var(--mauve-deep); }
  .sp-ok      { background: var(--ok-soft); color: #4A5634; }
  .sp-warn    { background: var(--warn-soft); color: #6E5022; }
  .sp-bad     { background: var(--bad-soft); color: var(--bad); }
  .sp-mauve   { background: var(--mauve-soft); color: var(--mauve-deep); }
</style>
