// Reads a typed question with fixed word rules and answers it from the loaded rows. No language model:
// the material is matched against the labels and ids in db.materials only, the concern and the cabin
// against short fixed word lists, and the answer is the existing questionSummary of the existing cell.
import { presetPoint } from './index.js';
import { cell as statusCell } from './status.js';
import { questionSummary } from './question-summary.js';

export const TYPED_LABEL = 'Computed from the loaded NASA rows by fixed rules · no language model';
const CONCERN_LABEL = { prevention: 'Prevention', detection: 'Detection', suppression: 'Suppression' };
// Order matters: the named concern wins, then the plain synonyms, suppression before detection before prevention.
const CONCERN_WORDS = [
  ['suppression', /\bsuppress\w*/], ['detection', /\bdetect\w*/], ['prevention', /\bprevent\w*/],
  ['suppression', /\b(extinguish\w*|put(ting)? (it |the fire |a fire |the flame )?out|douse\w*|quench\w*|water mist)\b/],
  ['detection', /\b(smoke|smoky|alarm\w*|sensor\w*|notice\w*)\b/],
  ['prevention', /\b(ignit\w*|burn\w*|flammab\w*|catch(es)? fire|flame spread|spread\w*)\b/]
];
// Tried in order, so "rover on the Moon" is the rover and "Mars transit" is the Mars habitat.
const CABIN_WORDS = [
  ['rover', /\brovers?\b/], ['mars-base', /\b(mars|martian)\b/], ['lunar-base', /\b(moon|lunar)\b/],
  ['station', /\b(station|iss)\b/], ['spacecraft', /\b(transit|spacecraft|deep space)\b/]
];

export const normalize = text => ` ${String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

function findMaterial(text, db) {
  const names = [];
  for (const [id, m] of Object.entries(db.materials ?? {})) for (const name of new Set([normalize(m.label), normalize(id)])) if (name.trim()) names.push({ id, name });
  names.sort((a, b) => b.name.length - a.name.length || a.id.localeCompare(b.id));
  return names.find(n => text.includes(n.name))?.id ?? null;
}

function findCabin(text, db) {
  const labelled = (db.presets ?? []).flatMap(p => [p.label, p.short].filter(Boolean).map(name => ({ id: p.id, name: normalize(name) })))
    .sort((a, b) => b.name.length - a.name.length).find(n => text.includes(n.name));
  if (labelled) return labelled.id;
  const word = CABIN_WORDS.find(([id, re]) => db.presetById?.[id] && re.test(text));
  return word ? word[0] : null;
}

/** Pure. Returns what the fixed rules read in the text; a null field was not found. */
export function parseQuestion(text, db) {
  const t = normalize(text);
  return Object.freeze({ material: findMaterial(t, db), concern: CONCERN_WORDS.find(([, re]) => re.test(t))?.[0] ?? null, cabin: findCabin(t, db) });
}

export const materialList = db => Object.values(db.materials ?? {}).map(m => m.label);

/** Pure. `current` is the visitor's current cabin query (o2, p, gclass, preset); it is used when the text names no cabin. */
export function answerTyped(text, db, current = null) {
  const parsed = parseQuestion(text, db);
  if (!String(text ?? '').trim()) return Object.freeze({ kind: 'empty', parsed });
  if (!parsed.material) return Object.freeze({ kind: 'no_material', parsed,
    message: 'No material from this collection was recognised in the question.', materials: Object.freeze(materialList(db)) });
  const concern = parsed.concern ?? 'prevention', material = parsed.material, label = db.materials[material].label;
  const named = parsed.cabin ? presetPoint(db, parsed.cabin, concern, material) : null;
  const point = named ?? (current && Number.isFinite(current.o2) && Number.isFinite(current.p) ? current : null)
    ?? presetPoint(db, db.presets?.[0]?.id, concern, material);
  if (!point) return Object.freeze({ kind: 'no_cabin', parsed, message: 'No cabin is loaded to compare against.' });
  const cabinAssumed = !named, cabin = db.presetById?.[point.preset]?.label ?? 'your custom cabin';
  const cell = statusCell(material, concern, point, db);
  const summary = questionSummary(cell, db, { material: label, concern: CONCERN_LABEL[concern], cabin });
  const assumed = [];
  if (!parsed.concern) assumed.push(`No concern was named, so ${CONCERN_LABEL[concern].toLowerCase()} was assumed.`);
  if (cabinAssumed) assumed.push(`No cabin was named, so the current cabin (${cabin}) was used.`);
  return Object.freeze({ kind: 'answer', parsed, material, materialLabel: label, concern, concernAssumed: !parsed.concern,
    preset: point.preset ?? null, cabin, cabinAssumed, summary, assumed: Object.freeze(assumed),
    rowId: cell.hit_ids?.[0] ?? cell.nearest?.id ?? null, rowIsMatch: !!cell.hit_ids?.length });
}
