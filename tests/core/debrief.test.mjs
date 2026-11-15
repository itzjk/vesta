import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, withoutFindings } from '../../web/js/core/index.js';
import * as officer from '../../web/js/core/officer.js';
import * as clock from '../../web/js/core/clock.js';
import * as text from '../../web/js/core/text.js';
import { createDrillModel, basisKey, evidenceIds } from '../../web/js/world/drill-thread.js';
import { summarize } from '../../web/js/world/debrief.js';

const names = ['tests', 'findings', 'rules', 'protocol', 'playbook', 'scenario', 'presets', 'investigations', 'tables'];
const raw = Object.fromEntries(names.map(name => [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url)))]));
const db = buildIndex(raw), core = { officer, clock, text }, model = createDrillModel({ db, core });

test('debrief counts supporting bases once per decision; fallback procedures do not erase gaps', () => {
  const summary = summarize(model, { t: model.end });
  assert.deepEqual(summary.counts, { experiment: 2, summary: 3, operations: 1, no_source: 2 });
  assert.equal(Object.values(summary.counts).reduce((a, b) => a + b), summary.total);
  for (const entry of model.log.filter(entry => entry.protocol)) {
    assert.equal(basisKey(entry), 'no_source');
    assert.ok(db.findingById[entry.protocol.finding_id]);
    assert.match(entry.protocol.limit, /not validated for this vehicle/);
    assert.deepEqual(evidenceIds(entry, db), []);
  }
  const partial = summarize(model, { t: model.log[0].t });
  assert.equal(Object.values(partial.counts).reduce((a, b) => a + b), 1);
  assert.equal(partial.complete, false);
});

