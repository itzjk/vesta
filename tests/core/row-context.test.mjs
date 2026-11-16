import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, presetPoint, CONCERNS } from '../../web/js/core/index.js';
import * as status from '../../web/js/core/status.js';
import { nearestSourceRows } from '../../web/js/core/evidence-register.js';
import { rowContext, questionContext, ABSENT, HEADING } from '../../web/js/core/row-context.js';

const raw = Object.fromEntries(['tests', 'findings', 'presets', 'investigations'].map(name =>
  [name, JSON.parse(fs.readFileSync(new URL(`../../web/data/${name}.json`, import.meta.url), 'utf8'))]));
const db = buildIndex(raw);
const byKey = (context, key) => context.fields.find(item => item.key === key);
const has = value => value != null && String(value).trim() !== '';

test('every source row reports its flow and specimen fields verbatim or as absent', () => {
  assert.equal(HEADING, 'Recorded but not matched');
  for (const row of db.tests) {
    const context = rowContext(row);
    for (const [key, source] of [['flow', row.flow_raw ?? row.flow_cm_s], ['flow_direction', row.flow_direction],
      ['fuel_form', row.fuel_form], ['fuel_size', row.fuel_size], ['fuel_raw', row.fuel_raw]]) {
      const item = byKey(context, key);
      assert.ok(item, `${row.id} ${key}`);
      assert.equal(item.recorded, has(source));
      assert.equal(item.text, has(source) ? `recorded: ${String(source).trim()}` : ABSENT);
    }
    assert.equal(context.flow, has(row.flow_raw ?? row.flow_cm_s));
    assert.equal(context.thickness, has(row.fuel_size) && /thick/i.test(row.fuel_size));
    for (const item of context.fields) assert.doesNotMatch(`${item.label} ${item.text}`, /undefined|NaN|\[object|\bsafe\b|proven|validated|certif/i);
  }
});

test('fan, air and ignition conditions are shown with the raw cell and never turned into a velocity', () => {
  let settings = 0, ignitions = 0;
  for (const row of db.tests) {
    const context = rowContext(row);
    for (const key of ['fan_display', 'air_display', 'flow_restrictor', 'ignition_power_w', 'ignition_time_s']) {
      const entry = row.conditions?.[key], item = byKey(context, key);
      if (!entry || !has(entry.raw ?? entry.value)) { assert.equal(item, undefined); continue; }
      assert.equal(item.value, String(entry.raw ?? entry.value).trim());
      // Exactly the raw cell plus the unit text stored with it: nothing derived is added.
      const unit = entry.unit, shown = !unit || item.value.includes(unit) ? item.value : /\s/.test(unit) ? `${item.value} · ${unit}` : `${item.value} ${unit}`;
      assert.equal(item.text, `recorded: ${shown}`);
      if (key.startsWith('ignition')) ignitions++;
      else { settings++; assert.match(entry.unit, /no unit in the table/); assert.equal(context.setting, true); }
    }
    // A setting never fills in the flow field.
    if (!has(row.flow_raw ?? row.flow_cm_s)) assert.equal(byKey(context, 'flow').text, ABSENT);
    // Fuel supply rates of gas burners are not listed as ambient flow.
    assert.ok(!context.fields.some(item => /flow_rate|_mfc_/.test(item.key)));
  }
  assert.ok(settings > 0 && ignitions > 0);
});

test('every question of every preset counts flow and thickness over its nearby rows, or over all its rows when none is nearby', () => {
  let nearbyQuestions = 0;
  for (const preset of db.presets) {
    const q = presetPoint(db, preset.id);
    for (const material of Object.keys(db.materials)) for (const concern of CONCERNS) {
      const cell = status.cell(material, concern, q, db), context = questionContext(material, concern, q, db);
      const rows = (db.rowsByMaterial[material] ?? []).filter(row => row.n.pillars.includes(concern));
      const scoped = cell.status === 'PROVEN' ? rows.filter(row => cell.hit_ids.includes(row.id)) : rows;
      assert.equal(context.scope, cell.status === 'PROVEN' ? 'nearby' : 'question');
      assert.deepEqual([...context.row_ids].sort(), scoped.map(row => row.id).sort());
      const flow = scoped.filter(row => has(row.flow_raw ?? row.flow_cm_s)).length;
      const thickness = scoped.filter(row => has(row.fuel_size) && /thick/i.test(row.fuel_size)).length;
      assert.deepEqual([context.counts.total, context.counts.flow, context.counts.thickness], [scoped.length, flow, thickness]);
      const where = `${preset.id} ${material} ${concern}`;
      if (!scoped.length) assert.match(context.sentence, /^No source row for this question in this collection/, where);
      else {
        assert.ok(context.sentence.includes(`flow is recorded in ${flow} and a named thickness in ${thickness}; none is compared.`), where);
        if (cell.status === 'PROVEN') { nearbyQuestions++; assert.ok(context.sentence.startsWith(`Of the ${scoped.length} nearby row`), where); }
        else assert.ok(context.sentence.startsWith('No nearby row. Of the '), where);
      }
      assert.ok(context.sentence.length <= 140, where);
      assert.doesNotMatch(context.sentence, /\bsafe\b|proven|validated|certif|undefined|NaN/i);
      assert.equal(context.note != null, scoped.some(row => rowContext(row).setting));
      // Every row the detail shows gets a context without throwing.
      for (const { row } of nearestSourceRows(material, concern, q, db)) assert.equal(rowContext(row).id, row.id);
    }
  }
  assert.ok(nearbyQuestions > 0);
});

test('station PMMA prevention names its nearby count from the cell', () => {
  const q = presetPoint(db, 'station'), cell = status.cell('pmma', 'prevention', q, db);
  const context = questionContext('pmma', 'prevention', q, db);
  assert.equal(context.counts.total, cell.hit_ids.length);
  assert.match(context.sentence, new RegExp(`^Of the ${cell.hit_ids.length} nearby rows, flow is recorded in \\d+ and a named thickness in \\d+; none is compared\\.$`));
});
