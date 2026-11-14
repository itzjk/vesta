// VESTA build · api.mjs
// Writes web/data and web/api/v1 (DESIGN.md 4.2 step 4, 4.4): every file through a temp file and a rename, so several
// builds at the same moment are harmless; a file whose bytes did not change is left alone.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class Writer {
  constructor(outRoot) { this.root = outRoot; this.files = new Map(); this.written = 0; this.unchanged = 0; }
  write(rel, content) {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const abs = path.join(this.root, rel);
    this.files.set(rel, buf.length);
    try { if (fs.readFileSync(abs).equals(buf)) { this.unchanged++; return; } } catch { /* not there yet */ }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = `${abs}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, abs);                                               // atomic on one volume: a reader sees the old file or the new one
    this.written++;
  }
  json(rel, obj, pretty = false) { this.write(rel, JSON.stringify(obj, null, pretty ? 1 : 0) + '\n'); }
}

// 2026-11-14T13:40:00-05:00 and "2026-11-14 13:40 EST": the time in the owner's zone (US Eastern).
export function stamp(ms) {
  const d = new Date(Math.floor(ms / 1000) * 1000);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'longOffset' }).formatToParts(d).map(p => [p.type, p.value]));
  const off = (parts.timeZoneName.match(/[+-]\d{2}:\d{2}/) ?? ['+00:00'])[0];
  const zone = off === '-05:00' ? 'EST' : off === '-04:00' ? 'EDT' : `UTC${off}`;
  return { iso: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${off}`,
           display: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${zone}`, zone };
}

const r2 = x => typeof x === 'number' ? Math.round(x * 100) / 100 : x;
const lohi = v => v == null ? [null, null] : Array.isArray(v) ? v : [v, v];

// --- CSV (written by core/csv.js) ---------------------------------------------------------------------------------------
const TEST_COLUMNS = ['id', 'psi_id', 'investigation', 'source_file', 'source_row', 'row_kind', 'test_label', 'fuel', 'fuel_raw', 'material_id', 'fuel_class', 'fuel_phase',
  'fuel_form', 'fuel_size', 'o2_percent', 'o2_basis', 'o2_raw', 'pressure_kpa', 'pressure_kpa_inferred', 'pressure_raw', 'flow_cm_s', 'flow_raw', 'flow_direction', 'diluent',
  'gravity', 'platform', 'outcomes_json', 'psi_url', 'license'];
export function testsCsv(csv, rows, inv) {
  const rawCols = []; for (const r of rows) for (const k of Object.keys(r.raw ?? {})) if (!rawCols.includes(k)) rawCols.push(k);
  const flat = rows.map(r => {
    const o = { id: r.id, psi_id: r.psi_id, investigation: r.investigation, source_file: r.table_file, source_row: r.row, row_kind: r.row_kind, test_label: r.test_label,
      fuel: r.fuel, fuel_raw: r.fuel_raw, material_id: r.n.material_id, fuel_class: r.n.fuel_class, fuel_phase: r.fuel_phase, fuel_form: r.fuel_form, fuel_size: r.fuel_size,
      o2_percent: r.o2_percent, o2_basis: r.o2_basis, o2_raw: r.o2_raw, pressure_kpa: r.pressure_kpa, pressure_kpa_inferred: r.n.p_inferred, pressure_raw: r.pressure_raw,
      flow_cm_s: r.flow_cm_s, flow_raw: r.flow_raw, flow_direction: r.flow_direction, diluent: r.diluent, gravity: r.gravity, platform: r.platform,
      outcomes_json: r.outcomes && Object.keys(r.outcomes).length ? JSON.stringify(r.outcomes) : null, psi_url: inv?.psi_url ?? null, license: inv?.license ?? null };
    for (const k of rawCols) o[`raw.${k}`] = r.raw?.[k] ?? null;
    return o;
  });
  return csv.toCsv(flat, [...TEST_COLUMNS, ...rawCols.map(k => `raw.${k}`)]);
}
export const FINDING_COLUMNS = ['id', 'kind', 'investigation', 'psi_id', 'pillar', 'topic', 'claim', 'quote', 'work', 'read_in', 'gravity_class', 'o2_percent_min', 'o2_percent_max',
  'pressure_kpa_min', 'pressure_kpa_max', 'material_ids', 'fuel_class', 'habitats', 'support', 'source_kind', 'source_id', 'source_title', 'source_year', 'source_url'];
export function findingsCsv(csv, findings) {
  return csv.toCsv(findings.map(f => { const [o2a, o2b] = lohi(f.n.o2), [pa, pb] = lohi(f.n.p);
    return { id: f.id, kind: f.kind, investigation: f.investigation, psi_id: f.n.psi_id, pillar: f.pillar, topic: f.topic, claim: f.claim, quote: f.quote ?? null, work: f.n.work, read_in: f.n.read_in,
      gravity_class: f.n.gclass, o2_percent_min: o2a, o2_percent_max: o2b, pressure_kpa_min: pa, pressure_kpa_max: pb, material_ids: f.n.material_ids.join(';'), fuel_class: f.n.fuel_class,
      habitats: f.n.habitats.join(';'), support: f.n.support, source_kind: f.source?.kind ?? null, source_id: f.source?.id ?? null, source_title: f.source?.title ?? null,
      source_year: f.source?.year ?? null, source_url: f.source?.url ?? null }; }), FINDING_COLUMNS);
}

// --- coverage/<preset>.json: the gap register ---------------------------------------------------------------------------
export function coverageFile(core, db, presetId, generated_at) {
  const q = core.index.presetPoint(db, presetId, 'prevention', null), p = db.presetById[presetId];
  const concerns = core.index.CONCERNS, cells = [], counts = { PROVEN: 0, EXTRAPOLATED: 0, NEVER_TESTED: 0 };
  for (const material of Object.keys(db.materials)) for (const concern of concerns) {
    const c = core.status.cell(material, concern, { ...q, concern, material }, db);
    counts[c.status] = (counts[c.status] || 0) + 1; cells.push(c);
  }
  return { file: { query: { preset: p.id, habitat: q.habitat, o2: q.o2, p_kpa: q.p, gclass: q.gclass, g_display: q.g_label }, generated_at, tolerance: core.match.TOL,
                   note: 'status = evidence coverage, not a safety certification', axes: core.status.axes(q, db),
                   materials: Object.entries(db.materials).map(([id, m]) => ({ id, ...m })), counts, cells }, counts };
}

// --- rank/<preset>.<concern>.json: the top 25 ----------------------------------------------------------------------------
export function rankFile(core, db, presetId, concern, generated_at) {
  const q = core.index.presetPoint(db, presetId, concern, null), p = db.presetById[presetId];
  const ranked = core.rank.rank(db.findings, q, db);
  const results = ranked.slice(0, 25).map((x, i) => { const st = core.status.findingStatus(x.f, q, db), f = x.f;
    return { rank: i + 1, id: f.id, total: x.total, parts: Object.fromEntries(Object.entries(x.parts).map(([k, v]) => [k, r2(v)])), status: st.status, reasons: st.reasons,
             work: f.n.work, read_in: f.n.read_in, claim: f.claim, ...(f.quote != null ? { quote: f.quote } : { cells: f.cells }), url: f.source?.url ?? null }; });
  return { query: { preset: p.id, habitat: q.habitat, concern, o2: q.o2, p_kpa: q.p, gclass: q.gclass, g_display: q.g_label, material: null },
           generated_at, weights: core.rank.W, findings_ranked: ranked.length, results };
}

// --- telemetry.schema.json, from the one list of frame fields the officer checks -----------------------------------------
const FIELD_NOTE = {
  schema: 'vesta.telemetry/1', t: 'seconds; 0 is the first alarm', simulated: 'true for every scripted scenario; the UI shows SIMULATED whenever it is not explicitly false',
  zone: 'where the sensors are', smoke_pct_alarm: "smoke reading as a percentage of the detector's alarm threshold", co_ppm: 'carbon monoxide, ppm', temp_c: 'temperature, degrees C',
  airflow_cm_s: 'airflow, cm/s', o2_percent: 'cabin oxygen, percent by volume; with pressure_kpa it is the design point of every decision in that frame', pressure_kpa: 'cabin pressure, kPa',
  fans_on: 'actuator state', zone_power_on: 'actuator state', flame_visible: 'observation', suppressant_discharged: 'actuator state',
  material_reported: 'a crew report naming the burning material; matched against material_id by slug' };
export function telemetrySchema(officer) {
  const props = {};
  for (const [k, t] of Object.entries(officer.FRAME_FIELDS)) props[k] = { ...(t === 'string|null' ? { type: ['string', 'null'] } : { type: t }), ...(k === 'schema' ? { const: officer.TELEMETRY } : {}), description: FIELD_NOTE[k] ?? '' };
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: officer.TELEMETRY, title: 'VESTA telemetry frame',
           description: 'JSON Lines, one flat frame per line (a JSON array is also accepted). A field that is absent is unknown and no predicate on it fires. No interpolation: the player holds the last frame.',
           type: 'object', required: ['schema', 't'], properties: props, additionalProperties: true };
}
