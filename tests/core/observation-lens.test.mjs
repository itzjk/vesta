import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildObservationModel, projectObservationPoints, renderObservationLens } from '../../web/js/world/observation-lens.js';

const dataRoot = fileURLToPath(new URL('../../web/data/', import.meta.url));
const tests = JSON.parse(fs.readFileSync(`${dataRoot}/tests.json`, 'utf8')).tests;
const raw = JSON.parse(fs.readFileSync(`${dataRoot}/tests-raw.json`, 'utf8'));
const db = { tests };
const build = options => buildObservationModel({ db, investigationId: 'PSI-69', ...options });

test('actual FLEX snapshot: study counts, fuel counts, units and fixed ranges', () => {
  const model = build();
  assert.deepEqual(model.totals, { sourceRows: 274, eligible2D: 260, eligible3D: 260 });
  assert.deepEqual(model.excluded, { missingDiameterOrTime: 14, missingAmbientOxygen: 0 });
  assert.deepEqual(model.fuels, ['Methanol', 'Heptane']);
  assert.deepEqual(model.ranges, { x: [1.1,4.67], y: [.3,39.2], z: [12,34] });
  assert.equal(model.points.filter(point => point.fuel === 'Methanol').length, 153);
  assert.equal(model.points.filter(point => point.fuel === 'Heptane').length, 107);
  assert.equal(model.points.filter(point => point.pressureKpa !== null).length, 259);
  assert.equal(model.points.length, new Set(model.points.map(point => point.id)).size);
});

test('selected point retains exact source values and original row reference', () => {
  const point = build({ selectedRowId: 'PSI-69:1' }).selected;
  assert.equal(point.row, tests.find(row => row.id === point.id));
  assert.deepEqual([point.x, point.y, point.z, point.pressureKpa], [1.69,4.3,21,101.018079]);
  assert.deepEqual(point.raw, { x: raw[point.id]['Droplet initial diameter; mm'], y: raw[point.id]['Burn time; s'], z: raw[point.id]['O initial ambient composition; mole fraction'], pressure: raw[point.id]['Ambient pressure; mmHg'] });
  assert.equal(point.diluent, 'N2');
  assert.equal(point.termination, 'Disruption');
  assert.equal(point.sourceRow, 1);
  assert.equal(point.tableFile, 'PSI-69_Experimental table_FLEX.csv');
  assert.equal(point.provenance.z, 'reported-normalized');
});

test('fuel filtering preserves global totals/ranges and never substitutes selection', () => {
  const all = build(), methanol = build({ fuel: 'Methanol', selectedRowId: 'PSI-69:1' });
  const heptane = build({ fuel: 'Heptane', selectedRowId: 'PSI-69:1' });
  assert.equal(methanol.points.length, 153); assert.equal(heptane.points.length, 107);
  assert.deepEqual(methanol.totals, all.totals); assert.deepEqual(heptane.ranges, all.ranges);
  assert.equal(heptane.selected, null); assert.equal(heptane.selectedRowId, 'PSI-69:1');
  assert.equal(heptane.selection.inFilter, false);
  assert.equal(methanol.selected.id, 'PSI-69:1');
  assert.equal(build({ fuel: 'Not a recorded fuel' }).points.length, 0);
});

test('missing axes and pressure remain missing, with no source-row substitution', () => {
  const missingPressure = build({ selectedRowId: 'PSI-69:114' }).selected;
  assert.equal(missingPressure.pressureKpa, null);
  assert.equal(missingPressure.provenance.pressure, 'missing');
  const ids = new Set(build().points.map(point => point.id));
  const excluded = tests.find(row => row.psi_id === 'PSI-69' && !ids.has(row.id));
  const model = build({ selectedRowId: excluded.id });
  assert.equal(model.selected, null); assert.equal(model.selectedRowId, excluded.id);
  assert.equal(model.selection.sourceExists, true); assert.equal(model.selection.eligible2D, false);
});

test('strict numeric/unit gates: no null/string coercion or inferred Z/pressure', () => {
  const original = tests.find(row => row.id === 'PSI-69:1');
  const make = (id, modify) => { const row = structuredClone(original); row.id = id; modify(row); return row; };
  const fixture = [
    make('null-diameter', row => { row.conditions.droplet_diameter_mm.value = null; }),
    make('string-diameter', row => { row.conditions.droplet_diameter_mm.value = '1.69'; }),
    make('empty-time', row => { row.outcomes.burn_time_s.value = ''; }),
    make('bad-diameter-unit', row => { row.conditions.droplet_diameter_mm.unit = 'cm'; }),
    make('bad-time-unit', row => { row.outcomes.burn_time_s.unit = 'ms'; }),
    make('missing-z', row => { row.o2_percent = null; row.n.o2 = 21; row.pressure_kpa = null; row.n.p_inferred = 101; }),
    make('wrong-z-basis', row => { row.o2_basis = 'burner_stream'; }),
    make('actual-zero', row => { row.outcomes.burn_time_s.value = 0; row.o2_percent = 0; row.pressure_kpa = 0; })
  ];
  const model = buildObservationModel({ db: { tests: fixture }, investigationId: 'PSI-69' });
  assert.deepEqual(model.totals, { sourceRows: 8, eligible2D: 3, eligible3D: 1 });
  assert.deepEqual(model.excluded, { missingDiameterOrTime: 5, missingAmbientOxygen: 2 });
  assert.equal(model.points.find(point => point.id === 'missing-z').z, null);
  assert.equal(model.points.find(point => point.id === 'missing-z').pressureKpa, null);
  assert.deepEqual(projectObservationPoints(model, { mode: '3d' }).points.map(point => point.id), ['actual-zero']);
});

test('actual 2D and 3D projections preserve identities and remain finite/bounded', () => {
  const model = build(), ids = model.points.map(point => point.id).sort();
  for (const mode of ['2d', '3d']) for (const yaw of [-10,-Math.PI,-.6,0,Math.PI,10]) for (const pitch of [-10,-1,0,1,10]) {
    const projection = projectObservationPoints(model, { mode, yaw, pitch });
    assert.deepEqual(projection.points.map(point => point.id).sort(), ids);
    for (const point of projection.points) {
      assert.ok([point.x,point.y,point.depth].every(Number.isFinite));
      assert.ok(point.x >= 0 && point.x <= 320 && point.y >= 0 && point.y <= 240);
      assert.equal(point.point.row, tests.find(row => row.id === point.id));
    }
  }
  assert.throws(() => projectObservationPoints(model, { width: 0 }), TypeError);
});

test('coincident rows remain individually addressable and never jitter', () => {
  const first = tests.find(row => row.id === 'PSI-69:1'), twin = { ...first, id: 'PSI-69:coincident-fixture' };
  const model = buildObservationModel({ db: { tests: [first,twin] }, investigationId: 'PSI-69', selectedRowId: twin.id });
  assert.equal(model.points.length, 2); assert.equal(model.selected.row, twin);
  for (const mode of ['2d','3d']) {
    const points = projectObservationPoints(model, { mode }).points;
    assert.equal(points[0].x, points[1].x); assert.equal(points[0].y, points[1].y);
    assert.equal(points[0].depth, points[1].depth);
  }
});

test('pure extraction/projection do not mutate frozen source data', () => {
  const fixture = structuredClone(tests.filter(row => row.psi_id === 'PSI-69'));
  const deepFreeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; };
  const before = JSON.stringify(fixture); deepFreeze(fixture);
  const model = buildObservationModel({ db: { rowsByPsi: { 'PSI-69': fixture } }, investigationId: 'PSI-69', fuel: 'Heptane' });
  projectObservationPoints(model, { mode: '3d' });
  assert.equal(JSON.stringify(fixture), before);
});

test('unsupported studies do not expose FLEX and supported empty data is honest', () => {
  assert.equal(build({ investigationId: 'PSI-25' }).supported, false);
  assert.deepEqual(build({ investigationId: 'PSI-25' }).points, []);
  assert.equal(renderObservationLens({ row: { psi_id: 'PSI-25' }, db }), null);
  const empty = buildObservationModel({ db: { tests: [] }, investigationId: 'PSI-69' });
  assert.deepEqual(empty.totals, { sourceRows: 0, eligible2D: 0, eligible3D: 0 });
  assert.deepEqual(projectObservationPoints(empty).points, []);
});
