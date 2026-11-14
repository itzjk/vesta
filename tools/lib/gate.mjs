// VESTA build · gate.mjs
// The build-time gates of DESIGN.md 3.2. A record that fails does not ship and is listed in engine.json.
//   1 quote gate (research/tools/quotecheck.py, one run)   2 sentence rule (context, cut_before_qualifier)
//   3 conditions gate   4 row gate (table findings)   5 rule gate   6 references
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// --- the script's normalisation, mirrored (NFKC, curly quotes and long dashes folded, soft hyphen removed, white space collapsed)
const FOLD = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '−': '-', '‐': '-', '‑': '-', '­': '' };
const FOLD_RE = /[‘’“”–—−‐‑­]/g;
const WS = '\\t\\n\\v\\f\\r \\x1c-\\x1f\\x85\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';   // Python's \s for str
const WS_RUN = new RegExp(`[${WS}]+`, 'g'), WS_TRIM = new RegExp(`^[${WS}]+|[${WS}]+$`, 'g');
const fold = s => String(s ?? '').normalize('NFKC').replace(FOLD_RE, c => FOLD[c]);
export const norm = s => fold(s).replace(WS_RUN, ' ').replace(WS_TRIM, '');

// --- 1. quote gate ------------------------------------------------------------------------------------------------------
// rows: [{ id, quote, source: { kind, text_file } }]. Returns Map id -> { pass, why }. Throws when the script cannot run.
export function runQuoteGate(rows, root) {
  const res = new Map();
  if (!rows.length) return res;
  const script = path.join(root, 'research', 'tools', 'quotecheck.py');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vesta-gate-'));
  const input = path.join(dir, 'quotes.json'), report = path.join(dir, 'report.json');
  try {
    fs.writeFileSync(input, JSON.stringify({ findings: rows.map(r => ({ id: r.id, quote: r.quote, source: { kind: r.source?.kind ?? null, text_file: r.source?.text_file ?? null } })) }));
    try { execFileSync('python3', [script, input, '--report', report], { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 26 }); }
    catch (e) { if (!fs.existsSync(report)) throw new Error(`quote gate did not run: ${String(e.stderr || e.message).slice(0, 300)}`); }   // exit 1 = some row failed
    const out = JSON.parse(fs.readFileSync(report, 'utf8'));
    for (const r of out.rows) res.set(r.id, { pass: r.pass === true, why: r.pass === true ? null : (r.why || 'quote not found verbatim in cached text') });
    for (const r of rows) if (!res.has(r.id)) res.set(r.id, { pass: false, why: 'no answer from the quote gate' });
    return res;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// --- 2. sentence rule ---------------------------------------------------------------------------------------------------
export const QUALIFIERS = ['however', 'but', 'although', 'though', 'except', 'unless', 'whereas', 'while', 'yet'];
const QUAL_RE = new RegExp(`^(?:${QUALIFIERS.join('|')})\\b`, 'i');
export const startsWithQualifier = after => QUAL_RE.test(String(after ?? '').replace(/^[\s,;:\-"'(]+/, ''));

const BREAK = '';                                                    // paragraph break or bullet: a sentence never crosses it
const MAX_CONTEXT = 300;
// The cached text, normalised as the script does, with BREAK where a blank line, a bullet, a heading or a header line stands.
function marked(raw) {
  let s = fold(raw).replace(/\r\n?/g, '\n');
  s = s.replace(/^(?:https?:\/\/\S+|[A-Z][A-Z-]{2,}:.*|#+ .*)$/gm, m => `${BREAK} ${m} ${BREAK}`)   // url line, "TITLE: ..." lines, markdown headings
       .replace(/\n[ \t]*(?:\n[ \t]*)+/g, ` ${BREAK} `)                                            // blank lines
       .replace(/(^|\n)[ \t]*[•●▪■◦‣⁃∙*][ \t]+/g, `$1${BREAK} `);   // bullets
  return s.replace(WS_RUN, ' ').replace(WS_TRIM, '');
}
const isEnd = (s, i) => (s[i] === '.' || s[i] === '?' || s[i] === '!') && (i + 1 >= s.length || s[i + 1] === ' ' || (/["')\]]/.test(s[i + 1]) && (i + 2 >= s.length || s[i + 2] === ' ')));
const clip = (s, fromStart) => {
  if (s.length <= MAX_CONTEXT) return s;
  if (fromStart) { const cut = s.slice(0, MAX_CONTEXT - 2), k = cut.lastIndexOf(' '); return (k > 200 ? cut.slice(0, k) : cut) + ' …'; }
  const cut = s.slice(s.length - MAX_CONTEXT + 2), k = cut.indexOf(' '); return '… ' + (k >= 0 && k < 100 ? cut.slice(k + 1) : cut);
};

export class Texts {                                                       // cache of cached texts, read once
  constructor(root) { this.root = root; this.m = new Map(); }
  get(textFile) {
    if (!this.m.has(textFile)) {
      let v = null;
      try { const raw = fs.readFileSync(path.join(this.root, 'research', textFile), 'utf8'); v = { plain: norm(raw), marked: marked(raw) }; } catch { v = null; }
      this.m.set(textFile, v);
    }
    return this.m.get(textFile);
  }
}
// The rest of the quote's sentence on each side: to the nearest ". ", "? ", "! ", bullet, paragraph break or text edge.
// Returns { found, before, after }.
export function sentenceContext(texts, textFile, quote) {
  const t = texts.get(textFile), q = norm(quote);
  if (!t || !q) return { found: false, before: '', after: '' };
  let s = t.marked, i = s.indexOf(q);
  if (i < 0) { s = t.plain; i = s.indexOf(q); }                            // the quote crosses a break: fall back to the plain text
  if (i < 0) return { found: false, before: '', after: '' };
  const end = i + q.length;
  let a = i;
  while (a > 0) { const c = s[a - 1]; if (c === BREAK) break; if (c === ' ' && a >= 2 && (isEnd(s, a - 2) || (/["')\]]/.test(s[a - 2]) && a >= 3 && /[.?!]/.test(s[a - 3])))) break; a--; }
  let b = end;
  if (end > 0 && /[.?!]/.test(s[end - 1]) && (end >= s.length || s[end] === ' ')) b = end;      // the quote ends its sentence
  else { while (b < s.length) { if (s[b] === BREAK) break; if (isEnd(s, b)) { b++; break; } b++; } }
  const strip = x => x.split(BREAK).join(' ').replace(/ +/g, ' ');
  return { found: true, before: clip(strip(s.slice(a, i)).replace(/^ +/, ''), false), after: clip(strip(s.slice(end, b)).replace(/ +$/, ''), true) };
}

export function gateSentences(rows, gates, texts) {
  const rejected = [], cut_before_qualifier = [];
  for (const q of rows) {
    if (!gates.get(q.id)?.pass) { rejected.push({ id: q.id, why: gates.get(q.id)?.why, quote: q.quote }); continue; }
    if (q.source?.kind === 'challenge-page') continue;
    const context = sentenceContext(texts, q.source?.text_file, q.quote);
    if (!context.found || startsWithQualifier(context.after)) {
      const why = context.found ? 'cut_before_qualifier' : 'sentence_context_not_found';
      gates.set(q.id, { pass: false, why });
      rejected.push({ id: q.id, why, quote: q.quote });
      if (why === 'cut_before_qualifier') cut_before_qualifier.push({ id: q.id, after: context.after });
    }
  }
  return { rejected, cut_before_qualifier };
}

// --- 3. conditions gate -------------------------------------------------------------------------------------------------
const NUM = '(\\d+(?:\\.\\d+)?)';
const P_UNITS = { psia: 6.89476, psi: 6.89476, atm: 101.325, kpa: 1, mmhg: 0.133322, bar: 100 };
const P_UNIT_RE = '(psia|psi|atm|kPa|mmHg|bar)';
const r1 = x => Math.round(x * 10) / 10;
export const toKpa = (value, unit) => r1(value * P_UNITS[String(unit).toLowerCase()]);

// What the finding says about oxygen, as numbers: { kind: 'none' } | { kind: 'number', values: [x] } | { kind: 'range', values: [lo, hi] } | { kind: 'unparsed' }
export function parseO2Claim(v) {
  if (v == null || v === '') return { kind: 'none' };
  if (typeof v === 'number') return Number.isFinite(v) ? { kind: 'number', values: [v] } : { kind: 'unparsed' };
  const s = String(v).trim();
  let m = s.match(new RegExp(`^~?\\s*${NUM}\\s*(?:%|percent)?$`, 'i'));
  if (m) return { kind: 'number', values: [parseFloat(m[1])] };
  m = s.match(new RegExp(`^${NUM}\\s*%?\\s*(?:-|to)\\s*${NUM}\\s*(?:%|percent)?$`, 'i'));
  if (m) { const a = parseFloat(m[1]), b = parseFloat(m[2]); return { kind: 'range', values: [Math.min(a, b), Math.max(a, b)] }; }
  return { kind: 'unparsed' };
}
// What the finding says about pressure: values are { value, unit } pairs.
export function parsePressureClaim(v) {
  if (v == null || v === '') return { kind: 'none' };
  const s = String(v).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();                   // "56.5 kPa (8.2 psia)" -> "56.5 kPa"
  let m = s.match(new RegExp(`^~?\\s*${NUM}\\s*${P_UNIT_RE}$`, 'i'));
  if (m) return { kind: 'number', values: [{ value: parseFloat(m[1]), unit: m[2] }] };
  m = s.match(new RegExp(`^${NUM}\\s*(?:-|to)\\s*${NUM}\\s*${P_UNIT_RE}$`, 'i'));
  if (m) return { kind: 'range', values: [{ value: parseFloat(m[1]), unit: m[3] }, { value: parseFloat(m[2]), unit: m[3] }] };
  return { kind: 'unparsed' };
}
// Numbers that stand in the text as "<number>%" or "<number> percent" (also the first number of "17 to 21%").
export function o2NumbersIn(text) {
  const out = [];
  for (const m of text.matchAll(new RegExp(`(?<![\\d./])${NUM}\\s*(?:%|percent)`, 'gi'))) out.push(parseFloat(m[1]));
  for (const m of text.matchAll(new RegExp(`(?<![\\d./])${NUM}\\s*(?:-|to|and)\\s*${NUM}\\s*(?:%|percent)`, 'gi'))) out.push(parseFloat(m[1]));
  return out;
}
export const mentionsOxygen = text => /oxygen/i.test(text) || /\bO ?2\b/.test(text);
// Pressures that stand in the text as "<number> <unit>" (also the first number of "0.5 to 1 atm").
export function pressuresIn(text) {
  const out = [];
  for (const m of text.matchAll(new RegExp(`(?<![\\d./])${NUM}\\s*${P_UNIT_RE}\\b`, 'gi'))) out.push({ value: parseFloat(m[1]), unit: m[2].toLowerCase() });
  for (const m of text.matchAll(new RegExp(`(?<![\\d./])${NUM}\\s*(?:-|to|and)\\s*${NUM}\\s*${P_UNIT_RE}\\b`, 'gi'))) out.push({ value: parseFloat(m[1]), unit: m[3].toLowerCase() });
  return out;
}
const samePUnit = (a, b) => { a = a.toLowerCase(); b = b.toLowerCase(); return a === b || (a.startsWith('psi') && b.startsWith('psi')); };

const G_WORDS = {
  micro:   [/microgravity/i, /\bin space\b/i, /spaceflight/i, /space station/i, /\bon orbit\b/i, /\bin orbit\b/i, /\bISS\b/],
  partial: [/partial gravity/i, /lunar gravity/i, /\bon the Moon\b/i, /(?<![\d.])1\/6(?!\d)/, /3\/8-g/i],
  normal:  [/normal gravity/i, /(?<![\w.-])1-g\b/i, /\bon Earth\b/i] };
const G_OWN = { 'microgravity': 'micro', '1 g': 'normal', 'normal gravity': 'normal', 'partial gravity': 'partial' };   // exact strings only
export const gravityWordsIn = text => Object.keys(G_WORDS).filter(k => G_WORDS[k].some(re => re.test(text)));

// f: the finding as delivered. text: quote + " " + conditions_quote (the verbatim text the numbers must stand in).
// ctx: { work, psi_gclass } (the class of the linked PSI record, or null).
// Returns { o2, p, gclass, dropped: [{ field, value, why }] }.
export function conditionsGate(f, text, ctx) {
  const c = f.conditions ?? {}, dropped = [];
  let o2 = null, p = null, gclass = null;
  const oc = parseO2Claim(c.o2_percent);
  if (oc.kind === 'unparsed') dropped.push({ field: 'o2', value: c.o2_percent, why: 'the value is not one number or one range in percent' });
  else if (oc.kind !== 'none') {
    const inText = o2NumbersIn(text), has = x => inText.some(y => Math.abs(y - x) < 1e-9);
    if (!oc.values.every(has)) dropped.push({ field: 'o2', value: c.o2_percent, why: 'the number is not in the quote' });
    else if (!mentionsOxygen(text)) dropped.push({ field: 'o2', value: c.o2_percent, why: 'the quote has the number but does not name oxygen' });
    else o2 = oc.kind === 'number' ? oc.values[0] : oc.values;
  }
  const pc = parsePressureClaim(c.pressure);
  if (pc.kind === 'unparsed') dropped.push({ field: 'pressure', value: c.pressure, why: 'the value is not one number or one range with a unit (psia, psi, atm, kPa, mmHg, bar)' });
  else if (pc.kind !== 'none') {
    const inText = pressuresIn(text), has = x => inText.some(y => Math.abs(y.value - x.value) < 1e-9 && samePUnit(y.unit, x.unit));
    if (!pc.values.every(has)) dropped.push({ field: 'pressure', value: c.pressure, why: 'the number with its unit is not in the quote' });
    else { const k = pc.values.map(x => toKpa(x.value, x.unit)); p = pc.kind === 'number' ? k[0] : [Math.min(...k), Math.max(...k)]; }
  }
  if (ctx.work === 'normal_g') gclass = 'normal';
  else if (ctx.psi_gclass && ctx.work === 'flight') gclass = ctx.psi_gclass;
  else {
    const classes = gravityWordsIn(text);
    if (classes.length === 1) gclass = classes[0];
    else if (classes.length > 1) { const own = G_OWN[String(c.gravity ?? '').trim().toLowerCase()]; gclass = own && classes.includes(own) ? own : null; }
  }
  if (gclass == null && c.gravity != null && String(c.gravity).trim() !== '')
    dropped.push({ field: 'gravity', value: c.gravity, why: 'no gravity word of one class in the quote, and no flight record to read it from' });
  return { o2, p, gclass, dropped };
}

// --- 4. row gate (table findings) ---------------------------------------------------------------------------------------
// Each cells[] entry { row_id, column, raw } must equal tests[row_id].raw[column] after trimming.
export function rowGate(f, rowById) {
  const cells = Array.isArray(f.cells) ? f.cells : [], bad = [];
  if (!cells.length) return { pass: false, why: 'a table finding with no cells', bad };
  for (const c of cells) {
    const row = rowById.get(c.row_id);
    if (!row) { bad.push({ ...c, why: 'no such row' }); continue; }
    const have = row.raw?.[c.column];
    if (have === undefined) { bad.push({ ...c, why: 'no such column in the row' }); continue; }
    if (String(have).trim() !== String(c.raw ?? '').trim()) bad.push({ ...c, found: have, why: 'the cell does not hold this text' });
  }
  for (const id of f.row_ids ?? []) if (!rowById.has(id)) bad.push({ row_id: id, why: 'no such row' });
  return bad.length ? { pass: false, why: `${bad.length} cell(s) do not match the PSI table`, bad } : { pass: true, why: null, bad };
}

// --- 5. rule gate -------------------------------------------------------------------------------------------------------
// A rule ships when at least one of its finding_ids is verified. Unverified ids are removed and listed.
export function ruleGate(rules, findingById) {
  const shipped = [], dropped = [], removed = [];
  for (const r of rules) {
    const ids = Array.isArray(r.finding_ids) ? r.finding_ids : [], ok = ids.filter(id => findingById.has(id)), gone = ids.filter(id => !findingById.has(id));
    for (const id of gone) removed.push({ rule: r.id, finding_id: id });
    if (!ok.length) { dropped.push({ id: r.id, why: 'no verified finding left', finding_ids: ids }); continue; }
    const earth = r.earth_instinct_finding_id && findingById.has(r.earth_instinct_finding_id) ? r.earth_instinct_finding_id : null;
    if (r.earth_instinct_finding_id && !earth) removed.push({ rule: r.id, finding_id: r.earth_instinct_finding_id, field: 'earth_instinct_finding_id' });
    shipped.push({ ...r, finding_ids: ok, earth_instinct_finding_id: earth });
  }
  return { shipped, dropped, removed };
}

// --- 6. references ------------------------------------------------------------------------------------------------------
// refs: [{ file, where, id, space }] with space in finding | rule | protocol | step | preset.
// known[space]: ids that exist somewhere (shipped or rejected). shipped[space]: ids that shipped.
// pending[space]: true while the authored file that defines that id space is not there yet.
export function checkReferences(refs, known, shipped, pending = {}) {
  const dangling = [], warnings = [];
  for (const r of refs) {
    if (r.id == null || r.id === '') continue;
    if (shipped[r.space]?.has(r.id)) continue;
    if (known[r.space]?.has(r.id)) { warnings.push({ kind: 'reference_to_rejected', ...r }); continue; }
    if (pending[r.space]) { warnings.push({ kind: 'reference_pending', ...r }); continue; }
    dangling.push(r);
  }
  return { dangling, warnings };
}
