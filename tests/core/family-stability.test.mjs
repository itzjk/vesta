import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint, withoutFindings, CONCERNS } from '../../web/js/core/index.js';
import { cell, cells, axes, findingStatus } from '../../web/js/core/status.js';
import { score, rank, rankInvestigations } from '../../web/js/core/rank.js';
import { run } from '../../web/js/core/officer.js';

const read = file => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
const names = ['investigations', 'tests', 'tables', 'findings', 'rules', 'presets', 'protocol', 'playbook', 'scenario'];
const raw = Object.fromEntries(names.map(n => [n, read(`../../web/data/${n}.json`)]));
const db = buildIndex(raw);
const families = ['acme', 'droplets', 'others'];
const familyIds = Object.fromEntries(families.map(f => [f, read(`../../research/evidence/${f}.verified.json`).findings.map(x => x.id)]));
const old = withoutFindings(db, Object.values(familyIds).flat());

for (const family of families) {
  const added = db.findings.filter(f => familyIds[family].includes(f.id));
  const next = buildIndex({ ...raw, findings: [...old.findings, ...added] });

  test(`${family}: the reviewed delivery is exercised and cannot change row-based evidence`, () => {
    assert.ok(added.length > 0, `${family} has no shipped findings to exercise`);
    assert.deepEqual(next.materials, old.materials);
    assert.deepEqual(next.base, old.base);
    for (const preset of db.presets) {
      const q = presetPoint(db, preset.id);
      assert.deepEqual(axes(q, next), axes(q, old));
      for (const prior of cells(q, old)) {
        const now = cell(prior.material, prior.concern, q, next);
        const { finding_ids: previousIds, ...before } = prior;
        const { finding_ids: currentIds, ...after } = now;
        if (prior.rows || previousIds.length || !currentIds.length) assert.deepEqual(after, before);
        else {
          assert.equal(prior.status, 'NEVER_TESTED');
          assert.equal(now.status, 'EXTRAPOLATED');
          assert.deepEqual(now.reasons, ['finding_without_rows']);
          assert.ok(added.some(f => f.pillar === prior.concern && f.n.material_ids.includes(prior.material)));
        }
      }
    }
  });

  test(`${family}: existing scores, applicability, tie order and drill decisions remain stable`, () => {
    for (const preset of db.presets) for (const concern of CONCERNS) {
      const q = presetPoint(db, preset.id, concern, 'pmma');
      for (const f of old.findings) {
        assert.deepEqual(score(f, q, next), score(f, q, old), f.id);
        assert.deepEqual(findingStatus(f, q, next), findingStatus(f, q, old), f.id);
      }
      const before = rank(old.findings, q, old).map(r => r.f.id);
      const retained = new Set(before);
      assert.deepEqual(rank(next.findings, q, next).filter(r => retained.has(r.f.id)).map(r => r.f.id), before);
      const touched = new Set(added.map(f => f.n.psi_id).filter(Boolean));
      const unchanged = rankInvestigations(old, q).filter(r => !touched.has(r.psi_id));
      const nextById = Object.fromEntries(rankInvestigations(next, q).map(r => [r.psi_id, r]));
      for (const r of unchanged) assert.deepEqual(nextById[r.psi_id], r);
    }
    assert.deepEqual(run(db.scenario.frames, next, db.scenario.meta), run(db.scenario.frames, old, db.scenario.meta));
  });
}

test('all three families together preserve the same protections', () => {
  for (const preset of db.presets) {
    const q = presetPoint(db, preset.id);
    assert.deepEqual(axes(q, db), axes(q, old));
    assert.deepEqual(cells(q, db).map(c => c.status), cells(q, old).map(c => c.status));
  }
  assert.deepEqual(run(db.scenario.frames, db, db.scenario.meta), run(db.scenario.frames, old, db.scenario.meta));
});
