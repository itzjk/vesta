// Burn length in microgravity versus normal gravity, as recorded in the Saffire-II table (PSI-99).
// This is a reading of nine table rows, not a model: every value is shown as the row records it,
// and a sample is compared only when the row supports it. Nothing is interpolated to the Moon or Mars.
// Nine samples on one sample card in one experiment support no general law.
export const GRAVITY_CONTRAST = Object.freeze({
  id: 'saffire-ii-gravity-contrast/1', investigation: 'PSI-99',
  micro: 'microgravity_burn_length_cm', normal: 'normal_gravity_burn_length_cm',
  comparisons: Object.freeze({
    further_normal: 'burned further in normal gravity',
    further_micro: 'burned further in microgravity',
    same: 'same',
    not_comparable: 'not comparable'
  }),
  // How a pair was compared. "complete_word" is a reading, not a number, and is counted apart.
  bases: Object.freeze({
    numbers: 'a number is recorded at both gravity levels',
    complete_word: 'the table says “Complete” for at least one level; read as the full sample length recorded in the same row'
  }),
  scope: 'Nine samples, one experiment, microgravity vs normal gravity on the ground; the Moon and Mars lie between and no row in this collection tests them.',
  limits: 'Rows are table records, not independent experiments. Nine samples from one experiment support no general law, and nothing here rates a material.'
});

const finite = Number.isFinite;
const text = value => typeof value === 'string' ? value : null;

/** One recorded burn-length cell. `value` and `raw` are passed through untouched; `kind` says what the cell can support. */
export function readLength(cell) {
  const raw = text(cell?.raw), shown = (raw ?? '').trim();
  let kind;
  if (!shown || /^n\/?a\b/i.test(shown)) kind = 'missing';
  else if (/^complete$/i.test(shown)) kind = 'complete';
  else if (/&|\band\b|\bto\b|\d\s*[-–]\s*\d/i.test(shown)) kind = 'compound';
  else if (finite(cell?.value) && cell.value >= 0) kind = 'number';
  else kind = 'text';
  const note = text(cell?.note) ?? shown.match(/\(\s*(note\s*\d+)\s*\)/i)?.[1] ?? null;
  return { raw, value: finite(cell?.value) ? cell.value : null, unit: text(cell?.unit), approx: cell?.approx === true, note, kind };
}

const single = (value, units) => { const m = /^(\d+(?:\.\d+)?)\s*([a-z]+)$/i.exec(value ?? ''); return m && units.includes(m[2]) ? Number(m[1]) : null; };
/** Sample size from the recorded `fuel_size` string. A value that is not one plain number stays as text and is flagged, never repaired. */
export function readSize(fuelSize) {
  const parts = {};
  for (const piece of String(fuelSize ?? '').split(';')) { const m = /^(thickness|length|width)\s+(.*)$/i.exec(piece.trim()); if (m) parts[m[1].toLowerCase()] = m[2].trim(); }
  const flags = [], thickness = parts.thickness ?? null, length = parts.length ?? null;
  if (thickness === null) flags.push({ id: 'thickness_missing', text: 'No thickness is recorded in the row.' });
  else if (/^0\d/.test(thickness)) flags.push({ id: 'thickness_suspicious', text: `Thickness is recorded as “${thickness}”. Shown as recorded; VESTA does not correct it.` });
  else if (single(thickness, ['mm', 'cm']) === null) flags.push({ id: 'thickness_not_single', text: `Thickness is recorded as “${thickness}”, not one number.` });
  const lengthCm = single(length, ['cm']);
  if (length === null) flags.push({ id: 'length_missing', text: 'No sample length is recorded in the row.' });
  else if (lengthCm === null) flags.push({ id: 'length_not_single', text: `Sample length is recorded as “${length}”, not one number.` });
  return { raw: text(fuelSize), thickness_raw: thickness, length_raw: length, length_cm: lengthCm, width_raw: parts.width ?? null, flags };
}

const reasonOf = (side, reading) => ({
  missing: `no ${side} burn length is recorded`,
  compound: `the ${side} entry “${reading.raw}” is a compound or range entry`,
  text: `the ${side} entry “${reading.raw}” is not one number in the row`
})[reading.kind];

/** Plain comparison of the two recorded burn lengths. No number is supplied that the row does not hold. */
export function compare(micro, normal, lengthCm) {
  const none = reason => ({ id: 'not_comparable', label: GRAVITY_CONTRAST.comparisons.not_comparable, basis: null, reason });
  for (const [side, reading] of [['microgravity', micro], ['normal-gravity', normal]]) if (!['number', 'complete'].includes(reading.kind)) return none(reasonOf(side, reading));
  const worded = micro.kind === 'complete' || normal.kind === 'complete';
  if (worded && !finite(lengthCm)) return none('“Complete” is recorded but the row gives no single sample length to read it against');
  // "Complete" is the whole sample; a number is the recorded length. Only the order is used, never a difference.
  const reach = reading => reading.kind === 'complete' ? lengthCm : reading.value;
  const m = reach(micro), n = reach(normal);
  if (worded && (m > lengthCm || n > lengthCm)) return none('a recorded burn length is longer than the recorded sample length');
  const id = m === n ? 'same' : n > m ? 'further_normal' : 'further_micro', basis = worded ? 'complete_word' : 'numbers';
  return { id, label: GRAVITY_CONTRAST.comparisons[id], basis, reason: null };
}

const fraction = (reading, lengthCm) => reading.kind === 'complete' ? 1
  : reading.kind === 'number' && finite(lengthCm) && lengthCm > 0 && reading.value <= lengthCm ? reading.value / lengthCm : null;

function noteTexts(tables) {
  const table = (Array.isArray(tables) ? tables : []).find(item => item?.psi_id === GRAVITY_CONTRAST.investigation), out = new Map();
  for (const note of table?.notes ?? []) { const m = /^note\s*(\d+)\b/i.exec(text(note?.text) ?? ''); if (m) out.set(m[1], note.text); }
  return out;
}

/**
 * The gravity contrast for every PSI-99 row.
 * @param {{tests: object[], investigations?: object[], tables?: object[]}} data arrays as shipped in web/data
 */
export function gravityContrast({ tests, investigations, tables } = {}) {
  const rows = (Array.isArray(tests) ? tests : []).filter(row => row?.psi_id === GRAVITY_CONTRAST.investigation).sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  const investigation = (Array.isArray(investigations) ? investigations : []).find(item => item?.psi_id === GRAVITY_CONTRAST.investigation) ?? null;
  const notes = noteTexts(tables), url = text(investigation?.psi_url);
  const withNote = reading => { const number = reading.note?.match(/\d+/)?.[0] ?? null; return { ...reading, note_text: number ? notes.get(number) ?? null : null }; };
  const samples = rows.map(row => {
    const size = readSize(row.fuel_size), micro = withNote(readLength(row.outcomes?.[GRAVITY_CONTRAST.micro])), normal = withNote(readLength(row.outcomes?.[GRAVITY_CONTRAST.normal]));
    const flags = [...size.flags];
    if (!text(row.fuel)) flags.push({ id: 'material_missing', text: 'The material cell of this row is empty in the table. VESTA does not fill it in.' });
    return {
      id: row.id, source_url: url, sample: text(row.test_label), material: text(row.fuel), material_raw: text(row.fuel_raw),
      flow_direction: text(row.flow_direction), burn_time_raw: text(row.outcomes?.burn_time_s?.raw),
      size, micro: { ...micro, fraction: fraction(micro, size.length_cm) }, normal: { ...normal, fraction: fraction(normal, size.length_cm) },
      comparison: compare(micro, normal, size.length_cm), approximate: micro.approx || normal.approx, flags
    };
  });
  const count = (list, id) => list.filter(sample => sample.comparison.id === id).length;
  const tally = list => { const further_normal = count(list, 'further_normal'), further_micro = count(list, 'further_micro'), same = count(list, 'same');
    return { comparable: further_normal + further_micro + same, differ: further_normal + further_micro, same, further_normal, further_micro }; };
  const summary = { samples: samples.length, ...tally(samples), not_comparable: count(samples, 'not_comparable'),
    numbers_only: tally(samples.filter(sample => sample.comparison.basis === 'numbers')),
    flagged: samples.filter(sample => sample.flags.length).length };
  return { id: GRAVITY_CONTRAST.id, investigation: GRAVITY_CONTRAST.investigation, name: text(investigation?.name), source_url: url, samples, summary, scope: GRAVITY_CONTRAST.scope, limits: GRAVITY_CONTRAST.limits };
}

const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const word = n => { const w = words[n] ?? String(n); return w[0].toUpperCase() + w.slice(1); };
/** The one sentence the landing page carries. It is rebuilt from the summary by the tests. */
export function landingSentence(summary) {
  return `in Saffire-II, ${summary.differ} of ${summary.comparable} comparable samples burned a different length in microgravity than in normal gravity (“Complete” read as the full sample length; ${summary.numbers_only.comparable} of ${summary.samples} give a number at both levels). ${word(summary.samples)} samples from one experiment support no general law.`;
}
/** The counts in words, for the panel. */
export function summaryText(summary) {
  return `${summary.differ} of ${summary.comparable} comparable samples burned a different length at the two gravity levels (${summary.further_normal} further in normal gravity, ${summary.further_micro} further in microgravity), ${summary.same} burned the same and ${summary.not_comparable} of ${summary.samples} ${summary.not_comparable === 1 ? 'is' : 'are'} not comparable. Only ${summary.numbers_only.comparable} of ${summary.samples} ${summary.numbers_only.comparable === 1 ? 'gives' : 'give'} a number at both levels (${summary.numbers_only.differ} differ, ${summary.numbers_only.same} same); the rest rely on the word “Complete”, read as the full sample length.`;
}
