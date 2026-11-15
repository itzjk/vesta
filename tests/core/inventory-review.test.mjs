import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { cell } from '../../web/js/core/status.js';
import { matchPanel } from '../../web/js/core/matchpanel.js';
import { createInventoryReviewSession, reviewToMarkdown, reviewToCsv } from '../../web/js/core/inventory-review.js';

const raw = Object.fromEntries(['meta', 'tests', 'findings', 'investigations', 'presets'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw), station = presetPoint(db, 'station');
const yieldTurn = () => Promise.resolve();
const run = (overrides = {}) => createInventoryReviewSession({ db, query: station, materials: ['pmma', 'kapton', 'silicone'], yieldTurn, ...overrides }).run();

test('real selected inventory produces nine questions, exact core results and traceable source comparisons', async () => {
  const report = await run();
  assert.equal(report.status, 'complete');
  assert.equal(report.questions.length, 9);
  assert.equal(report.counts.questions, 9);
  assert.notEqual(report.questions.length, Object.keys(db.materials).length * 3);
  assert.deepEqual([...new Set(report.questions.map(q => q.material_id))], ['kapton', 'pmma', 'silicone']);
  assert.equal(report.progress.completed, report.progress.total);
  assert.equal(report.trace.length, 38); // plan + nine actual four-step tasks + complete
  assert.equal(report.trace[0].type, 'plan');
  assert.equal(report.trace.at(-1).type, 'complete');
  assert.match(report.collection.digest, /^[a-f0-9]{64}$/);
  assert.equal(report.collection.source_table_rows, db.tests.length);
  for (const q of report.questions) {
    const expected = cell(q.material_id, q.concern, station, db);
    assert.equal(q.cell.status, expected.status);
    assert.deepEqual(q.cell.hit_ids || [], [...(expected.hit_ids || [])].sort());
    assert.deepEqual(q.cell.finding_ids, [...expected.finding_ids].sort());
    assert.equal(q.cell.rows, expected.rows);
    assert.ok(q.sources.rows.length <= 3 && q.sources.findings.length <= 3);
    for (const source of q.sources.rows) {
      assert.ok(db.testById[source.id]);
      assert.equal(db.testById[source.id].n.material_id, q.material_id);
      assert.ok(db.testById[source.id].n.pillars.includes(q.concern));
    }
    for (const source of q.sources.findings) {
      const f = db.findingById[source.id];
      assert.ok(f.n.material_ids.includes(q.material_id));
      assert.equal(f.pillar, q.concern);
    }
    for (const c of q.comparisons) {
      const original = c.kind === 'row' ? db.testById[c.id] : db.findingById[c.id];
      assert.deepEqual(c.panel, matchPanel(original, station, db));
    }
    assert.deepEqual(q.request.evidence_row_ids, q.sources.rows.map(s => s.id));
  }
  const pmma = report.questions.find(q => q.id === 'pmma/prevention');
  assert.equal(pmma.status, 'PROVEN');
  assert.ok(pmma.sources.rows.some(r => r.pressure_basis === 'facility_inferred'));
});

test('deterministic inputs, source selection, output and priority survive input/collection ordering', async () => {
  const a = await run();
  const reversed = buildIndex({ ...raw, tests: [...db.tests].reverse(), findings: [...db.findings].reverse(), investigations: [...db.investigations].reverse() });
  const b = await run({ db: reversed, materials: ['silicone', 'pmma', 'kapton', 'pmma'] });
  assert.deepEqual(a, b);
  assert.equal(reviewToMarkdown(a), reviewToMarkdown(b));
  assert.equal(reviewToCsv(a), reviewToCsv(b));
  const firstNearby = a.priority.findIndex(p => p.status === 'PROVEN');
  if (firstNearby !== -1) assert.ok(a.priority.slice(firstNearby).every(p => p.status === 'PROVEN'));
  assert.match(a.method.priority_rule, /not a physical-risk/);
});

test('changing only gravity changes real coverage without fabricating an experiment or clearing a cabin', async () => {
  const near = await run({ materials: ['pmma'] });
  const lunar = await run({ materials: ['pmma'], query: { ...station, g: 'moon', gclass: 'partial' } });
  assert.equal(near.questions[0].status, 'PROVEN');
  assert.equal(lunar.questions[0].status, 'EXTRAPOLATED');
  assert.ok(lunar.questions[0].cell.reasons.includes('gravity_never_tested'));
  assert.equal(lunar.input.query.o2, near.input.query.o2);
  assert.equal(lunar.input.query.p, near.input.query.p);
  assert.ok(lunar.questions[0].request.condition_differences.some(d => d.key === 'gravity'));
  assert.equal(lunar.collection.digest, near.collection.digest);
  assert.match(lunar.scope, /No model at runtime, hardware control, safety clearance/);
  for (const q of near.questions) {
    assert.deepEqual(q.request.variables_to_specify.map(v => v.key), ['airflow', 'geometry', 'thickness', 'ignition', 'suppressant']);
    assert.match(q.request.scope, /not an experimental protocol/);
  }
});

test('empty/invalid inventory is rejected and unknown IDs remain an identity issue, not NASA absence', async () => {
  for (const materials of [undefined, [], [''], ['PMMA'], ['x/y'], Array(25).fill('pmma')])
    assert.throws(() => createInventoryReviewSession({ db, query: station, materials }), /material|inventory/i);
  const report = await run({ materials: ['pmma', 'unlisted-alloy'] });
  assert.equal(report.questions.length, 6);
  assert.equal(report.counts.NOT_INDEXED, 3);
  for (const q of report.questions.filter(q => q.material_id === 'unlisted-alloy')) {
    assert.equal(q.status, 'NOT_INDEXED');
    assert.equal(q.inventory_state, 'not_indexed_cabin_material');
    assert.equal(q.cell.status, 'NEVER_TESTED'); // exact raw core result remains auditable
    assert.match(q.request.reason, /not evidence that NASA has never tested/);
    assert.equal(q.sources.rows.length + q.sources.findings.length, 0);
  }
  assert.equal(report.priority[0].status, 'NOT_INDEXED');
});

test('missing cabin conditions remain null and invalid conditions are rejected before execution', async () => {
  const report = await run({ query: { ...station, o2: null, p: null, g: null, gclass: null }, materials: ['pmma'] });
  assert.equal(report.counts.PROVEN, 0);
  assert.equal(report.input.query.o2, null);
  assert.equal(report.input.query.p, null);
  assert.deepEqual(report.questions[0].request.missing_cabin_fields, ['oxygen', 'pressure', 'gravity']);
  assert.ok(report.questions[0].comparisons.every(c => c.panel.compared.some(p => p.detail.includes('comparison unavailable'))));
  for (const patch of [{ o2: NaN }, { o2: '21' }, { p: 0 }, { g: 'moon', gclass: 'micro' }])
    assert.throws(() => createInventoryReviewSession({ db, query: { ...station, ...patch }, materials: ['pmma'] }));
});

test('cancellation inside a completed task stops further work and cannot yield a successful export', async () => {
  const events = [];
  let session;
  session = createInventoryReviewSession({ db, query: station, materials: ['pmma', 'kapton'], yieldTurn,
    onEvent(event) { events.push(event); if (event.type === 'inspect_sources') session.cancel('Cabin input changed'); } });
  const job = session.run();
  assert.equal(session.run(), job);
  const result = await job;
  assert.equal(result.status, 'cancelled');
  assert.equal(events.at(-1).type, 'cancel');
  assert.equal(events.filter(e => e.type === 'inspect_sources').length, 1);
  assert.ok(!events.some(e => ['complete', 'compare_conditions'].includes(e.type)));
  assert.throws(() => reviewToMarkdown(result), /Only a completed/);
  assert.throws(() => reviewToCsv(result), /Only a completed/);
  assert.deepEqual(await session.run(), result);
  assert.deepEqual(session.cancel(), result);
});

test('cancel before start and while yielding never resumes stale work or reports complete', async () => {
  const before = createInventoryReviewSession({ db, query: station, materials: ['pmma'], yieldTurn });
  before.cancel();
  assert.equal((await before.run()).status, 'cancelled');
  let resume, waiting;
  const barrier = new Promise(resolve => { waiting = resolve; });
  const s = createInventoryReviewSession({ db, query: station, materials: ['pmma'],
    yieldTurn: () => new Promise(resolve => { resume = resolve; waiting(); }) });
  const job = s.run();
  await barrier;
  assert.equal(s.snapshot().trace[0].type, 'plan');
  s.cancel('Reset'); resume();
  const result = await job;
  assert.equal(result.status, 'cancelled');
  assert.equal(result.questions.length, 0);
  assert.equal(result.trace.at(-1).type, 'cancel');
});

test('inputs, collection and snapshots cannot drift while the asynchronous session runs', async () => {
  const mutable = buildIndex(structuredClone(raw)), query = { ...station }, materials = ['pmma'];
  const session = createInventoryReviewSession({ db: mutable, query, materials, yieldTurn });
  query.o2 = 99; materials.push('kapton');
  mutable.tests[0].n.o2 = 99;
  const snapshot = session.snapshot();
  assert.ok(Object.isFrozen(snapshot.input.query));
  assert.throws(() => { snapshot.input.query.o2 = 90; }, TypeError);
  const report = await session.run();
  const control = await run({ materials: ['pmma'] });
  assert.deepEqual(report, control);
  assert.equal(snapshot.status, 'idle');
  assert.deepEqual(snapshot.questions, []);
});

test('a failed yielded tool boundary is an error, preserves actual completed work and blocks exports', async () => {
  const report = await run({ materials: ['pmma'], yieldTurn: () => Promise.reject(new Error('host stopped')) });
  assert.equal(report.status, 'error');
  assert.equal(report.error, 'host stopped');
  assert.equal(report.trace.at(-1).type, 'error');
  assert.ok(!report.trace.some(e => e.type === 'complete'));
  assert.throws(() => reviewToMarkdown(report), /Only a completed/);
});

test('exports retain source IDs, units, scope and safe CSV quoting/formula handling', async () => {
  const report = await run({ materials: ['pmma'] });
  const text = reviewToMarkdown(report), csv = reviewToCsv(report);
  assert.match(text, /percentage point/);
  assert.match(text, /Rows are not independent burns/);
  assert.ok(text.includes(report.questions[0].sources.rows[0].id));
  assert.ok(csv.includes(report.collection.digest));
  assert.equal(csv.trimEnd().split('\r\n').length, 4);
  const special = structuredClone(report);
  special.questions[0].material = '=HYPERLINK("bad"),\nname';
  const encoded = reviewToCsv(special);
  assert.ok(encoded.includes('"\'=HYPERLINK(""bad""), name"'));
  assert.match(text, /user input, not measured telemetry/);
  assert.match(text, /No physical test or hardware action was executed/);
});
