// VESTA build · load.mjs
// Reads every input of DESIGN.md 4.1 and the authored files of the other packages. Nothing here changes a record.
// Every file that is read is remembered with its modification time: generated_at is the newest of them,
// so two runs over the same inputs give the same bytes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RESEARCH = 'research';

export class Inputs {
  constructor(root = ROOT) { this.root = root; this.mtimes = new Map(); this.lines = []; this.warnings = []; }
  abs(rel) { return path.join(this.root, rel); }
  log(line) { this.lines.push(line); }
  warn(kind, extra = {}) { this.warnings.push({ kind, ...extra }); }
  exists(rel) { try { return fs.statSync(this.abs(rel)).isFile(); } catch { return false; } }
  touch(rel) { try { this.mtimes.set(rel, fs.statSync(this.abs(rel)).mtimeMs); return true; } catch { return false; } }
  text(rel) { const s = fs.readFileSync(this.abs(rel), 'utf8'); this.touch(rel); return s; }
  bytes(rel) { const b = fs.readFileSync(this.abs(rel)); this.touch(rel); return b; }
  json(rel) { return JSON.parse(this.text(rel)); }
  // An optional file: null when it is absent; null plus a warning when it does not parse (a file still being written).
  optional(rel, why) {
    if (!this.exists(rel)) { if (why) this.log(`skip ${rel}: not there yet (${why})`); return null; }
    try { return this.json(rel); } catch (e) { this.warn('unreadable_input', { file: rel, why: String(e.message).slice(0, 120) }); this.log(`skip ${rel}: does not parse (${String(e.message).slice(0, 80)})`); return null; }
  }
  list(dir, re) {
    let names = [];
    try { names = fs.readdirSync(this.abs(dir)); } catch { return []; }
    return names.filter(n => re.test(n)).sort().map(n => path.posix.join(dir, n));
  }
  newest() { let m = 0; for (const v of this.mtimes.values()) if (v > m) m = v; return m; }
}

const arr = (x, ...keys) => { if (Array.isArray(x)) return x; if (x && typeof x === 'object') for (const k of keys) if (Array.isArray(x[k])) return x[k]; return []; };

// --- delivered inputs ---------------------------------------------------------------------------------------------------
export function loadDelivered(io) {
  const tests = io.json('data/tests.json');
  const psi = io.json('research/psi-investigations.json');
  const facts = arr(io.optional('research/raw/nasa/_facts.verified.json', 'fact-sheet facts'), 'findings', 'facts');
  const ntrs = io.optional('research/ntrs-index.json', 'NTRS index');
  const sourceTexts = io.list('research/raw/nasa', /\.txt$/);
  for (const rel of sourceTexts) io.touch(rel);
  const testsCsv = io.exists('data/tests.csv') ? io.bytes('data/tests.csv') : null;
  return { tests, psi: arr(psi, 'investigations', 'records'), facts, ntrs_records: ntrs == null ? null : arr(ntrs, 'records', 'items', 'results').length || (Array.isArray(ntrs) ? ntrs.length : null),
           source_texts: sourceTexts.length, testsCsv };
}

// The research delivery: per-family candidates, their gate report and the reviewed file; or the merged contract files.
export function loadEvidence(io) {
  const dir = 'research/evidence';
  const families = [];
  for (const rel of io.list(dir, /^[a-z0-9_-]+\.json$/)) {                 // <family>.json only: no dots in the family name
    const family = path.posix.basename(rel, '.json');
    if (family.startsWith('_')) continue;
    const cand = io.optional(rel);
    const verified = io.optional(`${dir}/${family}.verified.json`);
    const quotecheck = io.optional(`${dir}/${family}.quotecheck.json`);
    families.push({ family, file: rel, candidates: arr(cand, 'findings'), candidate_rules: arr(cand, 'rules'), candidate_investigations: arr(cand, 'investigations'),
                    verified_file: verified ? `${dir}/${family}.verified.json` : null,
                    verified: verified ? arr(verified, 'findings') : null, verified_rules: verified ? arr(verified, 'rules') : [],
                    verified_investigations: verified ? arr(verified, 'investigations') : [], verification: verified?.verification ?? null,
                    quotecheck_file: quotecheck ? `${dir}/${family}.quotecheck.json` : null, quotecheck: quotecheck ? arr(quotecheck, 'rows') : null });
  }
  // a reviewed file whose candidate file is missing still counts
  for (const rel of io.list(dir, /^[a-z0-9_-]+\.verified\.json$/)) {
    const family = path.posix.basename(rel, '.verified.json');
    if (family.startsWith('_') || families.some(f => f.family === family)) continue;
    const verified = io.optional(rel);
    if (verified) families.push({ family, file: null, candidates: [], candidate_rules: [], candidate_investigations: [], verified_file: rel, verified: arr(verified, 'findings'),
                                  verified_rules: arr(verified, 'rules'), verified_investigations: arr(verified, 'investigations'), verification: verified.verification ?? null, quotecheck_file: null, quotecheck: null });
  }
  const merged = {
    evidence: io.optional('data/evidence.json'), rules: io.optional('data/rules.json'),
    sources: io.optional('data/sources.json'), investigations: io.optional('data/investigations.json') };
  return { families, merged: { evidence: merged.evidence ? arr(merged.evidence, 'findings', 'evidence') : null, rules: merged.rules ? arr(merged.rules, 'rules') : null,
                               sources: merged.sources ? arr(merged.sources, 'sources') : null, investigations: merged.investigations ? arr(merged.investigations, 'investigations') : null } };
}

// --- what WP1 authors ---------------------------------------------------------------------------------------------------
export function loadOwn(io) {
  const seed = io.json('seed/evidence.seed.json');
  const rules = io.json('seed/rules.seed.json');
  return { seedFindings: arr(seed, 'findings'), seedRules: arr(rules, 'rules'),
           tableNotes: arr(io.json('config/table-notes.json'), 'notes'), facility: io.json('config/facility.json'), families: io.json('config/families.json') };
}

// --- what the other packages author (each may be missing: the first build never waits) -----------------------------------
export function loadAuthored(io) {
  const out = { missing: [] };
  const opt = (rel, owner) => { const x = io.optional(rel, `authored by ${owner}`); if (x == null) out.missing.push(rel); return x; };
  const pr = opt('config/presets.json', 'WP5');
  out.presetsFile = pr;
  const all = Array.isArray(pr) ? pr : pr ? [...arr(pr.presets), ...arr(pr.markers), ...arr(pr.bands), ...arr(pr.items)] : [];
  const kindOf = (x, list) => x.kind ?? (pr && !Array.isArray(pr) && arr(pr.markers).includes(x) ? 'marker' : pr && !Array.isArray(pr) && arr(pr.bands).includes(x) ? 'band' : 'preset');
  out.presets = all.map(x => ({ ...x, kind: kindOf(x) }));
  const pb = opt('config/playbook.json', 'WP6');
  out.playbook = pb == null ? null : Array.isArray(pb) ? { steps: pb } : { ...pb, steps: arr(pb, 'steps') };
  const pt = opt('config/protocol.json', 'WP6');
  out.protocol = pt == null ? null : Array.isArray(pt) ? { lines: pt } : { ...pt, lines: arr(pt, 'lines', 'protocol', 'steps') };
  out.lines = opt('config/vesta-lines.json', 'WP6');
  out.tour = opt('config/tour.json', 'WP4');
  out.scenarios = [];
  const metas = io.list('config/scenarios', /\.meta\.json$/);
  if (!metas.length) { io.log('skip config/scenarios/*.meta.json: not there yet (authored by WP6)'); out.missing.push('config/scenarios/*.meta.json'); }
  for (const rel of metas) {
    const meta = io.optional(rel); if (!meta) continue;
    const framesRel = path.posix.join('config/scenarios', meta.frames ?? `${meta.id}.jsonl`);
    let frames = [], framesBytes = null, bad = null;
    if (io.exists(framesRel)) {
      framesBytes = io.bytes(framesRel);
      const lines = framesBytes.toString('utf8').split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) { if (!lines[i].trim()) continue; try { frames.push(JSON.parse(lines[i])); } catch { bad = i + 1; break; } }
      if (bad) { io.warn('unreadable_input', { file: framesRel, why: `line ${bad} is not JSON` }); frames = []; }
    } else { io.log(`skip ${framesRel}: not there yet (authored by WP6)`); out.missing.push(framesRel); }
    out.scenarios.push({ meta, metaRel: rel, metaBytes: io.bytes(rel), frames, framesRel, framesBytes });
  }
  return out;
}

// --- the core modules (WP2). A module that is not there yet is null and its outputs are skipped. --------------------------
export const CORE = ['match', 'status', 'rank', 'officer', 'clock', 'index', 'csv', 'text'];
export async function loadCore(io) {
  const core = {};
  for (const name of CORE) {
    const rel = `web/js/core/${name}.js`;
    if (!io.exists(rel)) { core[name] = null; io.log(`skip core/${name}.js: not there yet (its outputs are skipped)`); continue; }
    io.touch(rel);
    try { core[name] = await import(pathToFileURL(io.abs(rel)).href); }
    catch (e) { core[name] = null; io.warn('core_module_failed', { module: name, why: String(e.message).slice(0, 160) }); io.log(`skip core/${name}.js: import failed (${String(e.message).slice(0, 100)})`); }
  }
  return core;
}

export { arr };
