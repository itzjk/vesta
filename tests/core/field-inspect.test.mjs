import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex } from '../../web/js/core/index.js';
import { fieldRows } from '../../web/js/scene/field.js';
import { plottedSummary, markGroups } from '../../web/js/core/field-inspect.js';

const raw = Object.fromEntries(['tests', 'findings', 'presets', 'investigations'].map(name => [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url)))]));
const db = buildIndex(raw);

test('plot summary partitions loaded rows and pressure without treating missing as zero', () => {
  const rows = fieldRows(db), summary = plottedSummary(db, rows);
  assert.equal(summary.loaded, db.tests.length);
  assert.equal(summary.plotted, rows.length);
  assert.equal(summary.excluded + summary.plotted, summary.loaded);
  assert.equal(summary.reported + summary.inferred + summary.missing, rows.length);
  assert.equal(Object.values(summary.gravity).reduce((a, b) => a + b, 0), rows.length);
  assert.equal(summary.gravity['0g'], rows.length);
  assert.deepEqual(plottedSummary({ tests: [] }, []), { loaded: 0, plotted: 0, excluded: 0, reported: 0, inferred: 0, missing: 0, gravity: {} });
});

test('every coincident row is reachable once, across layers and reported/inferred styles', () => {
  const rows = fieldRows(db), groups = markGroups(rows);
  assert.equal(groups.flatMap(g => g.rows).length, rows.length);
  assert.equal(new Set(groups.flatMap(g => g.rows.map(p => p.row.id))).size, rows.length);
  for (const g of groups) for (const p of g.rows) assert.equal(p.o2, g.rows[0].o2);
  const fixture = [
    { p: 100, o2: 21, plane: '0g', layer: 'gas', row: { id: 'a' } },
    { p: 100, o2: 21, plane: '0g', layer: 'solid', row: { id: 'b' } },
    { p: null, o2: 21, plane: '0g', row: { id: 'c' } },
    { p: 0, o2: 21, plane: '0g', row: { id: 'd' } },
    { p: 100, o2: 21, plane: 'moon', row: { id: 'e' } }
  ];
  assert.deepEqual(markGroups(fixture).map(g => g.rows.map(p => p.row.id)), [['a', 'b'], ['c', 'd'], ['e']]);
  assert.deepEqual(markGroups([]), []);
});
