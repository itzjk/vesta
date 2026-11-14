import * as index from '../core/index.js';
import * as status from '../core/status.js';
import * as officer from '../core/officer.js';
import * as text from '../core/text.js';

export function validateCases(file) {
  if (file?.schema !== 'vesta.proof-cases/1' || !Array.isArray(file.cases) || file.cases.length !== 10) throw new Error('The reviewed file must contain ten cases.');
  const ids = new Set();
  for (const c of file.cases) {
    if (!c.id || ids.has(c.id) || !c.question || !c.rationale || !c.cabin?.preset || !c.expected?.status) throw new Error('A reviewed case is incomplete or duplicated.');
    if (!['material', 'officer', 'finding'].includes(c.kind) || !['extractor', 'verifier', 'ranker', 'officer'].includes(c.machine)) throw new Error('A reviewed case has an unknown operation.');
    ids.add(c.id);
  }
  return file.cases;
}

export async function loadCases({ signal } = {}) {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  const timeout = setTimeout(cancel, 12000);
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const response = await fetch('data/proof-cases.json', { signal: abort.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('The reviewed cases could not be loaded.');
    const file = await response.json();
    validateCases(file);
    return file;
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('The reviewed cases could not be loaded. Retry the check.');
  } finally {
    clearTimeout(timeout); signal?.removeEventListener('abort', cancel);
  }
}

export function evaluateCase(c, original, core = { index, status, officer, text }) {
  const db = c.without_findings?.length ? core.index.withoutFindings(original, c.without_findings) : original;
  if (!db.presetById[c.cabin.preset]) throw new Error('The reviewed cabin is unavailable.');
  const q = core.index.designPoint(c.cabin, db);
  let result, actual, answer, refs = [], limits = null;
  if (c.kind === 'material') {
    if (!db.materials[q.material]) throw new Error('The reviewed material is unavailable.');
    result = core.status.cell(q.material, q.concern, q, db);
    actual = { status: result.status, reasons: result.reasons, qualifier: result.qualifier ?? null, hits: result.hit_ids?.length ?? 0, rows: result.rows };
    answer = core.text.cellSentence(result, db.materials[q.material]?.label, db);
    refs = result.hit_ids?.slice(0, 1) ?? (result.nearest ? [result.nearest.id] : result.finding_ids.slice(0, 1));
  } else if (c.kind === 'finding') {
    const finding = db.findingById[c.finding];
    if (!finding) throw new Error('The reviewed finding is unavailable.');
    result = core.status.findingStatus(finding, q, db);
    actual = { status: result.status, reasons: result.reasons };
    answer = core.text.statusMeaning(result.status);
    refs = [finding.id];
  } else if (c.kind === 'officer') {
    const step = db.playbook.steps.find(s => s.id === c.step);
    if (!step || step.question !== c.question) throw new Error('The reviewed officer question changed.');
    const log = core.officer.run(db.scenario.frames, db, db.scenario.meta);
    const event = log.find(e => e.step === c.step);
    const frame = db.scenario.frames.find(f => f.t === event?.t);
    if (!frame) throw new Error('The reviewed scripted step is unavailable.');
    const fr = { ...frame, o2_percent: q.o2, pressure_kpa: q.p };
    if (c.material) fr[step.material_from] = c.material;
    result = core.officer.decide(step, fr, db, { ...db.scenario.meta, habitat: q.habitat, gclass: q.gclass });
    actual = { status: result.state, coverage: result.coverage?.status ?? null, reasons: result.coverage?.reasons ?? [], gap: result.gap, protocol: result.protocol?.id ?? null, rule: result.rule_id };
    answer = result.state === 'NO_SOURCE' ? core.text.NO_SOURCE_LINE : result.action;
    refs = result.nasa.map(n => n.finding_id);
    limits = result.protocol?.limit ?? result.limits;
  } else throw new Error('The reviewed operation is unavailable.');
  const mismatches = Object.entries(c.expected).filter(([key, expected]) => Array.isArray(expected)
    ? !expected.every(value => actual[key]?.includes(value))
    : actual[key] !== expected).map(([key]) => key);
  return { id: c.id, machine: c.machine, question: c.question, cabin: q, expected: c.expected, actual, answer, refs, limits, result, pass: mismatches.length === 0, mismatches };
}

export function runCases(file, db, core) {
  return validateCases(file).map(c => evaluateCase(c, db, core));
}
