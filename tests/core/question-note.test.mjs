import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import { cell } from '../../web/js/core/status.js';
import { createQuestionNote, questionNoteMarkdown, questionNoteMatches } from '../../web/js/core/question-note.js';
import { reviewQuestion } from '../../web/js/world/welcome.js';
const names = ['meta', 'tests', 'findings', 'investigations', 'presets', 'tables'];
const db = buildIndex(Object.fromEntries(names.map(name => [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))])));
const point = (preset, material = 'pmma', concern = 'prevention') => presetPoint(db, preset, concern, material);

test('Station PMMA note retains 16 nearby rows and their inferred pressure basis', () => {
  const q = point('station'), note = createQuestionNote(db, q), text = questionNoteMarkdown(note, q);
  assert.equal(note.status, 'PROVEN'); assert.equal(note.nearby_row_ids.length, 16);
  assert.equal(note.pressure_basis.inferred, 16); assert.equal(note.pressure_basis.reported, 0);
  assert.equal(note.nearest_id, 'PSI-25:10');
  assert.equal(note.sources[0].url, 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-25');
  assert.match(text, /16 facility-inferred/); assert.match(text, /not a pressure measurement/);
  assert.match(text, /not a safety assessment or a verified replay receipt/);
});
test('lunar PMMA note preserves differing conditions and no nearby rows', () => {
  const note = createQuestionNote(db, point('lunar-base'));
  assert.equal(note.status, 'EXTRAPOLATED'); assert.equal(note.nearby_row_ids.length, 0);
  assert.equal(note.nearest_id, 'PSI-25:1');
  assert.equal(note.comparison.compared.find(x => x.key === 'oxygen').delta, 11.8);
  assert.equal(note.comparison.compared.find(x => x.key === 'pressure').delta, -44.8);
  assert.equal(note.comparison.compared.find(x => x.key === 'pressure').inferred, true);
  assert.equal(note.comparison.compared.find(x => x.key === 'gravity').state, 'different');
});
test('Kapton prevention has no direct source; other concerns are never substituted', () => {
  const note = createQuestionNote(db, point('lunar-base', 'kapton'));
  assert.equal(note.status, 'NEVER_TESTED'); assert.equal(note.source_rows, 0);
  assert.deepEqual(note.finding_ids, []); assert.deepEqual(note.sources, []); assert.equal(note.nearest_id, null);
  assert.match(questionNoteMarkdown(note), /No direct source is indexed for this material-and-concern/);
  assert.match(note.next_review, /another concern does not fill/);
});
test('a note cannot be exported against another question, pressure, gravity or habitat', () => {
  const q = point('station'), note = createQuestionNote(db, q);
  for (const patch of [{material:'kapton'}, {concern:'detection'}, {o2:34}, {p:56.5}, {g:'moon',gclass:'partial'}, {habitat:'lunar-base'}]) {
    const changed = {...q,...patch}; assert.equal(questionNoteMatches(note, changed), false);
    assert.throws(() => questionNoteMarkdown(note, changed), /changed/);
  }
  assert.equal(questionNoteMatches(note, {...q}), true);
});
test('invalid selection and inconsistent or missing cabin values are refused', () => {
  const q = point('station');
  for (const patch of [{material:'absent'}, {concern:'unknown'}, {o2:null}, {p:NaN}, {g:'unknown'}, {g:'moon',gclass:'micro'}]) assert.throws(() => createQuestionNote(db,{...q,...patch}));
});
test('finding-only evidence remains distinct from a source-row comparison', () => {
  const note = createQuestionNote(db, point('lunar-base','pmma','detection'));
  assert.equal(note.status,'EXTRAPOLATED'); assert.equal(note.source_rows,0); assert.equal(note.nearest_id,null);
  assert.ok(note.finding_ids.length); assert.ok(note.sources.every(s=>s.kind==='finding'));
  assert.match(questionNoteMarkdown(note), /Findings, if listed, remain findings rather than matched experiments/);
});
test('notes copy their inputs and source records without changing the core result', () => {
  const q=point('station'), before=JSON.stringify(db), original=JSON.stringify(q), result=cell(q.material,q.concern,q,db);
  const note=createQuestionNote(db,q); note.query.p=5; note.sources[0].url='https://example.org/';
  assert.equal(JSON.stringify(db),before); assert.equal(JSON.stringify(q),original);
  assert.deepEqual(cell(q.material,q.concern,q,db),result);
});
test('entry preserves a valid selected question and otherwise explicitly offers PMMA prevention', () => {
  assert.deepEqual(reviewQuestion(point('station','kapton','detection'),db),{material:'kapton',concern:'detection'});
  assert.deepEqual(reviewQuestion({...point('station'),material:null},db),{material:'pmma',concern:'prevention'});
  assert.deepEqual(reviewQuestion({...point('station'),concern:'invalid'},db),{material:'pmma',concern:'prevention'});
  assert.equal(reviewQuestion({}, {materials:{}}),null);
});
