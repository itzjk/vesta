// The FLEX replay draws the same rows as the oxygen-band table: every total is recounted here
// from web/data/tests.json and compared with describe(), independently of the replay module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { OXYGEN_LIMIT, describe, limitRows, bandOf, diluentOf } from '../../web/js/core/oxygen-limit.js';
import { flexReplay, replayState, hasEnded, markText, counterText, replaySummary, ENDINGS, REPLAY_SCOPE } from '../../web/js/core/flex-replay.js';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const tests = JSON.parse(read('../../web/data/tests.json')).tests;
const table = describe(tests), pooled = table.lines.find(line => line.diluent === 'all' && line.fuel === 'All fuels');
const replay = flexReplay(tests), counted = limitRows(tests).rows, byId = new Map(counted.map(row => [row.id, row]));

test('one mark per counted table row, in the table bands, with the recorded fields', () => {
  assert.deepEqual(replay.bands.map(band => band.id), OXYGEN_LIMIT.bands.map(band => band.id));
  const marks = replay.bands.flatMap(band => band.marks);
  assert.equal(marks.length, table.rows); assert.equal(replay.rows, table.rows); assert.ok(marks.length > 0);
  assert.equal(new Set(marks.map(mark => mark.id)).size, marks.length, 'no row is drawn twice');
  for (const mark of marks) {
    const row = byId.get(mark.id); assert.ok(row, mark.id);
    assert.equal(mark.fuel, row.fuel); assert.equal(mark.oxygen, row.n.o2); assert.equal(mark.band, bandOf(row.n.o2));
    assert.equal(mark.recorded, row.outcomes.test_end.value); assert.equal(mark.end, row.outcomes.test_end.value, 'every recorded ending has its own mark');
    assert.equal(mark.diluent, diluentOf(row));
    const burn = row.outcomes?.burn_time_s?.value;
    assert.equal(mark.burn_time_s, Number.isFinite(burn) ? burn : null);
  }
  assert.deepEqual([...new Set(marks.map(mark => mark.end))].sort(), ENDINGS.map(item => item.id).sort(), 'extinction, disruption and completion all occur');
  assert.equal(new Set(ENDINGS.map(item => item.shape)).size, ENDINGS.length, 'each ending has its own shape');
});

test('band totals equal the pooled row of the table, recounted from the raw rows', () => {
  replay.bands.forEach((band, i) => {
    const cell = pooled.cells[i], own = counted.filter(row => bandOf(row.n.o2) === band.id);
    assert.equal(cell.band, band.id);
    assert.equal(band.tests, cell.tests); assert.equal(band.extinction, cell.extinction);
    assert.equal(band.tests, own.length); assert.equal(band.extinction, own.filter(row => row.outcomes.test_end.value === 'extinction').length);
    assert.equal(Object.values(band.counts).reduce((sum, n) => sum + n, 0), band.tests);
  });
});

test('nothing has ended at t = 0 and every band equals the table at t = 1', () => {
  const start = replayState(replay, 0), end = replayState(replay, 1);
  for (const band of start.bands) { assert.equal(band.ended, 0); assert.equal(band.extinction, 0); }
  end.bands.forEach((band, i) => {
    assert.equal(band.ended, pooled.cells[i].tests); assert.equal(band.extinction, pooled.cells[i].extinction);
    assert.equal(counterText(band.extinction, band.tests), `went out on their own: ${pooled.cells[i].extinction} of ${pooled.cells[i].tests}`);
  });
  for (const odd of [-1, NaN, undefined]) assert.equal(replayState(replay, odd).bands.reduce((sum, band) => sum + band.ended, 0), 0);
  assert.deepEqual(replayState(replay, 7).bands.map(band => band.ended), end.bands.map(band => band.ended));
});

test('marks settle in order of recorded burn time; tests with no burn time settle only at t = 1', () => {
  let untimed = 0;
  for (const band of replay.bands) {
    const timed = band.marks.filter(mark => mark.burn_time_s !== null).sort((a, b) => a.end_at - b.end_at);
    for (let i = 1; i < timed.length; i++) { assert.ok(timed[i - 1].burn_time_s <= timed[i].burn_time_s); assert.ok(timed[i - 1].end_at < timed[i].end_at); }
    for (const mark of band.marks) {
      assert.ok(mark.end_at > 0 && mark.end_at <= 1);
      if (mark.burn_time_s === null) { untimed++; assert.equal(mark.end_at, 1); assert.equal(hasEnded(mark, 0.999999), false); assert.equal(hasEnded(mark, 1), true); }
      else assert.ok(mark.end_at < 1);
    }
    let before = -1;
    for (let step = 0; step <= 40; step++) { const now = replayState(replay, step / 40).bands.find(item => item.id === band.id); assert.ok(now.ended >= before && now.extinction <= now.ended); before = now.ended; }
  }
  assert.equal(untimed, counted.filter(row => !Number.isFinite(row.outcomes?.burn_time_s?.value)).length);
  const display = replay.bands.map(band => band.marks.map(mark => mark.id));
  assert.deepEqual(flexReplay([...tests].reverse()).bands.map(band => band.marks.map(mark => mark.id)), display, 'the order does not depend on input order');
});

test('texts are computed, in scope, and the panel is mounted without typed-in results', () => {
  const mark = replay.bands[0].marks[0], line = markText(mark);
  for (const part of [mark.id, mark.fuel, `${mark.oxygen}% oxygen`, `recorded ending: ${mark.recorded}`]) assert.ok(line.includes(part), part);
  const summary = replaySummary(replay);
  replay.bands.forEach((band, i) => assert.ok(summary.includes(`${band.label}: ${pooled.cells[i].extinction} of ${pooled.cells[i].tests} went out on their own`)));
  assert.equal(REPLAY_SCOPE, 'Each mark is one recorded FLEX test (liquid droplets in microgravity). Marks are drawn, not footage. Not cabin materials.');
  assert.equal(replaySummary(flexReplay([])), 'No FLEX droplet tests with a recorded end state are loaded.');
  const core = read('../../web/js/core/flex-replay.js'), panel = read('../../web/js/world/flex-replay-panel.js'), css = read('../../web/css/flex-replay.css'), host = read('../../web/js/world/outcome-panel.js');
  const figures = new Set([table.rows, ...pooled.cells.flatMap(cell => [cell.extinction, cell.tests]), ...replay.bands.flatMap(band => Object.values(band.counts))].filter(n => n > 30));
  for (const n of figures) for (const [name, source] of [['core', core], ['panel', panel]])
    assert.ok(!new RegExp(`(?<![\\d.#])${n}(?![\\d.])`).test(source), `result ${n} is typed into the ${name}`);
  for (const source of [core, panel, css]) { assert.doesNotMatch(source, /\b(safe|proven|validated|certified)\b/i); assert.doesNotMatch(source, /https?:\/\/|url\(|@import/); }
  const key = panel.match(/flex-replay\.js\?v=([\w-]+)/)[1];
  assert.ok(panel.includes(`flex-replay.css?v=${key}`)); assert.ok(host.includes(`import { createFlexReplay } from './flex-replay-panel.js?v=${key}';`));
  assert.equal(host.split('createFlexReplay').length - 1, 2, 'one import and one mount line');
  assert.ok(host.indexOf('oxygen.append(createFlexReplay(db.tests));') < host.indexOf('drawBands(view.chart)') && host.indexOf('oxygen.append(createFlexReplay(db.tests));') > 0, 'the replay sits above the chart and the table');
  assert.match(panel, /prefers-reduced-motion: reduce/); assert.match(css, /prefers-reduced-motion:reduce/);
  assert.equal((panel.match(/make\('button'/g) || []).length, 1, 'one focusable control'); assert.doesNotMatch(panel, /tabindex|tabIndex/);
  for (const ending of ENDINGS) assert.ok(css.includes(`.fr-mark.is-ended.fr-${ending.id}::before`), ending.id);
});
