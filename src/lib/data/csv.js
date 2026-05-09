// RFC4180-ish CSV parser. Handles quoted fields, embedded commas / newlines / quotes.
export function parseCSV(text) {
  const rows = [];
  let cur = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); rows.push(row); row = []; cur = '';
      } else cur += c;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// Strip empty trailing cells & blank rows
export function trim2D(rows) {
  return rows
    .map(r => r.map(c => (c ?? '').toString().trim().replace(/\s+/g, ' ')))
    .filter(r => r.some(c => c !== ''));
}

export function toCSVRow(arr) {
  return arr.map(v => {
    v = v == null ? '' : String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }).join(',');
}

export function toCSV(rows) {
  return rows.map(toCSVRow).join('\r\n') + '\r\n';
}
