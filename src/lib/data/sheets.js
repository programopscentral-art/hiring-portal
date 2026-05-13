// Sheet URL handling.
// Supports: Apps Script /exec, published-CSV /pub, regular share URL with /d/ID.

export function buildFetchUrl(input, opts = {}) {
  const t = (input || '').trim();
  if (!t) return null;

  if (/script\.google\.com\/macros\/s\//.test(t)) {
    let url = t;
    if (opts.sheet) url += (url.includes('?') ? '&' : '?') + 'sheet=' + encodeURIComponent(opts.sheet);
    return url;
  }

  if (/\/pub(?:\?|\/)/.test(t) && /(?:output|format)=csv/.test(t)) return t;
  if (/\/pub(?:\?|\/)/.test(t)) {
    return t.includes('?') ? t + '&output=csv' : t + '?output=csv';
  }

  const m = t.match(/\/d\/([a-zA-Z0-9-_]+)/) || t.match(/^([a-zA-Z0-9-_]{30,})$/);
  if (!m) return null;
  const id = m[1];

  const gid = opts.gid != null
    ? String(opts.gid)
    : (t.match(/[#&?]gid=(\d+)/)?.[1] || '');

  let url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  if (gid) url += `&gid=${gid}`;
  return url;
}

export function extractSheetId(input) {
  const m = (input || '').match(/\/d\/([a-zA-Z0-9-_]+)/) || (input || '').match(/^([a-zA-Z0-9-_]{30,})$/);
  return m ? m[1] : null;
}

export async function fetchSheetCSV(url, opts = {}) {
  const fetchUrl = buildFetchUrl(url, opts);
  if (!fetchUrl) throw new Error('Could not parse the sheet URL.');
  const cacheBust = (fetchUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const res = await fetch(fetchUrl + cacheBust, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();
  if (text.trim().startsWith('<')) {
    throw new Error('Got HTML instead of CSV. Either: (1) sheet is private — use the Apps Script proxy, or (2) share it as "Anyone with the link can view".');
  }
  return text;
}

/**
 * Fetch a sheet, and if the result is empty/uninformative, fall back to
 * scanning every tab in the sheet to find the one that matches the test.
 * @param {string} url    The share URL
 * @param {(text: string) => boolean} isValidContent  Returns true if the CSV
 *                                                    has the data we want.
 * @returns {Promise<{ text: string, foundGid: string | null }>}
 */
export async function fetchWithTabFallback(url, isValidContent) {
  // 1. Try the URL as given (uses #gid= if present, else default tab)
  let text = '';
  try { text = await fetchSheetCSV(url); } catch { text = ''; }
  if (isValidContent(text)) return { text, foundGid: null };

  // 2. Discover every tab in the sheet via htmlview
  const id = extractSheetId(url);
  if (!id) return { text, foundGid: null };

  let html = '';
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/htmlview?_t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) html = await res.text();
  } catch {}

  const gids = [...new Set([...html.matchAll(/gid=(\d+)/g)].map(m => m[1]))];

  // 3. Try each tab; stop at first match
  for (const gid of gids) {
    let t = '';
    try { t = await fetchSheetCSV(url, { gid }); } catch { continue; }
    if (isValidContent(t)) {
      return { text: t, foundGid: gid };
    }
  }

  return { text, foundGid: null };
}
