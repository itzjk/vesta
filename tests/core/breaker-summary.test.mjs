// Adversarial tests for the pressure audit, the one-screen question summary and the prose
// that states numbers on the landing page and in the README.
// Tests marked { todo: ... } FAIL TODAY on a confirmed defect; node:test reports them without
// failing the run. Remove the todo flag once the product code or copy is fixed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint, designPoint, G } from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import { TOL } from '../../web/js/core/match.js';
import { questionSummary } from '../../web/js/core/question-summary.js';
import { pressureBasis, pressureDependence, pressureAudit, pressureAuditText, pressureDependenceText } from '../../web/js/core/assumption-audit.js';
import { validate } from '../../web/js/core/outcome-model.js';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const raw = Object.fromEntries(['meta', 'tests', 'findings', 'presets', 'investigations'].map(name => [name, JSON.parse(read(`web/data/${name}.json`))]));
const db = buildIndex(raw), html = read('web/index.html'), readme = read('README.md');
const text = s => [s.title, s.answer, ...s.lines, s.next].join(' ');
const custom = (o2, p, g) => designPoint({ preset: 'custom', o2, p, g }, db);

// Cabins built from the data itself: every rounded oxygen and pressure a cabin row sits near,
// plus values far outside anything a table could hold.
const pOf = row => row.n.p ?? row.n.p_inferred;
const dataO2 = [...new Set(db.cabinRows.map(r => r.n.o2).filter(Number.isFinite).map(Math.round))];
const dataP = [...new Set(db.cabinRows.map(pOf).filter(Number.isFinite).map(p => Math.round(p / 5) * 5))];
const maxO2 = Math.max(...db.cabinRows.map(r => r.n.o2).filter(Number.isFinite));
const maxP = Math.max(...db.cabinRows.map(pOf).filter(Number.isFinite));
const EXTREME_O2 = [0, 1e-9, 100, 150, 1e9, -5], EXTREME_P = [0, 0.001, 1e9, -1];

test('custom cabins across the data grid and at extremes never throw, never print a missing value and keep every count consistent', () => {
  let cabins = 0;
  for (const g of Object.keys(G)) for (const o2 of [...dataO2, ...EXTREME_O2]) for (const p of [...dataP, ...EXTREME_P]) {
    const q = custom(o2, p, g), cells = status.cells(q, db), tally = status.tally(cells), audit = pressureAudit(cells, db);
    cabins++;
    assert.equal(tally.PROVEN + tally.EXTRAPOLATED + tally.NEVER_TESTED, cells.length);
    assert.equal(audit.questions, tally.PROVEN);
    assert.equal(audit.reported + audit.inferred + audit.unknown, audit.nearby);
    assert.equal(pressureAuditText(audit) === '', tally.PROVEN === 0);
    for (const cell of cells) {
      const s = questionSummary(cell, db), d = pressureDependence(cell, db);
      assert.equal(s.status, cell.status);
      assert.doesNotMatch(text(s), /undefined|NaN|null|\bsafe\b|validated|certif/i, `${g} ${o2} ${p} ${cell.material}/${cell.concern}`);
      assert.equal(d.nearby > 0, cell.status === 'PROVEN');
      assert.equal(d.unknown, 0, 'a matched row always has a reported or an inferred pressure');
      assert.equal(d.state === 'all_inferred', cell.qualifier === 'pressure_inferred');
      if (cell.status === 'PROVEN') assert.match(s.lines[0], new RegExp(`^${cell.hit_ids.length} source-table rows? match`));
    }
  }
  assert.ok(cabins > 100);
});

test('oxygen or pressure beyond every cabin row plus the tolerance can never produce nearby evidence', () => {
  for (const g of Object.keys(G)) {
    for (const o2 of [maxO2 + TOL.o2 + 0.01, 100, 1e9]) assert.equal(status.tally(status.cells(custom(o2, dataP[0], g), db)).PROVEN, 0, `o2 ${o2}`);
    for (const p of [maxP + TOL.p + 0.01, 1e9]) assert.equal(status.tally(status.cells(custom(dataO2[0], p, g), db)).PROVEN, 0, `p ${p}`);
  }
  // No row sits at a partial-gravity class, so no lunar or Mars cabin can match whatever its atmosphere.
  assert.equal(db.tests.filter(r => r.n.gclass === 'partial').length, db.base.partial_rows);
  if (db.base.partial_rows === 0) for (const g of ['moon', 'mars']) for (const o2 of dataO2) for (const p of dataP)
    assert.equal(status.tally(status.cells(custom(o2, p, g), db)).PROVEN, 0);
});

test('junk custom inputs fall back to finite numbers instead of reaching the matcher as text or NaN', () => {
  for (const o2 of ['abc', '', null, undefined, NaN, Infinity, {}, []]) for (const p of ['x', '', null, NaN, -Infinity]) {
    const q = designPoint({ preset: 'custom', o2, p, g: 'not-a-gravity' }, db);
    assert.ok(Number.isFinite(q.o2) && Number.isFinite(q.p) && q.gclass && q.g_label, JSON.stringify(q));
  }
});

test('the tolerance wording in the summary and the README follows the matcher constants', () => {
  const word = { 1: 'one', 5: 'five' };
  const o2 = questionSummary({ status: 'EXTRAPOLATED', material: 'm', concern: 'c', rows: 2, reasons: ['o2_outside'] }, db).lines[1];
  const p = questionSummary({ status: 'EXTRAPOLATED', material: 'm', concern: 'c', rows: 2, reasons: ['pressure_outside'] }, db).lines[1];
  assert.match(o2, new RegExp(`more than ${TOL.o2} percentage point`));
  assert.match(p, new RegExp(`more than ${TOL.p} kPa`));
  assert.ok(word[TOL.o2] && word[TOL.p], 'extend the number words if the tolerances change');
  assert.ok(readme.includes(`oxygen within **${word[TOL.o2]} percentage point** and pressure within **${word[TOL.p]} kPa**`));
});

test('every reason the matcher can emit has plain wording, and unknown reasons never leak an identifier', () => {
  const seen = new Set();
  for (const g of Object.keys(G)) for (const o2 of [dataO2[0], 1e9]) for (const p of [dataP[0], 1e9])
    for (const cell of status.cells(custom(o2, p, g), db)) (cell.reasons ?? []).forEach(r => seen.add(r));
  for (const preset of db.presets) for (const cell of status.cells(presetPoint(db, preset.id), db)) (cell.reasons ?? []).forEach(r => seen.add(r));
  assert.ok(seen.size >= 4);
  for (const reason of seen) {
    if (reason === 'no_row_no_finding') continue; // NEVER_TESTED has its own sentence
    const s = questionSummary({ status: 'EXTRAPOLATED', material: 'm', concern: 'c', rows: reason === 'finding_without_rows' ? 0 : 3, finding_ids: ['x'], reasons: [reason] }, db);
    assert.doesNotMatch(text(s), /_|undefined/, reason);
    assert.doesNotMatch(s.lines[1], new RegExp(reason.replaceAll('_', ' ')), `${reason} has no written wording`);
  }
  assert.doesNotMatch(text(questionSummary({ status: 'EXTRAPOLATED', material: 'm', concern: 'c', rows: 1, reasons: ['some_new_reason'] }, db)), /_/);
});

test('the audit helpers accept empty and partial inputs without throwing or mutating', () => {
  for (const cell of [null, undefined, {}, { hit_ids: [] }, { hit_ids: null }]) {
    const d = pressureDependence(cell, db);
    assert.deepEqual([d.nearby, d.state, pressureDependenceText(d)], [0, 'no_nearby_rows', '']);
  }
  for (const cells of [null, undefined, [], [null], [{}]]) assert.equal(pressureAudit(cells, db).nearby, 0);
  for (const value of [null, undefined, {}, { nearby: 0 }]) { assert.equal(pressureAuditText(value), ''); assert.equal(pressureDependenceText(value), ''); }
  const unknownIds = pressureDependence({ hit_ids: ['no-such-row', '__proto__', 'constructor'] }, db);
  assert.deepEqual([unknownIds.nearby, unknownIds.unknown, unknownIds.state], [3, 3, 'mixed']);
  assert.ok(Object.isFrozen(unknownIds) && Object.isFrozen(unknownIds.unknown_row_ids));
});

test('README collection numbers are the loaded data, not remembered figures', () => {
  const tests = raw.tests.tests, n = x => x.toLocaleString('en-US');
  const ambient = tests.filter(r => r.o2_basis === 'ambient' && r.o2_percent != null).length;
  assert.ok(readme.includes(`rows that state ambient oxygen (${n(ambient)} of ${n(tests.length)})`));
  assert.ok(readme.includes(`all ${status.cells(presetPoint(db, 'lunar-base'), db).length} material questions, ${n(raw.findings.findings.length)} findings and ${n(tests.length)} source-table rows`));
  assert.ok(readme.includes(`VESTA's collection contains ${db.investigations.length} PSI investigations.`));
  assert.ok(readme.includes(`the ${raw.meta.counts.tables}-table inventory`));
});

test('README FLEX model figures equal a fresh evaluation, including the admission that it does not beat the baseline', () => {
  const v = validate(raw.tests.tests), c = v.class_recall.completion;
  for (const sentence of [
    `holds out ${v.test_days} known test dates`,
    `Of ${v.rows_in_table} outcome-labelled rows, ${v.rows_excluded_missing_input} lack an input and ${v.rows_excluded_unavailable_date} lack a usable normalized date; ${v.rows} are evaluated.`,
    `it answers ${v.answered} and abstains on ${v.abstained}: ${v.correct}/${v.rows} correct versus ${v.baseline_correct}/${v.rows} for the majority baseline.`,
    `it is ${v.correct}/${v.answered} versus ${v.accepted_baseline_correct}/${v.answered}, and completion recall is only ${c.correct}/${c.total}.`
  ]) assert.ok(readme.includes(sentence), sentence);
  assert.equal(v.beats_baseline, v.correct > v.baseline_correct);
  assert.equal(readme.includes('This is **not an overall predictive advantage**'), !v.beats_baseline);
});

test('the landing example row really has no table pressure and an identified facility assumption', () => {
  const row = db.testById['PSI-25:1'];
  assert.equal(pressureBasis(row.n), 'facility_inferred');
  assert.equal(row.fuel_form, 'film');
  assert.ok(row.n.p_inferred_source?.url);
  assert.equal(row.o2_basis, 'ambient');
});

// ---------------------------------------------------------------- confirmed defects

test('DEFECT landing: "quote-checked findings" counts only findings that carry a quote check', { todo: 'web/index.html:27 says 822; two table-derived findings have verified.quote === null' }, () => {
  const findings = raw.findings.findings, checked = findings.filter(f => f.verified?.quote !== null && f.verified?.quote !== undefined && f.verified?.quote !== false);
  const shown = Number(html.match(/<li><b>([\d,]+)<\/b>quote-checked findings<\/li>/)[1].replaceAll(',', ''));
  assert.equal(shown, checked.length, `${findings.length - checked.length} findings without a quote check: ${findings.filter(f => !checked.includes(f)).map(f => f.id).join(', ')}`);
});

test('DEFECT landing: the description cannot promise a NASA row behind every answer while some questions have no row', { todo: 'web/index.html:7 "VESTA traces every answer to its NASA row"' }, () => {
  const cells = status.cells(presetPoint(db, 'lunar-base'), db), rowless = cells.filter(c => c.rows === 0).length;
  assert.ok(rowless > 0, 'the lunar cabin has questions with no source-table row');
  assert.doesNotMatch(html, /every answer to its NASA row/, `${rowless} of ${cells.length} lunar answers have no source-table row to trace to`);
});

test('DEFECT summary: a single nearby row is written in the singular', { todo: 'question-summary.js:28 and :24 — "1 source-table row match…", "In all of them…"' }, t => {
  let found = null;
  for (const o2 of dataO2) { for (const p of dataP) { found = status.cells(custom(o2, p, '0g'), db).find(c => c.hit_ids?.length === 1); if (found) break; } if (found) break; }
  if (!found) return t.skip('no single-row question in this collection');
  const s = questionSummary(found, db);
  assert.doesNotMatch(s.lines[0], /^1 source-table row match /);
  assert.doesNotMatch(s.lines[1], /all of them/i);
});

test('DEFECT summary: a cabin with no oxygen value is not reported as a row that does not state oxygen', { todo: 'question-summary.js:9,38 — reason o2_not_reported is also emitted when the CABIN value is missing (match.js:11)' }, () => {
  const q = { ...presetPoint(db, 'station'), o2: null }, cell = status.cell('pmma', 'prevention', q, db);
  assert.ok(Number.isFinite(db.testById[cell.nearest.id].n.o2), 'the nearest row does state oxygen');
  assert.doesNotMatch(questionSummary(cell, db).lines[1], /Nearest row: oxygen is not reported/);
});

test('DEFECT summary: the pressure-basis sentence accounts for every nearby row it just counted', { todo: 'question-summary.js:26 drops rows with no pressure basis and rows missing from the index' }, () => {
  const fake = { testById: { a: { n: { p: 101 } }, d: { n: { p: null, p_inferred: 101 } }, f: { n: { p: null } } } };
  const s = questionSummary({ status: 'PROVEN', material: 'm', concern: 'c', hit_ids: ['a', 'd', 'f', 'gone'] }, fake);
  const numbers = s.lines[1].match(/\d+/g).map(Number);
  assert.equal(numbers.reduce((a, b) => a + b, 0), 4, s.lines[1]);
});

test('DEFECT audit: text helpers never print "undefined" for a partial audit object', { todo: 'assumption-audit.js:44,52 interpolate missing counts' }, () => {
  assert.doesNotMatch(pressureAuditText({ nearby: 2 }), /undefined/);
  assert.doesNotMatch(pressureDependenceText({ nearby: 2 }), /undefined/);
});

test('DEFECT audit: two different unnamed inference sources are both kept', { todo: 'assumption-audit.js:18 keys the map on id ?? url ?? title, which is undefined for both' }, () => {
  const d = pressureDependence({ hit_ids: ['d', 'e'] }, { testById: {
    d: { n: { p_inferred: 101.3, p_inferred_source: { assumption: 'Cabin air assumed.' } } },
    e: { n: { p_inferred: 70, p_inferred_source: { assumption: 'Reduced pressure assumed.' } } } } });
  assert.equal(d.inference_sources.length, 2);
});
