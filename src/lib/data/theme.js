import { writable } from 'svelte/store';

const KEY = 'programops-theme';

function readInitial() {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  // Fall back to OS preference
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export const theme = writable('light');

export function applyTheme(t) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(KEY, t); } catch {}
}

export function initTheme() {
  const initial = readInitial();
  theme.set(initial);
  applyTheme(initial);
}

export function toggleTheme() {
  theme.update(t => {
    const next = t === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return next;
  });
}
