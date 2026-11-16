// Recorded but not matched: what a source row says about flow, specimen and ignition.
// The matching rule compares gravity class, oxygen and pressure only. This module reads the
// other recorded fields verbatim so the limit is visible per row. It never converts a fan or
// air setting into a velocity, never infers a thickness and never ranks or compares rows.
import * as status from './status.js';

export const HEADING = 'Recorded but not matched';
export const ABSENT = 'not in the table';
export const SETTING_NOTE = 'Fan, air and restrictor entries are settings without a unit in the table. VESTA does not convert them to a velocity.';

const FIXED = [
  { key: 'flow', group: 'flow', label: 'Flow (cm/s column)', read: row => row.flow_raw ?? row.flow_cm_s },
  { key: 'flow_direction', group: 'flow', label: 'Flow direction', read: row => row.flow_direction },
  { key: 'fuel_form', group: 'specimen', label: 'Specimen form', read: row => row.fuel_form },
  { key: 'fuel_size', group: 'specimen', label: 'Specimen size', read: row => row.fuel_size },
  { key: 'fuel_raw', group: 'specimen', label: 'Specimen as written', read: row => row.fuel_raw }
];
const LABELS = { fan_display: 'Fan display', air_display: 'Air display', flow_restrictor: 'Flow restrictor',
  ignition_power_w: 'Ignition power', ignition_time_s: 'Ignition time' };
const GROUPS = [['setting', /fan|air_display|restrictor|blower/], ['flow', /flow|velocity/], ['ignition', /ignit/],
  ['suppressant', /suppress|extinguish/], ['specimen', /thick/]];
const SKIP = /flow_rate|_mfc_/; // gas-burner fuel supply rates are not an ambient flow

const present = value => value != null && String(value).trim() !== '';
const verbatim = value => String(value).trim();
const humanize = key => { const words = key.replace(/_/g, ' '); return words[0].toUpperCase() + words.slice(1); };
const groupOf = key => SKIP.test(key) ? null : (GROUPS.find(([, pattern]) => pattern.test(key)) || [null])[0];
const withUnit = (raw, unit) => !unit || raw.includes(unit) ? raw : /\s/.test(unit) ? `${raw} · ${unit}` : `${raw} ${unit}`;
const field = (key, group, label, value, unit = null) => {
  const recorded = present(value), text = recorded ? verbatim(value) : null;
  return { key, group, label, recorded, value: text, unit: recorded ? unit : null,
    text: recorded ? `recorded: ${withUnit(text, unit)}` : ABSENT };
};

// Every always-shown field plus the flow-setting, ignition and suppressant fields the row carries.
export function rowContext(row) {
  const fields = FIXED.map(item => field(item.key, item.group, item.label, item.read(row)));
  for (const [key, entry] of Object.entries(row?.conditions ?? {})) {
    const group = groupOf(key), raw = entry?.raw ?? entry?.value;
    if (group && present(raw)) fields.push(field(key, group, LABELS[key] || humanize(key), raw, entry?.unit ?? null));
  }
  if (present(row?.diluent)) fields.push(field('diluent', 'suppressant', 'Diluent gas', row.diluent));
  const has = key => fields.some(item => item.key === key && item.recorded);
  return { id: row.id, fields,
    flow: has('flow'),
    setting: fields.some(item => item.group === 'setting'),
    size: has('fuel_size'),
    // Only a size text that itself says "thick" counts; an unlabeled dimension is not read as a thickness.
    thickness: has('fuel_size') && /thick/i.test(row.fuel_size),
    ignition: fields.some(item => item.group === 'ignition') };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Counts over the nearby rows of one question, or over all its source rows when none is nearby.
export function questionContext(material, concern, q, db, core = { status }) {
  const rows = (db.rowsByMaterial[material] ?? []).filter(row => row.n.pillars.includes(concern));
  const cell = core.status.cell(material, concern, q, db);
  const hits = new Set(cell.hit_ids ?? []);
  const scope = hits.size ? 'nearby' : 'question';
  const scoped = hits.size ? rows.filter(row => hits.has(row.id)) : rows;
  const contexts = scoped.map(rowContext), count = key => contexts.filter(item => item[key]).length;
  const counts = { total: scoped.length, flow: count('flow'), setting: count('setting'), size: count('size'),
    thickness: count('thickness'), ignition: count('ignition') };
  let sentence;
  if (!counts.total) sentence = 'No source row for this question in this collection, so no flow or thickness is recorded here.';
  else {
    const lead = scope === 'nearby' ? `Of the ${plural(counts.total, 'nearby row')}`
      : `No nearby row. Of the ${plural(counts.total, 'source row')} for this question`;
    sentence = `${lead}, flow is recorded in ${counts.flow} and a named thickness in ${counts.thickness}; none is compared.`;
  }
  return { material, concern, scope, row_ids: scoped.map(row => row.id), counts, sentence,
    note: counts.setting ? SETTING_NOTE : null };
}
