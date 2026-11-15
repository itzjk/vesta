import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, designPoint, presetPoint } from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import { rank } from '../../web/js/core/rank.js';
import { coverage, headline, question } from '../../web/js/world/coverage.js';

const raw = Object.fromEntries(['tests', 'findings', 'presets', 'investigations'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw);
const lunar = presetPoint(db, 'lunar-base');


test('score explanation uses unrounded core parts and the actual support multiplier', async () => {
  const { scoreExplanation } = await import('../../web/js/world/coverage.js');
  const core = await import('../../web/js/core/rank.js');
  for (const q of [presetPoint(db, 'station'), lunar]) {
    for (const c of status.cells(q, db)) {
      const { findings } = question(c.material, c.concern, q, db);
      for (const entry of findings) {
        const why = scoreExplanation(entry);
        assert.equal(why.sum, Object.values(entry.parts).reduce((a, b) => a + b, 0));
        assert.equal(why.multiplier, entry.f.n.support === 'direct' ? 1 : core.PARTIAL_SUPPORT);
        assert.equal(Math.round(why.sum * why.multiplier), entry.total);
      }
      if (c.status === 'NEVER_TESTED') assert.equal(findings.length, 0);
    }
  }
});

test('loaded findings and an explicit partial-support fixture preserve core rounding', async () => {
  const { scoreExplanation } = await import('../../web/js/world/coverage.js');
  const core = await import('../../web/js/core/rank.js');
  const q = presetPoint(db, 'station'), seen = new Set();
  for (const entry of core.rank(db.findings, q, db)) {
    const why = scoreExplanation(entry);
    seen.add(why.multiplier);
    assert.equal(Math.round(why.sum * why.multiplier), entry.total);
  }
  assert.ok(seen.has(1));
  const source = db.findings[0];
  const fixture = { ...source, n: { ...source.n, support: 'partial' } };
  const entry = { f: fixture, ...core.score(fixture, q, db) };
  const why = scoreExplanation(entry);
  assert.equal(why.multiplier, core.PARTIAL_SUPPORT);
  assert.equal(Math.round(why.sum * why.multiplier), entry.total);
});
