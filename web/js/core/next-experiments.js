// What a reviewer could request next. Pure: every number is counted from the loaded rows with the existing
// matching rules (status.js, match.js). It names conditions and materials only: no protocol, no expected result.
import * as statusCore from './status.js';
import * as textCore from './text.js';
import { TOL } from './match.js';

export const TOP = 5;
const defaults = { status: statusCore, text: textCore };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const abs = (x, missing) => Number.isFinite(x) ? Math.abs(x) : missing;

/** The cabin conditions a row would have to state to be nearby, or null when the cabin itself leaves one unset. */
export function campaignConditions(q) {
  return q?.gclass && Number.isFinite(q?.o2) && Number.isFinite(q?.p) ? { gclass: q.gclass, o2: q.o2, p: q.p } : null;
}

/** Exactly which condition separates the nearest row from the cabin. delta is cabin minus row, as in match.js. */
export function separation(nearest, q) {
  const { row, fail, note, delta } = nearest, out = [];
  const gravity = fail.find(code => code.startsWith('gravity_'));
  if (gravity) out.push({ axis: 'gravity', code: gravity, row: row.n.gclass ?? null, cabin: q.gclass ?? null });
  const o2 = fail.find(code => code.startsWith('o2_'));
  if (o2) out.push({ axis: 'o2', code: o2, delta: o2 === 'o2_outside' ? delta.o2 : null, tolerance: TOL.o2 });
  const p = fail.find(code => code.startsWith('pressure_'));
  if (p) out.push({ axis: 'pressure', code: p, delta: p === 'pressure_outside' ? delta.p : null, tolerance: TOL.p,
    inferred: note.includes('pressure_inferred') });
  return out;
}

function gapFor(cell, q, db, core) {
  const base = { material: cell.material, concern: cell.concern, status: cell.status, rows: cell.rows };
  if (!cell.rows) return { ...base, kind: cell.finding_ids.length ? 'finding_without_rows' : 'no_source',
    finding_ids: cell.finding_ids, nearest: null, separates: [] };
  const nearest = core.status.nearestRow(cell.material, cell.concern, q, db);
  return { ...base, kind: 'other_conditions', separates: separation(nearest, q),
    nearest: { id: nearest.row.id, investigation: nearest.row.investigation ?? null, gclass: nearest.row.n.gclass ?? null,
      delta: nearest.delta, note: nearest.note, fail: nearest.fail } };
}

/**
 * Ranked list of what a reviewer could request for this cabin.
 * campaign.questions counts the not-nearby questions whose material already has a source row for that concern at
 * other conditions; firstSource counts those with no source row of any kind for the question.
 */
export function nextExperiments(q, db, core = defaults) {
  const cells = core.status.cells(q, db), total = cells.length;
  const nearby = cells.filter(c => c.status === 'PROVEN').length;
  const gaps = cells.filter(c => c.status !== 'PROVEN').map(c => gapFor(c, q, db, core));
  const withRows = gaps.filter(g => g.kind === 'other_conditions');
  const gain = {};
  for (const g of withRows) gain[g.material] = (gain[g.material] ?? 0) + 1;
  const order = Object.keys(db.materials ?? {});
  const items = withRows.map(g => ({ ...g, material_gain: gain[g.material] })).sort((a, b) =>
    b.material_gain - a.material_gain || a.separates.length - b.separates.length
    || abs(a.nearest.delta.o2, 99) - abs(b.nearest.delta.o2, 99) || abs(a.nearest.delta.p, 999) - abs(b.nearest.delta.p, 999)
    || order.indexOf(a.material) - order.indexOf(b.material) || a.concern.localeCompare(b.concern));
  const materials = order.filter(id => gain[id]).sort((a, b) => gain[b] - gain[a] || order.indexOf(a) - order.indexOf(b))
    .map(id => ({ id, label: db.materials[id].label ?? id, questions: gain[id] }));
  const first = gaps.filter(g => g.kind !== 'other_conditions');
  const conditions = campaignConditions(q);
  const model = { total, nearby, conditions, g_label: q?.g_label ?? null,
    cabin: db.presetById?.[q?.preset]?.label || 'Custom cabin',
    campaign: { questions: conditions ? items.length : 0, materials: conditions ? materials : [], after: nearby + (conditions ? items.length : 0) },
    firstSource: { questions: first.length, finding_without_rows: first.filter(g => g.kind === 'finding_without_rows').length,
      no_source: first.filter(g => g.kind === 'no_source').length, items: first },
    unstatedOnly: conditions ? items.filter(unstated).length : 0, items, top: items.slice(0, TOP) };
  return { ...model, ...sentences(model, core) };
}

/** True when nothing measured differs: the nearest row only leaves a compared condition unstated. */
const unstated = item => item.separates.length > 0 && item.separates.every(part => part.code.endsWith('_not_reported'));

export function conditionsText(model, core = defaults) {
  if (!model.conditions) return null;
  const gravity = core.text.gravity(model.conditions.gclass);
  return `${model.g_label && model.g_label !== gravity ? `${gravity} (cabin: ${model.g_label})` : gravity}, ${core.text.oxygen(model.conditions.o2)}, ${core.text.pressure(model.conditions.p)}`;
}

function sentences(model, core) {
  const { total, nearby, campaign, firstSource: first } = model, where = conditionsText(model, core);
  let sentence;
  if (!total) sentence = 'No material-and-concern questions are loaded, so there is nothing to request.';
  else if (!where) sentence = 'Set gravity, oxygen and pressure for this cabin to count what a reviewer could request.';
  else if (!campaign.questions) sentence = nearby === total
    ? `All ${total} questions already have a nearby source row for this cabin.`
    : `No question outside nearby evidence has a source row at other conditions, so no single set of conditions would add a nearby row here.`;
  else sentence = `One test campaign at ${where} would give a nearby row to ${campaign.questions} of ${total} questions if it included these ${plural(campaign.materials.length, 'material')} and each row stated all three conditions.`;
  const firstSentence = !first.questions ? 'No question is waiting for a first source row.'
    : `${plural(first.questions, 'more question')} ${first.questions === 1 ? 'needs' : 'need'} a first source row of any kind: ${first.no_source} with no source in this collection, ${first.finding_without_rows} with a verified finding but no test row.`;
  const after = where && campaign.questions ? `Nearby coverage would then read ${campaign.after} of ${total} instead of ${nearby} of ${total}. That counts rows, not what the tests would show.` : null;
  const recover = model.unstatedOnly ? `For ${model.unstatedOnly} of these, the nearest row differs only by a condition its table does not state; a reviewer could first ask whether the original source records it.` : null;
  return { sentence, firstSentence, after, recover, summary: summaryText(model), limits: LIMITS };
}

function summaryText(model) {
  if (!model.total || !model.conditions) return 'What a reviewer could request next';
  return `What a reviewer could request next: ${model.campaign.questions} of ${model.total} questions share one missing set of conditions`;
}

export const LIMITS = `Counted from the loaded source rows with VESTA's matching rules (same gravity class, O2 within ${TOL.o2} point, pressure within ${TOL.p} kPa, on one row for the same concern). A list a reviewer could request, not a test protocol and not a prediction of any result; a nearby row is evidence coverage, not a safety finding. Rows are source-table rows, not independent experiments, and "no source" means absent from this collection.`;

/** One readable line per separating condition, with the signed difference (cabin minus row). */
export function separationText(part, core = defaults) {
  const { text } = core;
  if (part.axis === 'gravity') return part.code === 'gravity_not_reported' ? 'gravity not stated on the row'
    : `gravity class: row ${text.gravity(part.row)}, cabin ${text.gravity(part.cabin)}`;
  if (part.axis === 'o2') return Number.isFinite(part.delta) ? `oxygen: cabin ${text.signed(part.delta)} points from the row` : 'oxygen not stated on the row';
  return Number.isFinite(part.delta)
    ? `pressure: cabin ${text.signed(part.delta)} kPa from the row${part.inferred ? ' (row pressure assumed from the facility)' : ''}`
    : 'pressure not stated on the row';
}

export function itemText(item, db, core = defaults) {
  const what = `${db.materials[item.material]?.label ?? item.material}, ${core.text.concern(item.concern)}`;
  if (!item.nearest) return `${what}: no row at all for this question in this collection.`;
  return `${what}: nearest row ${item.nearest.id}. Separated by ${item.separates.map(part => separationText(part, core)).join('; ')}.`;
}
