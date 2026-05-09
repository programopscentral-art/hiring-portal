// localStorage helpers — guarded for SSR
const KEY = 'programops-hiring-portal-v1';

export function loadConfig() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveConfig(cfg) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
}

export function clearConfig() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(KEY); } catch {}
}
