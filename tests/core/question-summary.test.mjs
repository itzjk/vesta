import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint } from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import { questionSummary } from '../../web/js/core/question-summary.js';

const raw = Object.fromEntries(['tests', 'findings', 'presets', 'investigations'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw);
const text = s => [s.title, s.answer, ...s.lines, s.next].join(' ');

test('every question of every preset gets a short summary that keeps its status and makes no safety claim', () => {
  for (const preset of db.presets) for (const cell of status.cells(presetPoint(db, preset.id), db)) {
    const s = questionSummary(cell, db, { cabin: preset.label });
    assert.equal(s.status, cell.status);
    assert.ok(s.lines.length >= 2 && s.lines.length <= 3 && s.answer && s.next);
    assert.ok(text(s).length <= 520, `${preset.id} ${cell.material} ${cell.concern}: ${text(s).length}`);
    assert.doesNotMatch(text(s), /\bsafe\b|proven|validated|certif|undefined|NaN|_/i);
  }
});

test('station PMMA prevention states the count and the assumed pressure', () => {
  const s = questionSummary(status.cell('pmma', 'prevention', presetPoint(db, 'station'), db), db, { material: 'PMMA', concern: 'Prevention', cabin: 'Space station' });
  assert.equal(s.answer, 'Nearby evidence for Space station.');
  assert.match(s.lines[0], /^16 source-table rows match/);
  assert.match(s.lines[1], /pressure is assumed from the facility, not reported in the row/);
  assert.match(s.next, /assumed pressure/);
});

test('lunar questions distinguish no nearby row from no source, with the reason from the cell', () => {
  const lunar = presetPoint(db, 'lunar-base');
  const pmma = questionSummary(status.cell('pmma', 'prevention', lunar, db), db);
  assert.match(pmma.answer, /^No nearby source row for/);
  assert.match(pmma.lines[1], /no row at this gravity class/);
  const kapton = questionSummary(status.cell('kapton', 'prevention', lunar, db), db);
  assert.equal(kapton.answer, 'No source in this collection.');
  assert.match(kapton.lines[1], /does not mean NASA never studied/);
});

test('finding-only evidence never invents a nearest source row or known different conditions', () => {
  const cell=status.cells(presetPoint(db,'lunar-base'),db).find(c=>c.status==='EXTRAPOLATED'&&c.rows===0&&c.finding_ids.length>0);
  assert.ok(cell,'The real collection contains a finding-only question');
  const before=JSON.stringify(cell),summary=questionSummary(cell,db);
  assert.equal(summary.status,cell.status);assert.match(summary.lines[0],/^0 source-table rows/);
  assert.match(summary.lines[1],/Findings exist, but no source-table row/);
  assert.doesNotMatch(text(summary),/Nearest row:|at other conditions/);
  assert.equal(JSON.stringify(cell),before);
});

test('missing cabin pressure is a comparison limit, not proof of different source conditions', () => {
  const q={...presetPoint(db,'station'),p:null};
  const cell=status.cell('pmma','prevention',q,db),summary=questionSummary(cell,db);
  assert.equal(cell.status,'EXTRAPOLATED');assert.ok(cell.rows>0);
  assert.match(summary.answer,/No nearby source row/);assert.doesNotMatch(summary.answer,/other conditions|different/);
  assert.match(summary.lines[1],/pressure/);assert.equal(summary.status,cell.status);
});
