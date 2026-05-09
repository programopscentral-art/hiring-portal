// Sheet URL handling.
// Supports: Apps Script /exec, published-CSV /pub, regular share URL with /d/ID.
//
// For plain share URLs we use the `export?format=csv` endpoint (more reliable
// than gviz/tq, which returns 0 bytes for some sheets). Both work for sheets
// shared as "anyone with the link can view".

export function buildFetchUrl(input, opts = {}) {
  const t = (input || '').trim();
  if (!t) return null;

  // Apps Script web app deployment (works for private sheets via the proxy)
  if (/script\.google\.com\/macros\/s\//.test(t)) {
    let url = t;
    if (opts.sheet) url += (url.includes('?') ? '&' : '?') + 'sheet=' + encodeURIComponent(opts.sheet);
    return url;
  }

  // Already a published-to-web CSV URL
  if (/\/pub(?:\?|\/)/.test(t) && /(?:output|format)=csv/.test(t)) return t;
  if (/\/pub(?:\?|\/)/.test(t)) {
    return t.includes('?') ? t + '&output=csv' : t + '?output=csv';
  }

  // Regular share URL — extract sheet ID
  const m = t.match(/\/d\/([a-zA-Z0-9-_]+)/) || t.match(/^([a-zA-Z0-9-_]{30,})$/);
  if (!m) return null;
  const id = m[1];

  // Pick gid from explicit opts, then from URL hash/query
  const gid = opts.gid != null
    ? String(opts.gid)
    : (t.match(/[#&?]gid=(\d+)/)?.[1] || '');

  let url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  if (gid) url += `&gid=${gid}`;
  return url;
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
