export function cellText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function quote(s) {
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(rows, columns, opts = {}) {
  const eol = opts.eol ?? '\n';
  const data = rows ?? [];
  let cols = columns;
  if (!cols) { const seen = new Set(); for (const r of data) for (const k of Object.keys(r ?? {})) seen.add(k); cols = [...seen]; }
  const defs = cols.map(c => typeof c === 'string' ? { key: c, label: c } : { key: c.key, label: c.label ?? c.key, get: c.get });
  const line = cells => cells.length === 1 && cellText(cells[0]) === '' ? '""' : cells.map(v => quote(cellText(v))).join(',');
  const out = [line(defs.map(d => d.label))];
  for (const r of data) out.push(line(defs.map(d => d.get ? d.get(r) : r?.[d.key])));
  return out.join(eol) + eol;
}

export function parseCsv(text) {
  const s = String(text ?? '').replace(/^﻿/, ''), recs = [];
  let rec = [], field = '', i = 0, quoted = false, any = false;
  while (i < s.length) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i += 2; continue; } quoted = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === '') { quoted = true; any = true; i++; continue; }
    if (ch === ',') { rec.push(field); field = ''; any = true; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      i++;
      if (any || field !== '' || rec.length) { rec.push(field); recs.push(rec); }
      rec = []; field = ''; any = false; continue;
    }
    field += ch; i++;
  }
  if (any || field !== '' || rec.length) { rec.push(field); recs.push(rec); }
  const header = recs.shift() ?? [];
  return { header, rows: recs, objects: recs.map(r => Object.fromEntries(header.map((h, k) => [h, r[k] ?? '']))) };
}
