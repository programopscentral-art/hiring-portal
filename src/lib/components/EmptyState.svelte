<script>
  export let title = 'Nothing here yet.';
  export let body = '';
  export let actionLabel = '';
  export let actionHref = '';
</script>

<div class="empty-state card">
  <div class="ill">
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4">
      <circle cx="32" cy="32" r="28" stroke-dasharray="4 4" opacity=".25"/>
      <path d="M22 28h20M22 36h12" stroke-linecap="round"/>
      <circle cx="32" cy="22" r="4" />
    </svg>
  </div>
  <div class="ttl serif">{title}</div>
  {#if body}<div class="muted body">{body}</div>{/if}
  {#if actionLabel && actionHref}
    <a class="btn brand" href={actionHref}>{actionLabel}</a>
  {/if}
</div>

<style>
  .empty-state {
    padding: 48px 32px;
    text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    background: var(--surface-soft);
  }
  .ill { color: var(--ink-3); margin-bottom: 6px; }
  .ill :global(svg) { width: 64px; height: 64px; }
  .ttl { font-size: 22px; }
  .body { max-width: 460px; }
</style>
