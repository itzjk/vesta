import { buildIndex, slug } from './index.js';
import { decisionLog, checkFrame, matchesConditions, OFFICER_VERSION } from './officer.js';
import { W, LEVEL, SPAN, PARTIAL_SUPPORT, rank } from './rank.js';
import { TOL, match } from './match.js';

export const DECISION_RECORD_SCHEMA = 'vesta.decision-log/2';
export const MAX_RECORD_BYTES = 16 * 1024 * 1024;
export const REPLAY_SCOPE = 'The built-in drill telemetry is scripted. Decisions use deterministic rules written with SI assistance; no live language model. Rechecking tests reproducibility, not independent scientific validation or flight safety.';
const clone = x => JSON.parse(JSON.stringify(x));
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const stable = x => Array.isArray(x) ? x.map(stable) : object(x)
  ? Object.fromEntries(Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => [k, stable(x[k])])) : x;
const canonical = x => JSON.stringify(stable(x));
const same = (a, b) => canonical(a) === canonical(b);
const bytes = x => new TextEncoder().encode(x).length;
const sorted = (list, key = 'id') => clone(list).sort((a, b) => String(a[key]).localeCompare(String(b[key])));
const sections = (o, keys, name) => {
  if (!object(o) || !same(Object.keys(o).sort(), [...keys].sort())) throw Error(`Incomplete or unsupported ${name} sections.`);
};

function collection(db) {
  return clone({ tests: db.tests, findings: db.findings, investigations: db.investigations, sources: db.sources, tables: db.tables });
}

function method(db) {
  return clone({ id: OFFICER_VERSION, coverage: 'vesta.atmospheric-coverage/1', ranking: 'vesta.relevance/1',
    tolerances: { oxygen_percentage_points: TOL.o2, pressure_kpa: TOL.p, epsilon: 1e-9 },
    weights: W, levels: LEVEL, spans: SPAN, partial_support: PARTIAL_SUPPORT,
    ranking_rules: {
      total: 'round(sum(weight * term) * (direct support ? 1 : partial_support))',
      atmosphere: '0.7 * oxygen proximity + 0.3 * pressure proximity; proximity = max(0, 1 - abs(gap) / span); unknown = 0.3',
      pillar: 'same = 1; design or response = 0.5; other = 0.2',
      gravity: 'unknown = 0.3; same class = 1; other = 0.4',
      material: 'no query = 0.5; exact = 1; unspecified evidence = 0.3; same fuel class = 0.5; other = 0',
      habitat: 'listed habitat = 1; other = 0',
      order: ['total descending', 'work level descending', 'source year descending', 'finding id ascending'],
      selection: 'first verified rule in rule_ids order; union of step and rule findings; at most three ranked findings'
    },
    firing: 'Each step fires once, at the first ordered frame satisfying every predicate and every after dependency, in playbook order.',
    coverage_rules: 'Same-row oxygen and pressure within tolerances, same gravity class. Inferred pressure is labelled. Flow, geometry, thickness and ignition are not matched. Coverage is not safety.',
    playbook: db.playbook, rules: db.rules, protocol: db.protocol });
}

async function fingerprint(evidence) {
  if (!globalThis.crypto?.subtle) throw Error('Decision replay requires a secure browser context.');
  const ordered = { tests: sorted(evidence.tests), findings: sorted(evidence.findings), investigations: sorted(evidence.investigations, 'psi_id'),
    sources: sorted(evidence.sources, 'key'), tables: clone(evidence.tables).sort((a, b) => canonical(a).localeCompare(canonical(b))) };
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(ordered)));
  return { algorithm: 'SHA-256', digest: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join(''),
    source_table_rows: evidence.tests.length, findings: evidence.findings.length, investigations: evidence.investigations.length };
}

function indexed(evidence, savedMethod) {
  return buildIndex({ ...evidence, playbook: savedMethod.playbook, rules: savedMethod.rules, protocol: savedMethod.protocol });
}

function explanations(log, frames, db, meta) {
  const triggers = new Map();
  for (const frame of frames) for (const step of db.playbook.steps) {
    if (triggers.has(step.id) || !(step.after ?? []).every(id => triggers.has(id)) || !matchesConditions(step.when, frame)) continue;
    triggers.set(step.id, frame);
  }
  return log.map(e => {
    const step = db.playbook.steps.find(s => s.id === e.step), frame = triggers.get(e.step);
    const q = { habitat: meta.habitat, concern: step.pillar, o2: frame.o2_percent, p: frame.pressure_kpa,
      gclass: meta.gclass, material: step.material_from ? slug(frame[step.material_from]) : null };
    const findingIds = [...new Set([...(e.nasa ?? []).map(n => n.finding_id), e.earth?.finding_id, e.protocol?.finding_id].filter(Boolean))];
    const rule = e.rule_id ? db.ruleById[e.rule_id] : null;
    const candidates = step.kind === 'material' ? e.cell?.finding_ids ?? []
      : [...new Set([...(step.finding_ids ?? []), ...(rule?.finding_ids ?? [])])];
    return { step: e.step, frame: clone(frame), query: clone(q), matched_conditions: clone(step.when), after: clone(step.after ?? []),
      rule: rule ? clone(rule) : null,
      ranked_findings: rank(candidates.map(id => db.findingById[id]).filter(Boolean), q, db).map(r => ({
        finding_id: r.f.id, selected: e.nasa.some(n => n.finding_id === r.f.id), total: r.total, parts: r.parts, terms: r.terms, match: match(r.f.n, q, db.base) })),
      findings: findingIds.map(id => clone(db.findingById[id])),
      rows: (e.row_ids ?? []).map(id => { const row = db.testById[id]; return { row: clone(row), match: match(row.n, q, db.base),
        source_url: row.psi_url || db.invById[row.psi_id]?.psi_url || null,
        pressure_basis: row.n.p != null ? 'reported' : row.n.p_inferred != null ? 'inferred' : 'unknown' }; }),
      coverage: clone(e.coverage), gap: e.gap, protocol: clone(e.protocol) };
  });
}

export async function createDecisionRecord(frames, db, meta) {
  const evidence = collection(db), savedMethod = method(db), snapshot = indexed(evidence, savedMethod);
  const legacy = decisionLog(frames, snapshot, meta);
  const record = clone({ ...legacy, schema: DECISION_RECORD_SCHEMA, simulated: frames.some(f => f.simulated !== false), scope: REPLAY_SCOPE,
    input: { frames, meta }, method: savedMethod, basis: await fingerprint(evidence), collection: evidence,
    evidence: explanations(legacy.steps, frames, snapshot, meta) });
  parseDecisionRecord(record);
  return record;
}

export function parseDecisionRecord(input) {
  let text;
  try { text = typeof input === 'string' ? input : JSON.stringify(input); } catch { throw Error('This decision log is not valid JSON.'); }
  if (!text || bytes(text) > MAX_RECORD_BYTES) throw Error('Decision log is missing or exceeds 16 MB.');
  let r;
  try { r = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw Error('This file is not valid JSON.'); }
  if (!object(r)) throw Error('Expected a decision log JSON object.');
  if (r.schema === 'vesta.decision-log/1') {
    if (!Array.isArray(r.steps) || r.steps.some(e => !object(e) || typeof e.step !== 'string' || !['SOURCED', 'NO_SOURCE'].includes(e.state)) || !object(r.cabin) || !object(r.clock)) throw Error('Incomplete legacy decision log.');
    return r;
  }
  if (r.schema !== DECISION_RECORD_SCHEMA) throw Error(`Expected ${DECISION_RECORD_SCHEMA}. Use Load telemetry frames for vesta.telemetry/1 JSONL.`);
  sections(r, ['schema', 'scenario', 'simulated', 'scope', 'cabin', 'steps', 'clock', 'input', 'method', 'basis', 'collection', 'evidence'], 'decision log');
  if (typeof r.scope !== 'string' || typeof r.simulated !== 'boolean') throw Error('Decision log scope or telemetry label is incomplete.');
  sections(r.input, ['frames', 'meta'], 'input');
  if (!Array.isArray(r.input.frames) || !r.input.frames.length || r.input.frames.length > 10000) throw Error('Decision log needs 1 to 10000 telemetry frames.');
  let time = -Infinity;
  for (const f of r.input.frames) {
    const bad = checkFrame(f); if (bad) throw Error(`Invalid saved telemetry: ${bad}.`);
    if (f.t < time) throw Error('Saved telemetry frames must be in time order.');
    time = f.t;
  }
  if (!object(r.input.meta) || !object(r.input.meta.comm) || !object(r.cabin) || !object(r.clock)) throw Error('Decision log scenario, cabin or clock is incomplete.');
  if (!object(r.method) || typeof r.method.id !== 'string' || !Array.isArray(r.method.rules) || !Array.isArray(r.method.protocol) || !Array.isArray(r.method.playbook?.steps)) throw Error('Decision method is incomplete.');
  for (const k of ['coverage', 'ranking', 'firing', 'coverage_rules']) if (typeof r.method[k] !== 'string') throw Error(`Decision method ${k} is missing.`);
  for (const k of ['tolerances', 'weights', 'levels', 'spans', 'ranking_rules']) if (!object(r.method[k]) || !Object.keys(r.method[k]).length) throw Error(`Decision method ${k} is missing.`);
  if (typeof r.method.partial_support !== 'number') throw Error('Decision ranking support factor is missing.');
  if (r.method.playbook.steps.length > 256) throw Error('Too many decision rules.');
  const ids = new Set();
  for (const s of r.method.playbook.steps) {
    if (!object(s) || typeof s.id !== 'string' || ids.has(s.id) || !Array.isArray(s.when) || s.when.length > 64 || !Array.isArray(s.after ?? [])) throw Error('Invalid or duplicate decision rule.');
    ids.add(s.id);
    for (const w of s.when) if (!Array.isArray(w) || w.length !== 3 || typeof w[0] !== 'string' || !['==', '!=', '>', '>=', '<', '<='].includes(w[1]) || object(w[2]) || Array.isArray(w[2])) throw Error('Invalid decision condition.');
  }
  sections(r.collection, ['tests', 'findings', 'investigations', 'sources', 'tables'], 'collection');
  for (const k of Object.keys(r.collection)) {
    const xs = r.collection[k], key = k === 'investigations' ? 'psi_id' : k === 'sources' ? 'key' : 'id';
    if (k === 'tables') { if (!Array.isArray(xs) || xs.length > 20000 || xs.some(x => !object(x))) throw Error('Invalid collection tables.'); continue; }
    if (!Array.isArray(xs) || xs.length > 20000 || xs.some(x => !object(x) || typeof x[key] !== 'string') || new Set(xs.map(x => x[key])).size !== xs.length) throw Error(`Invalid collection ${k}.`);
  }
  if ([...r.collection.tests, ...r.collection.findings].some(x => !object(x.n))) throw Error('Normalized source evidence is missing.');
  if (!object(r.basis) || r.basis.algorithm !== 'SHA-256' || !/^[a-f0-9]{64}$/.test(r.basis.digest)) throw Error('Invalid collection fingerprint.');
  if (!Array.isArray(r.steps) || !Array.isArray(r.evidence) || r.steps.length > 256 || r.evidence.length !== r.steps.length || r.steps.some(e => !object(e) || !['SOURCED', 'NO_SOURCE'].includes(e.state))) throw Error('Saved decisions or their evidence are incomplete.');
  for (const e of r.evidence) if (!object(e) || typeof e.step !== 'string' || !object(e.frame) || !object(e.query) || !Array.isArray(e.matched_conditions) || !Array.isArray(e.findings) || !Array.isArray(e.rows) || !Array.isArray(e.ranked_findings)) throw Error('Per-decision evidence is incomplete.');
  return r;
}

export async function recheckDecisionRecord(input, db) {
  try {
    const saved = parseDecisionRecord(input);
    if (saved.schema === 'vesta.decision-log/1') return { status: 'LEGACY', matches: false, saved,
      message: 'Legacy vesta.decision-log/1 read. It has no saved inputs, method or collection; reproducibility cannot be checked. Export a new decision log.' };
    const actualBasis = await fingerprint(saved.collection);
    if (!same(saved.basis, actualBasis)) return { status: 'INVALID', matches: false,
      message: 'The saved collection fingerprint does not match its evidence. The file is altered or incomplete; nothing is replayed.' };
    const current = await createDecisionRecord(saved.input.frames, db, saved.input.meta);
    const changed = [];
    if (!same(saved.method, current.method)) changed.push('method');
    if (!same(saved.basis, current.basis)) changed.push('basis');
    const snapshot = indexed(saved.collection, saved.method);
    const replay = { ...decisionLog(saved.input.frames, snapshot, saved.input.meta), simulated: saved.input.frames.some(f => f.simulated !== false) };
    const resultKeys = ['scenario', 'simulated', 'cabin', 'steps', 'clock'];
    if (!same(saved.scope, current.scope) || resultKeys.some(k => !same(saved[k], current[k])) || resultKeys.some(k => !same(saved[k], replay[k])) ||
        !same(saved.evidence, explanations(replay.steps, saved.input.frames, snapshot, saved.input.meta)) || !same(saved.evidence, current.evidence)) changed.push('result');
    const status = changed.includes('method') ? 'METHOD_CHANGED' : changed.includes('basis') ? 'BASIS_CHANGED' : changed.length ? 'RESULT_CHANGED' : 'MATCH';
    return { status, matches: !changed.length, changed, current, replay,
      message: status === 'MATCH' ? 'Same cabin, evidence and result in the loaded collection.'
        : status === 'METHOD_CHANGED' ? 'The matching method differs. Review the current result.'
        : status === 'BASIS_CHANGED' ? 'The collection fingerprint differs. Review the current result.'
        : 'The saved result or evidence differs from the current calculation.' };
  } catch (error) { return { status: 'INVALID', matches: false, message: `Decision log rejected: ${error.message}` }; }
}
