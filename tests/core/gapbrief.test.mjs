import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { createGapBrief, gapBriefMarkdown, gapBriefJson, parseGapBrief, recheckGapBrief } from '../../web/js/core/gapbrief.js';

const names = ['meta', 'tests', 'findings', 'investigations', 'presets', 'tables'];
const raw = Object.fromEntries(names.map(n => [n, JSON.parse(fs.readFileSync(new URL(`../../web/data/${n}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw);
const q = presetPoint(db, 'station');
const row = (id, material, concerns, o2 = 21, p = 101.4) => ({ id, psi_id: 'FX', table_file: 'fixture.csv', row: Number(id.split(':')[1]), gravity: 'microgravity', fuel: material,
  n: { counts: true, cabin: true, material_id: material, pillars: concerns, o2, p, gclass: 'micro' } });
const finding = (id, material, pillar = 'prevention') => ({ id, pillar, claim: id, gate: { pass: true }, source: { url: 'https://example.org/evidence' },
  n: { material_ids: [material], work: 'flight', support: 'direct', gclass: 'micro', o2: 21, p: 101.4, habitats: [] } });
const fixture = () => buildIndex({ tests: [row('FX:1', 'alpha', ['prevention']), row('FX:2', 'beta', ['prevention'])],
  findings: [finding('F-1', 'beta'), finding('F-2', 'beta')], investigations: [{ psi_id: 'FX', psi_url: 'https://example.org/FX' }] });

test('gap brief generates every question for five cabins and an exact custom cabin', async () => {
  for (const point of [...db.presets.map(p => presetPoint(db, p.id)), { ...q, preset: 'custom', o2: 28.125, p: 73.456, g: 'mars', gclass: 'partial' }]) {
    const b = await createGapBrief(db, point);
    assert.equal(b.schema, 'vesta.gap-brief/1');
    assert.equal(b.questions.length, Object.keys(db.materials).length * 3);
    assert.equal(b.questions.length, Object.values(b.coverage).reduce((a, n) => a + n, 0));
    assert.equal(b.agenda.length, 3);
    assert.equal(b.query.oxygen_percent, point.o2);
    assert.equal(b.query.pressure_kpa, point.p);
    assert.ok(b.disclosure.includes('SI assistance'));
    assert.match(b.scope, /not a safety verdict or a NASA review/);
  }
});

test('priority uses missing evidence before extrapolation, then related findings, rows and stable ids', async () => {
  const f = fixture();
  const b = await createGapBrief(f, q);
  assert.deepEqual(b.agenda.map(x => x.question_id), ['beta/detection', 'beta/suppression', 'alpha/detection']);
  assert.equal(b.agenda[0].related_findings, 2);
  assert.equal(b.agenda[0].related_rows, 1);
  const distant = await createGapBrief(f, { ...q, o2: 50 });
  assert.ok(distant.agenda.every(a => a.status === 'NEVER_TESTED'));
  assert.ok(distant.questions.find(x => x.id === 'beta/prevention').status === 'EXTRAPOLATED');
  const manyRows = buildIndex({ tests: [row('FX:1', 'alpha', ['prevention']), row('FX:2', 'alpha', ['prevention']), row('FX:3', 'beta', ['prevention'])] });
  assert.equal((await createGapBrief(manyRows, q)).agenda[0].question_id, 'alpha/detection');
});

test('canonical JSON and Markdown are byte stable across reruns, field order and collection order', async () => {
  const b = await createGapBrief(db, q);
  const reversed = buildIndex({ ...raw, tests: { tests: [...db.tests].reverse() }, findings: [...db.findings].reverse(), investigations: [...db.investigations].reverse() });
  const again = await createGapBrief(reversed, Object.fromEntries(Object.entries(q).reverse()));
  assert.equal(gapBriefJson(b), gapBriefJson(again));
  assert.equal(gapBriefMarkdown(b), gapBriefMarkdown(again));
  assert.equal(gapBriefJson(b), gapBriefJson(await createGapBrief(db, q)));
  assert.equal(gapBriefJson(b), gapBriefJson(await createGapBrief(db, { ...q, material: 'nomex', concern: 'suppression' })));
  assert.deepEqual(b.questions.map(x => x.status), [...b.questions.map(x => x.status)].sort((a, z) => ['NEVER_TESTED', 'EXTRAPOLATED', 'PROVEN'].indexOf(a) - ['NEVER_TESTED', 'EXTRAPOLATED', 'PROVEN'].indexOf(z)));
});

test('exact differences retain source precision and inferred pressure, without invented gravity magnitude', async () => {
  const f = buildIndex({ tests: [{ ...row('FX:1', 'alpha', ['prevention'], 20.712837, null), n: { ...row('FX:1', 'alpha', ['prevention'], 20.712837, null).n, p_inferred: 101.3 } }] });
  const b = await createGapBrief(f, { ...q, o2: 34, p: 56.5, g: 'moon', gclass: 'partial' });
  const c = b.questions.find(x => x.id === 'alpha/prevention');
  assert.equal(c.comparison.oxygen.delta_percentage_points, 13.287163);
  assert.equal(c.comparison.pressure.delta_kpa, -44.8);
  assert.equal(c.comparison.pressure.basis, 'inferred');
  assert.equal(c.comparison.gravity.source_class, 'micro');
  assert.equal(c.comparison.gravity.cabin, 'moon');
  assert.equal(c.comparison.gravity.delta_g, null);
  assert.match(gapBriefMarkdown(b), /13.287163/);
});

test('gaps cite collection scope and related context without pretending it answers the question', async () => {
  const b = await createGapBrief(fixture(), q);
  const c = b.questions.find(x => x.id === 'beta/detection');
  assert.equal(c.status, 'NEVER_TESTED');
  assert.deepEqual(c.finding_ids, []);
  assert.equal(c.nearest_row_id, null);
  assert.equal(c.comparison, null);
  assert.equal(c.coverage_source, 'design-coverage');
  assert.ok(c.sources.length);
  assert.ok(c.sources.every(s => s.role === 'related_only'));
  assert.ok(c.sources.some(s => s.table_file === 'fixture.csv' && s.row === 2 && s.investigation_id === 'FX'));
});

test('finding-only evidence, source-table finding links, ranges and missing measurements stay explicit', async () => {
  const f = fixture();
  f.findings.push({ ...finding('F-3', 'alpha', 'suppression'), row_ids: ['FX:1'], n: { ...finding('F-3', 'alpha').n, o2: [20, 23], p: null } });
  f.findingById['F-3'] = f.findings.at(-1);
  const b = await createGapBrief(f, q);
  const c = b.questions.find(x => x.id === 'alpha/suppression');
  assert.equal(c.status, 'EXTRAPOLATED');
  assert.equal(c.nearest_row_id, null);
  assert.equal(c.comparison.origin, 'finding');
  assert.deepEqual(c.comparison.oxygen.source, [20, 23]);
  assert.equal(c.comparison.oxygen.delta_percentage_points, 0);
  assert.equal(c.comparison.pressure.delta_kpa, null);
  assert.ok(c.sources.some(s => s.finding_id === 'F-3' && s.row_id === 'FX:1'));
  const unknown = await createGapBrief(f, { ...q, o2: null, p: null, g: null, gclass: null });
  assert.equal(unknown.coverage.PROVEN, 0);
  assert.equal(unknown.query.oxygen_percent, null);
  assert.ok(!gapBriefJson(unknown).includes('NaN'));
});

test('JSON downloads parse and recheck, modified versions, results and oversized files do not match', async () => {
  const b = await createGapBrief(fixture(), q);
  assert.deepEqual(parseGapBrief(gapBriefJson(b)), b);
  assert.equal((await recheckGapBrief(gapBriefJson(b), fixture())).status, 'MATCH');
  const changed = structuredClone(b);
  changed.agenda.reverse();
  assert.equal((await recheckGapBrief(changed, fixture())).status, 'CHANGED');
  for (const input of ['{bad', null, { ...b, schema: 'vesta.gap-brief/99' }, 'x'.repeat(2 * 1024 * 1024 + 1)]) {
    assert.equal((await recheckGapBrief(input, fixture())).status, 'INVALID');
  }
});

test('empty collection has no invented questions or agenda and strict queries reject invalid measures', async () => {
  const b = await createGapBrief(buildIndex(), q);
  assert.deepEqual(b.questions, []);
  assert.deepEqual(b.agenda, []);
  for (const change of [{ o2: NaN }, { p: 0 }, { o2: '21' }, { g: 'moon', gclass: 'micro' }]) {
    await assert.rejects(createGapBrief(db, { ...q, ...change }));
  }
});
