import { TOL, isMeasure } from './match.js';
import { W, LEVEL, SPAN, PARTIAL_SUPPORT } from './rank.js';
import { G } from './index.js';
import { clock } from './clock.js';

export const KPA_PER_PSI = 6.89476;

const trim = (x, d = 1) => String(Math.round(x * 10 ** d) / 10 ** d);
export const num = (x, d = 1) => x == null || !Number.isFinite(x) ? null : trim(x, d);
export const signed = (x, d = 1) => !Number.isFinite(x) ? null : (x > 0 ? '+' : x < 0 ? '-' : '') + trim(Math.abs(x), d);
const range = (v, unit, d = 1) => Array.isArray(v) ? (v[0] === v[1] ? `${trim(v[0], d)}${unit}` : `${trim(v[0], d)} to ${trim(v[1], d)}${unit}`) : `${trim(v, d)}${unit}`;

export function pressure(kpa, missing = 'not stated') {
  if (!isMeasure(kpa)) return missing;
  const psia = v => v / KPA_PER_PSI;
  return Array.isArray(kpa) ? `${range(kpa.map(psia), ' psia')} (${range(kpa, ' kPa')})` : `${trim(psia(kpa))} psia (${trim(kpa)} kPa)`;
}
export const psia = kpa => !Number.isFinite(kpa) ? null : Math.round(kpa / KPA_PER_PSI * 10) / 10;
export const oxygen = (o2, missing = 'not stated') => !isMeasure(o2) ? missing : range(o2, ' % O2');

export const STATUS_LINE = 'STATUS = EVIDENCE COVERAGE, NOT A SAFETY CERTIFICATION';
export const SCOPE = 'decision-support prototype, not certified flight software';
export const NOT_IN_RECORD = 'not stated in the PSI record';
export const NOT_IN_TABLE = 'not in the table';
export const NOT_IN_SOURCE = 'not stated in the source';
export const CHOICES = "The weights, spans and tolerances are VESTA's choices, not NASA's. They are published in api/v1/index.json so anyone can re-rank.";
export const SCORE_LABEL = "relevance, 0 to 100 · VESTA's weighting, not a probability and not a safety rating";
export const NO_SOURCE_LINE = "NO SOURCE. No verified finding in VESTA's evidence base for this. I will not guess.";
export const NO_PROTOCOL_LINE = 'Hand the decision to the crew. No verified protocol line for this step.';

export function base(n) {
  const k = n && typeof n === 'object' ? n.investigations?.length : n;
  return k ? `in VESTA's evidence base (${k} PSI investigations)` : "in VESTA's evidence base";
}

const STATUS = { PROVEN: 'NEARBY EVIDENCE', EXTRAPOLATED: 'OTHER CONDITIONS', NEVER_TESTED: 'NO SOURCE FOUND', SOURCED: 'SOURCED', NO_SOURCE: 'NO SOURCE',
                 SIMULATED: 'SIMULATED', INTERPRETATION: 'INTERPRETATION', SI: 'SI' };
export function status(id, qualifier) {
  const s = STATUS[id] ?? String(id ?? '');
  return qualifier === 'pressure_inferred' ? `${s} · pressure inferred` : s;
}
const STATUS_MEANING = {
  PROVEN: "Source evidence near these atmosphere conditions, in the same gravity class, in VESTA's collection",
  EXTRAPOLATED: "Evidence in VESTA's collection has different or incomplete conditions, or lacks a matching test row",
  NEVER_TESTED: "No test row or verified finding for this material and concern in VESTA's evidence base",
  SOURCED: 'This step has a source; condition coverage is shown separately',
  NO_SOURCE: 'No supporting finding, so VESTA does not guess',
  SIMULATED: 'A scripted drill, not measured flight data',
  INTERPRETATION: "VESTA's reading of the evidence, not a NASA instruction",
  SI: 'Written by synthetic intelligence'
};
export function statusMeaning(id, qualifier) {
  const words = STATUS_MEANING[id] ?? String(id ?? '');
  return qualifier === 'pressure_inferred' ? `${words}; pressure is inferred from the facility` : words;
}
export function legend(n) {
  return {
    PROVEN: `At least one PSI source-table row for this material and concern meets VESTA's matching rules: the same gravity class, oxygen within ${trim(TOL.o2)} percentage point and pressure within ${trim(TOL.p)} kPa of the cabin, on the same row ${base(n)}. Flow, sample geometry, thickness, ignition and suppressant configuration are not matched. This does not establish experimental equivalence or cabin safety.`,
    PROVEN_INFERRED: 'Pressure is inferred, not reported in the table. The match assumes the facility pressure applies to this run.',
    EXTRAPOLATED: `Evidence exists ${base(n)}, but conditions differ, are incomplete, or no matching experimental row is available. The reasons identify what prevents a nearby match.`,
    NEVER_TESTED: `No test row and no verified finding for this question ${base(n)}.`,
    line: STATUS_LINE };
}

const CONCERN = { prevention: 'Prevention', detection: 'Detection', suppression: 'Suppression', design: 'Design', response: 'Response' };
export const concern = id => CONCERN[id] ?? String(id ?? '');

const GCLASS = { micro: 'microgravity', partial: 'partial gravity', normal: 'normal gravity' };
export const gravity = id => G[id]?.label ?? GCLASS[id] ?? 'not stated';

const WORK = { flight: 'flight experiment', ground_lowg: 'ground low-gravity test', normal_g: 'normal-gravity test',
               model: 'model or analysis', operations: 'ISS operations', summary: 'NASA summary' };
const READ_IN = { psi_table: 'a PSI table', psi_record: 'the PSI record', pi_paper: 'a paper by the investigators', nasa_report: 'a NASA report',
                  nasa_review: 'a NASA review', nasa_page: 'a NASA page', challenge_page: 'the Space Apps challenge page' };
const YEARED = ['nasa_report', 'nasa_review', 'pi_paper'];
export const work = id => WORK[id] ?? WORK.summary;
export function level(n, year) {
  if (n && n.n) { year = year ?? n.source?.year; n = n.n; }
  if (!n) return '';
  let where = READ_IN[n.read_in] ?? READ_IN.nasa_page;
  if (year && YEARED.includes(n.read_in)) where = where.replace(/^a /, `a ${year} `);
  return `${work(n.work)} · read in ${where}`;
}

const BASIS = { experiment: 'from experiments', summary: 'from NASA summaries', operations: 'from ISS operations', no_source: 'no source' };
export const basis = id => BASIS[id] ?? BASIS.no_source;

const HABITAT = { station: 'space stations', spacecraft: 'spacecraft', 'lunar-base': 'lunar bases', rover: 'pressurized rovers', 'mars-base': 'Mars bases' };
export const habitat = id => HABITAT[id] ?? null;

const FUEL_CLASS = { solid: 'solid material', smoke_source: 'smoke source', liquid_droplet: 'liquid droplet', gas: 'gas burner', aerosol: 'aerosol', none: 'no fuel' };
export const fuelClass = id => FUEL_CLASS[id] ?? NOT_IN_SOURCE;

const above = (x, unit) => `${trim(Math.abs(x))} ${unit} ${x > 0 ? 'above' : 'below'}`;
const REASON = {
  gravity_never_tested: {
    chip: v => `no ${v.q?.g_label ?? 'partial-gravity'} test row in this evidence base`,
    sentence: v => `No test row at partial gravity ${base(v.n)}; this evidence comes from another gravity level.` },
  gravity_differs: {
    chip: () => 'gravity differs',
    sentence: v => `Tested at another gravity level than your cabin${v.q?.g_label ? ` (${v.q.g_label})` : ''}.` },
  gravity_not_reported: {
    chip: () => 'gravity not stated',
    sentence: () => 'Gravity is not stated in the source. A condition the source does not state never counts as a match.' },
  o2_outside: {
    chip: v => v.delta?.o2 != null ? `oxygen ${signed(v.delta.o2)} points` : 'oxygen outside',
    sentence: v => v.delta?.o2 != null
      ? `Your cabin is ${above(v.delta.o2, 'points of oxygen')} the compared test value; the tolerance is ${trim(TOL.o2)} point.`
      : `Oxygen is more than ${trim(TOL.o2)} point from the tested value.` },
  o2_not_reported: {
    chip: () => 'oxygen not stated',
    sentence: () => 'The source or cabin does not state the surrounding oxygen level, so it cannot be matched.' },
  pressure_outside: {
    chip: v => v.delta?.p != null ? `pressure ${signed(v.delta.p)} kPa` : 'pressure outside',
    sentence: v => v.delta?.p != null
      ? `Your cabin is ${above(v.delta.p, 'kPa')} the compared test pressure; the tolerance is ${trim(TOL.p)} kPa.`
      : `Pressure is more than ${trim(TOL.p)} kPa from the tested value.` },
  pressure_not_reported: {
    chip: () => 'pressure not stated',
    sentence: () => 'The source or cabin does not state pressure, so it cannot be matched.' },
  not_an_experiment: {
    chip: () => 'not a test result',
    sentence: () => 'The sentence is a summary, a model, a plan or a procedure; it reports no single test result.' },
  different_fuel_class: {
    chip: () => 'different type of fuel',
    sentence: () => 'The evidence concerns a different type of fuel from the one in your question.' },
  finding_without_rows: {
    chip: () => 'source found, no test row',
    sentence: () => 'A verified finding names this material, but no PSI test row does for this concern.' },
  no_row_no_finding: {
    chip: () => 'no test row or finding',
    sentence: v => `No test row and no verified finding for this material and concern ${base(v.n)}.` },
  pressure_inferred: {
    chip: () => 'pressure inferred',
    sentence: () => 'The table does not report pressure. The match assumes the facility pressure applies to this run.' },
  rule_without_verified_finding: {
    chip: () => 'rule has no verified finding',
    sentence: v => `The rule for this step has no verified finding left ${base(v.n)}.` },
  no_verified_finding_on_topic: {
    chip: () => 'no verified finding',
    sentence: v => `No verified finding on this topic ${base(v.n)}.` },
};
export const REASON_CODES = Object.keys(REASON);
export const reason = (code, values = {}) => REASON[code] ? REASON[code].chip(values ?? {}) : String(code ?? '').replace(/_/g, ' ');
export const reasonSentence = (code, values = {}) => REASON[code] ? REASON[code].sentence(values ?? {}) : String(code ?? '').replace(/_/g, ' ');
export const reasons = n => Object.fromEntries(REASON_CODES.map(c => [c, REASON[c].sentence({ n })]));

export function delta(d = {}) {
  const parts = [];
  if (Number.isFinite(d.o2)) parts.push(`${signed(d.o2)} points O2`);
  if (Number.isFinite(d.p)) parts.push(`${signed(d.p)} kPa`);
  return parts.length ? `${parts.join(', ')} from your cabin` : 'no oxygen or pressure value to compare';
}

export function cellSentence(c, label, n) {
  const what = `${label ?? c.material} and ${String(concern(c.concern)).toLowerCase()}`;
  if (c.status === 'NEVER_TESTED') return `No test row and no verified finding for ${what} ${base(n)}.`;
  if (c.status === 'PROVEN')
    return `${c.hit_ids.length} PSI source-table ${c.hit_ids.length === 1 ? 'row' : 'rows'} for ${what} near these atmosphere conditions ${base(n)}`
         + (c.qualifier === 'pressure_inferred' ? ', with the pressure inferred from the facility.' : '.');
  if (c.reasons.includes('finding_without_rows')) return `A verified finding speaks to ${what}; no PSI test row does ${base(n)}.`;
  return `${c.rows} PSI source-table ${c.rows === 1 ? 'row' : 'rows'} for ${what} ${base(n)}; none matches these gravity and atmosphere conditions.`;
}
export function materialNote(f, q, db) {
  if (!q.material || (f.n.material_ids ?? []).includes(q.material)) return null;
  const ids = f.n.material_ids ?? [];
  return ids.length ? `Different material: ${ids.map(id => db.materials[id]?.label ?? id.replace(/[-_]/g, ' ')).join(', ')}.`
    : 'This source does not name the selected material.';
}
export function designAnswer(counts, n) {
  const total = counts.PROVEN + counts.EXTRAPOLATED + counts.NEVER_TESTED;
  if (!total) return `There are no material questions to compare ${base(n)}.`;
  return `${counts.PROVEN} of ${total} material questions have nearby test rows; ${counts.NEVER_TESTED} have no row or finding ${base(n)}.`;
}
export function incidentAnswer(meta, t, log, db) {
  const state = clock(meta, t, log, db);
  const done = state.decided.steps, made = `${done} ${done === 1 ? 'decision' : 'decisions'} made in this scripted drill.`;
  if (state.heard == null) return `${made} Earth's hearing time has no verified source.`;
  if (t < state.heard) return `${made} Earth has not heard the alarm yet.`;
  const before = log.filter(e => e.t <= t && e.t < state.heard).length;
  return `${before} ${before === 1 ? 'decision was' : 'decisions were'} made before Earth heard the alarm in this scripted drill.`;
}
export const elsewhere = c => c.elsewhere?.length ? `this material also appears in: ${c.elsewhere.join(', ')}` : null;
export function observed(list = []) {
  return list.map(o => o.texts ? `${o.name.replace(/_/g, ' ')}: ${o.texts.join('; ')} (${o.n})`
    : `${o.name.replace(/_/g, ' ')}: ${o.min === o.max ? trim(o.min, 2) : `${trim(o.min, 2)} to ${trim(o.max, 2)}`}${o.unit ? ' ' + o.unit : ''} (${o.n})`);
}

export function gaps(ax, q, n) {
  const out = [], model = k => k ? `${k} ${k === 1 ? 'row' : 'rows'} on model fuels (liquid droplets, gas burners): a different fuel class` : null;
  if (ax.gravity.cabin === 0) out.push({ axis: 'gravity', label: `Gravity ${q.g_label ?? gravity(q.gclass)}`, count: 0,
    sentence: `No cabin-material test row at ${q.g_label ?? gravity(q.gclass)} ${base(n)}.`,
    extra: ax.gravity.all ? `${ax.gravity.all} rows of other tables at this gravity: not cabin materials` : null });
  if (ax.o2.cabin === 0) out.push({ axis: 'o2', label: `Cabin materials at ${oxygen(q.o2)}`, count: 0,
    sentence: `No cabin-material test row within ${trim(TOL.o2)} point of ${oxygen(q.o2)} ${base(n)}.`,
    extra: [ax.o2.cabin_max != null ? `tested from ${trim(ax.o2.cabin_min)} to ${trim(ax.o2.cabin_max)} %` : null, model(ax.o2.model)].filter(Boolean).join(' · ') || null });
  if (ax.pressure.cabin === 0) out.push({ axis: 'pressure', label: `Cabin materials at ${pressure(q.p)}`, count: 0,
    sentence: `No cabin-material test row within ${trim(TOL.p)} kPa of ${pressure(q.p)} ${base(n)}.`,
    extra: model(ax.pressure.model) });
  return out;
}

const pct = x => `${trim(x * 100, 0)} %`;
export const TERMS = Object.keys(W);
export const TERM_LABEL = { pillar: 'Pillar', atmosphere: 'Atmosphere', gravity: 'Gravity', level: 'Evidence level', material: 'Material', habitat: 'Habitat' };
export const levelLine = () => {
  const v = k => trim(W.level * LEVEL[k]);
  return `Flight experiment ${v('flight')} · ground low-gravity ${v('ground_lowg')} · normal-gravity test ${v('normal_g')} · NASA summary or ISS operations ${v('summary')} · model ${v('model')}.`;
};
export function term(key, entry, q) {
  const f = entry.f, n = f.n, t = entry.terms;
  switch (key) {
    case 'pillar':
      return t.pillar === 1 ? `Answers your concern (${q.concern}).`
           : t.pillar === 0.5 ? 'Cross-cutting (design or response): counts half.' : `About another pillar: counts ${pct(0.2)}.`;
    case 'atmosphere': {
      const src = n.o2 != null || n.p != null
        ? `Source states ${[n.o2 != null ? oxygen(n.o2) : null, n.p != null ? pressure(n.p) : null].filter(Boolean).join(' and ')}; your cabin is ${oxygen(q.o2)} and ${pressure(q.p)}.` : null;
      const miss = [n.o2 == null ? `Oxygen not stated in the source: counts ${pct(0.3)}.` : null, n.p == null ? `Pressure not stated in the source: counts ${pct(0.3)}.` : null];
      return [src, ...miss, `Oxygen is ${pct(0.7)} of this term and pressure ${pct(0.3)}; closeness reaches zero ${trim(SPAN.o2)} points or ${trim(SPAN.p)} kPa away.`].filter(Boolean).join(' ');
    }
    case 'gravity':
      if (n.gclass == null) return `Gravity not stated: counts ${pct(0.3)}.`;
      if (n.gclass === q.gclass) return 'Same gravity class as your cabin.';
      return `Tested in ${gravity(n.gclass)}; your cabin is at ${q.g_label ?? gravity(q.gclass)}: counts ${pct(0.4)}.`
           + (q.gclass === 'partial' ? " The challenge page says such results 'could bound' intermediate gravity; that is not demonstrated." : '');
    case 'level':
      return `This one: ${work(n.work)}. ${levelLine()}`;
    case 'material':
      return !q.material ? 'No material picked: neutral.'
           : t.material === 1 ? 'About the material you picked.'
           : t.material === 0.3 ? `General statement, no material named: counts ${pct(0.3)}.`
           : t.material === 0.5 ? 'Same fuel class as your material: counts half.' : 'About another fuel class than your material: counts 0.';
    case 'habitat':
      return t.habitat === 1 ? `Tagged for ${habitat(q.habitat) ?? 'this habitat'} by the Extractor (an SI-assigned tag).` : 'Not tagged for this habitat by the Extractor: counts 0.';
    case 'support':
      return n.support === 'direct' ? null : `The quote supports the claim only in part: total x ${PARTIAL_SUPPORT}.`;
    default: return '';
  }
}
export function terms(entry, q) {
  const rows = TERMS.map(k => ({ key: k, label: TERM_LABEL[k], max: W[k], value: Math.round(entry.parts[k] * 10) / 10, sentence: term(k, entry, q) }));
  const s = term('support', entry, q);
  if (s) rows.push({ key: 'support', label: 'Support', max: null, value: null, sentence: s });
  return rows;
}
