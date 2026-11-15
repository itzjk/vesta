import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { cell, cells } from '../../web/js/core/status.js';
import { rank } from '../../web/js/core/rank.js';
import { guidedAnswer, NO_MATCH, searchEvidence } from '../../web/js/world/ask.js';
const raw = Object.fromEntries(['tests','findings','presets','investigations'].map(name => [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url)))]));
const db = buildIndex(raw);
const base = presetPoint(db, 'lunar-base');
test('every guided coverage answer preserves core status and genuine source identifiers across the matrix', () => {
  const before = JSON.stringify(cells(base, db));
  for (const material of Object.keys(db.materials)) for (const concern of ['prevention','detection','suppression']) {
    const q = {...base, material, concern}, c = cell(material, concern, q, db);
    const answer = guidedAnswer(db, q, 'nearby');
    assert.ok(answer.context.includes(db.materials[material].label));
    assert.ok(answer.result.includes({PROVEN:'NEARBY EVIDENCE',EXTRAPOLATED:'OTHER CONDITIONS',NEVER_TESTED:'NO SOURCE FOUND'}[c.status]));
    assert.ok(answer.sources.every(id => db.testById[id] || db.findingById[id]));
    if (c.status === 'NEVER_TESTED') assert.deepEqual(answer.sources, []);
    assert.ok(guidedAnswer(db, q, 'missing').result.includes('collection'));
  }
  assert.equal(JSON.stringify(cells(base, db)), before);
});
test('no chosen material never borrows FLEX to answer a cabin gap', () => {
  const answer = guidedAnswer(db, {...base, material:null}, 'nearby');
  assert.match(answer.result, /Choose a cabin material/);
  assert.deepEqual(answer.sources, []);
});
test('rank answer agrees with core, includes every component and support rounding', () => {
  for (const preset of db.presets) {
    const q = presetPoint(db, preset.id), first = rank(db.findings, q, db)[0], answer = guidedAnswer(db,q,'rank');
    assert.equal(answer.sources[0], first.f.id);
    assert.ok(answer.result.includes(`${first.total}/100`));
    assert.ok(answer.explanation.some(line => line.includes(`rounded = ${first.total}`)));
    for (const key of Object.keys(first.parts)) assert.ok(answer.explanation.some(line => line.startsWith(`${key.replace(/_/g,' ')}:`)));
  }
});
test('comparison requires two valid different studies and points to their originals', () => {
  for (const args of [{},{leftId:'PSI-69',rightId:'PSI-69'},{leftId:'invented',rightId:'PSI-69'}]) assert.deepEqual(guidedAnswer(db,base,'compare',args).sources,[]);
  const answer = guidedAnswer(db,base,'compare',{leftId:'PSI-69',rightId:'PSI-68'});
  assert.deepEqual(answer.sources,['PSI-69','PSI-68']);
  assert.ok(answer.explanation.some(line => line.includes('not a performance ranking')));
});
test('word miss remains separate from source coverage and single words still work', () => {
  assert.equal(NO_MATCH,'No findings match these search terms in the loaded collection.');
  assert.deepEqual(searchEvidence(db,'zzzzunfindable',base),[]);
  assert.ok(searchEvidence(db,'oxygen',base).length > 0);
  const q={...presetPoint(db,'station'), material:'pmma',concern:'prevention'};
  assert.equal(cell('pmma','prevention',q,db).status,'PROVEN');
  assert.match(guidedAnswer(db,q,'nearby').result,/NEARBY EVIDENCE/);
});
