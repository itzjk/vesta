#!/usr/bin/env node
// Writes web/feed/ntrs.json: a snapshot of the newest NTRS records for the phrases in config/feed-terms.json.
// NTRS sends no CORS header, so a browser cannot call it; this script runs at release (and from a scheduled
// workflow once publishing is approved) and the site reads the committed file.
//
//   node tools/ntrs-feed.mjs                 call the NTRS API; fall back to the local index when the network fails
//   node tools/ntrs-feed.mjs --offline       build the file from research/ntrs-index.json (no network)
//   node tools/ntrs-feed.mjs --out <file>    write somewhere else (default web/feed/ntrs.json)
//   node tools/ntrs-feed.mjs --check         validate the existing file and exit (0 valid, 1 not)
//
// Node 20 or newer, no packages. Nothing in the feed enters the evidence base: an item is only tagged
// in_evidence_base when its id is already a source of a verified finding (web/data/sources.json).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (k) => args.includes('--' + k);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const OUT = path.resolve(opt('out', path.join(ROOT, 'web/feed/ntrs.json')));
export const SCHEMA = 'vesta.ntrs-feed/1';

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ISO time with the US Eastern offset, e.g. 2026-11-14T17:30:00-05:00 (the product prints its times in EST/EDT).
export function easternIso(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'longOffset' })
    .formatToParts(date).map((p) => [p.type, p.value]));
  const off = (parts.timeZoneName || 'GMT-05:00').replace('GMT', '') || '+00:00';
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${off}`;
}

// Ids of the sources that already back a verified finding. Without web/data the answer is unknown, never guessed.
function evidenceIds() {
  const p = path.join(ROOT, 'web/data/sources.json');
  if (!fs.existsSync(p)) return null;
  try {
    const raw = readJson(p), list = Array.isArray(raw) ? raw : (raw.sources || raw.items || Object.values(raw));
    return new Set(list.filter((s) => s && s.id != null).map((s) => String(s.id)));
  } catch { return null; }
}

export function validate(feed) {
  const bad = [];
  if (!feed || typeof feed !== 'object') return ['not an object'];
  if (feed.schema !== SCHEMA) bad.push(`schema is not ${SCHEMA}`);
  if (typeof feed.fetched_at !== 'string' || Number.isNaN(Date.parse(feed.fetched_at))) bad.push('fetched_at is not a time');
  if (!['ntrs-api', 'ntrs-index'].includes(feed.origin)) bad.push('origin is not ntrs-api or ntrs-index');
  if (!Array.isArray(feed.terms)) bad.push('terms is not a list');
  if (!Array.isArray(feed.items)) return [...bad, 'items is not a list'];
  if (feed.items.length > 20) bad.push('more than 20 items');
  const seen = new Set();
  feed.items.forEach((it, i) => {
    if (typeof it.id !== 'string' || !it.id) bad.push(`items[${i}].id is not a string`);
    if (seen.has(it.id)) bad.push(`items[${i}].id ${it.id} is repeated`); seen.add(it.id);
    if (typeof it.title !== 'string' || !it.title) bad.push(`items[${i}].title is empty`);
    if (it.url !== `https://ntrs.nasa.gov/citations/${it.id}`) bad.push(`items[${i}].url is not the NTRS citation page`);
    if (![true, false, null].includes(it.in_evidence_base)) bad.push(`items[${i}].in_evidence_base is not true, false or null`);
  });
  return bad;
}

function fromIndex(terms, ids, why) {
  const p = path.join(ROOT, 'research/ntrs-index.json');
  const index = readJson(p);
  const items = [...index]
    .sort((a, b) => (b.year || 0) - (a.year || 0) || String(b.id).localeCompare(String(a.id), 'en', { numeric: true }))
    .slice(0, 20)
    .map((r) => ({ id: String(r.id), title: r.title, created: null, year: r.year ?? null, sti_type: r.stiType ?? null, center: r.center ?? null,
      url: `https://ntrs.nasa.gov/citations/${r.id}`, matched_term: null, index_tags: r.tags || [],
      in_evidence_base: ids ? ids.has(String(r.id)) : null }));
  return { schema: SCHEMA, fetched_at: easternIso(fs.statSync(p).mtime), origin: 'ntrs-index',
    origin_note: `Built without the network from research/ntrs-index.json (${index.length} records harvested from the NTRS API): the 20 records with the most recent year.` + (why ? ` ${why}` : '') + ' fetched_at is the time the index was written.',
    terms, items };
}

async function fromApi(cfg, ids) {
  const byId = new Map(), errors = [];
  for (let i = 0; i < cfg.terms.length; i++) {
    const term = cfg.terms[i];
    if (i) await sleep(cfg.pause_ms ?? 1500);
    const url = `${cfg.endpoint}?q=${encodeURIComponent(term)}&sort.field=${cfg.sort.field}&sort.order=${cfg.sort.order}&page.size=${cfg.page_size}`;
    try {
      const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'vesta-ntrs-feed/1 (static dashboard build script)' }, signal: AbortSignal.timeout(25000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      for (const r of body.results || []) {
        const id = String(r.id);
        if (byId.has(id)) continue;
        byId.set(id, { id, title: r.title, created: r.created ?? null, sti_type: r.stiType ?? null, center: r.center?.code ?? null,
          url: `https://ntrs.nasa.gov/citations/${id}`, matched_term: term, in_evidence_base: ids ? ids.has(id) : null });
      }
      console.log(`ntrs-feed: ${term}  ${(body.results || []).length} records (total ${body.stats?.total ?? 'not reported'})`);
    } catch (e) { errors.push({ term, error: String(e.message || e) }); console.log(`ntrs-feed: ${term}  FAILED ${e.message || e}`); }
  }
  if (!byId.size) return { errors };
  const items = [...byId.values()].sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')) || b.id.localeCompare(a.id)).slice(0, cfg.keep ?? 20);
  const feed = { schema: SCHEMA, fetched_at: easternIso(new Date()), origin: 'ntrs-api', terms: cfg.terms, items };
  if (errors.length) feed.errors = errors;
  return { feed, errors };
}

function write(feed) {
  const bad = validate(feed);
  if (bad.length) { console.error('ntrs-feed: refusing to write an invalid file:\n  ' + bad.join('\n  ')); process.exit(1); }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const tmp = OUT + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(feed, null, 1) + '\n');
  fs.renameSync(tmp, OUT);
  const tagged = feed.items.filter((i) => i.in_evidence_base === true).length;
  console.log(`ntrs-feed: wrote ${path.relative(ROOT, OUT)}  origin ${feed.origin}  ${feed.items.length} items  ${tagged} in the evidence base  snapshot of ${feed.fetched_at}`);
}

async function main() {
  if (flag('check')) {
    let bad;
    try { bad = validate(readJson(OUT)); } catch (e) { bad = [String(e.message || e)]; }
    if (bad.length) { console.error('ntrs-feed: invalid:\n  ' + bad.join('\n  ')); process.exit(1); }
    console.log('ntrs-feed: valid'); return;
  }
  const cfg = readJson(path.join(ROOT, 'config/feed-terms.json'));
  const ids = evidenceIds();
  if (!ids) console.log('ntrs-feed: web/data/sources.json is not there yet; in_evidence_base is written as null (unknown) and the screen decides from the evidence it loads');
  if (flag('offline')) return write(fromIndex(cfg.terms, ids, ''));
  const { feed, errors } = await fromApi(cfg, ids);
  if (feed) return write(feed);
  write(fromIndex(cfg.terms, ids, `The NTRS API did not answer (${errors.map((e) => e.error).join('; ')}).`));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
