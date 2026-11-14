import { CONCERNS, G } from './index.js';
import { TOL, match } from './match.js';
import { cell, cells, tally } from './status.js';

export const RECEIPT_SCHEMA = 'vesta.evidence-receipt/1';
export const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const METHOD = 'vesta.atmospheric-coverage/1';
const SCOPE = 'Evidence coverage, not a safety certification or a prediction of fire behaviour.';
const LIMITS = [
  'Oxygen and pressure must match on the same row at the same gravity class.',
  'Facility pressure may be inferred; each row records whether it was reported or inferred.',
  'Flow, sample geometry, thickness and ignition are not matched.',
  'NEVER_TESTED means no matching material/concern row or finding in this collection, not that NASA has never tested it.',
  'PROVEN means nearby evidence under these matching rules, not a safe cabin.',
  'Rechecking tests reproducibility against the loaded collection; it does not independently validate the science.'
];
const sorted = xs => [...xs].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const clone = x => JSON.parse(JSON.stringify(x));

function stable(x) {
  if (Array.isArray(x)) return x.map(stable);
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => [k, stable(x[k])]));
  return x;
}
const canonical = x => JSON.stringify(stable(x));
const same = (a, b) => canonical(a) === canonical(b);
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const measure = (x, min, max, name) => {
  if (x === null) return null;
  if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max) throw new Error(`Invalid ${name}. Use a number in range or null for unknown.`);
  return x;
};

function cabin(q) {
  if (!object(q)) throw new Error('A cabin query is required.');
  if (!CONCERNS.includes(q.concern)) throw new Error('Unknown evidence concern.');
  const g = q.g ?? null, gclass = q.gclass ?? null;
  if (g !== null && !Object.hasOwn(G, g)) throw new Error('Unknown gravity.');
  if (![null, 'micro', 'partial', 'normal'].includes(gclass)) throw new Error('Unknown gravity class.');
  if (g !== null && G[g].gclass !== gclass) throw new Error('Gravity and gravity class disagree.');
  if (q.material != null && (typeof q.material !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(q.material))) throw new Error('Invalid material id.');
  return {
    oxygen_percent: measure(q.o2, 0, 100, 'oxygen percent'),
    pressure_kpa: measure(q.p, Number.MIN_VALUE, 10000, 'pressure kPa'),
    gravity: g, gravity_class: gclass, material_id: q.material ?? null, concern: q.concern
  };
}

export function receiptQuery(query) {
  if (!object(query)) throw new Error('Missing receipt query.');
  const q = { preset: 'custom', habitat: null, o2: query.oxygen_percent, p: query.pressure_kpa,
    g: query.gravity, gclass: query.gravity_class, g_label: G[query.gravity]?.label ?? null,
    material: query.material_id, concern: query.concern };
  if (!same(cabin(q), query)) throw new Error('Receipt query has missing or unsupported fields.');
  return q;
}

async function basis(db) {
  if (!globalThis.crypto?.subtle) throw new Error('Evidence receipts require a secure browser context.');
  const content = canonical({ tests: sorted(db.tests), findings: sorted(db.findings),
    investigations: [...db.investigations].sort((a, b) => a.psi_id.localeCompare(b.psi_id)),
    materials: db.materials, partial_rows: db.base.partial_rows });
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return { algorithm: 'SHA-256', digest: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join(''),
    investigations: db.investigations.length, source_table_rows: db.tests.length, findings: db.findings.length };
}

export async function createReceipt(db, q) {
  const query = cabin(q), point = receiptQuery(query);
  const coverage = cells(point, db).sort((a, b) => a.material.localeCompare(b.material) || a.concern.localeCompare(b.concern));
  const selected = point.material ? cell(point.material, point.concern, point, db) : null;
  const nearby = db.cabinRows.filter(r => !match(r.n, point, db.base).fail.length);
  const ids = new Set(nearby.map(r => r.id));
  for (const c of [...coverage, ...(selected ? [selected] : [])]) {
    for (const id of c.hit_ids ?? []) ids.add(id);
    if (c.nearest) ids.add(c.nearest.id);
  }
  const rows = sorted([...ids].map(id => {
    const r = db.testById[id];
    if (!r) throw new Error(`Missing source row: ${id}`);
    return { id: r.id, investigation_id: r.psi_id, source_url: r.psi_url || db.invById[r.psi_id]?.psi_url || null,
      row: clone(r), match: match(r.n, point, db.base),
      pressure_basis: r.n.p != null ? 'reported' : r.n.p_inferred != null ? 'inferred' : 'unknown' };
  }));
  const findingIds = new Set([...coverage, ...(selected ? [selected] : [])].flatMap(c => c.finding_ids));
  const findings = sorted([...findingIds].map(id => {
    if (!db.findingById[id]) throw new Error(`Missing finding: ${id}`);
    return clone(db.findingById[id]);
  }));
  const result = clone({ nearby_cabin_row_ids: nearby.map(r => r.id).sort(), coverage: tally(coverage), cells: coverage, selected });
  return { schema: RECEIPT_SCHEMA, method: { id: METHOD, tolerances: { oxygen_percentage_points: TOL.o2, pressure_kpa: TOL.p },
    gravity: 'same gravity class', scope: SCOPE, limits: [...LIMITS] },
    basis: await basis(db), query, result, evidence: { rows, findings } };
}

export function parseReceipt(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_RECEIPT_BYTES) throw new Error('Evidence receipt is missing or exceeds 2 MB.');
  let r;
  try { r = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!object(r) || r.schema !== RECEIPT_SCHEMA) throw new Error(`Expected ${RECEIPT_SCHEMA}.`);
  if (!same(Object.keys(r).sort(), ['basis', 'evidence', 'method', 'query', 'result', 'schema'])) throw new Error('Receipt has missing or unsupported sections.');
  for (const key of ['basis', 'evidence', 'method', 'query', 'result']) if (!object(r[key])) throw new Error(`Invalid receipt ${key}.`);
  if (r.basis.algorithm !== 'SHA-256' || !/^[a-f0-9]{64}$/.test(r.basis.digest)) throw new Error('Invalid collection fingerprint.');
  if (!Array.isArray(r.evidence.rows) || !Array.isArray(r.evidence.findings) || !Array.isArray(r.result.cells) || !Array.isArray(r.result.nearby_cabin_row_ids)) throw new Error('Receipt evidence lists are missing.');
  receiptQuery(r.query);
  return r;
}

export async function recheckReceipt(input, db) {
  let receipt;
  try { receipt = parseReceipt(input); }
  catch (error) { return { status: 'INVALID', matches: false, message: error.message }; }
  const current = await createReceipt(db, receiptQuery(receipt.query));
  const changed = ['method', 'basis', 'result', 'evidence'].filter(key => !same(receipt[key], current[key]));
  const status = changed.includes('method') ? 'METHOD_CHANGED' : changed.includes('basis') ? 'BASIS_CHANGED' : changed.length ? 'RESULT_CHANGED' : 'MATCH';
  return { status, matches: !changed.length, changed, current,
    message: status === 'MATCH' ? 'Same cabin, evidence and result in the loaded collection.'
      : status === 'METHOD_CHANGED' ? 'The matching method differs. Review the current result.'
      : status === 'BASIS_CHANGED' ? 'The collection fingerprint differs. Review the current result.'
      : 'The saved result or evidence differs from the current calculation.' };
}
