import { rank } from './rank.js'; import { cell, findingStatus } from './status.js';
import { clock } from './clock.js'; import { slug } from './index.js';

export const OFFICER_VERSION = 'vesta.deterministic-officer/1';

const OPS = { '==': (a, b) => a === b, '!=': (a, b) => a !== b, '>': (a, b) => a > b, '>=': (a, b) => a >= b, '<': (a, b) => a < b, '<=': (a, b) => a <= b };
const holds = (when, fr) => when.every(([k, op, v]) => fr[k] !== undefined && OPS[op](fr[k], v));
export const matchesConditions = holds;
const basisOf = w => ['flight', 'ground_lowg', 'normal_g'].includes(w) ? 'experiment' : w === 'operations' ? 'operations' : 'summary';

export function run(frames, db, meta) {
  const fired = new Set(), log = [];
  for (const fr of frames) for (const s of db.playbook.steps) {
    if (fired.has(s.id) || !(s.after ?? []).every(id => fired.has(id)) || !holds(s.when, fr)) continue;
    fired.add(s.id); log.push(decide(s, fr, db, meta));
  }
  return log;
}

export function decide(s, fr, db, meta) {
  const q = { habitat: meta.habitat, concern: s.pillar, o2: fr.o2_percent, p: fr.pressure_kpa, gclass: meta.gclass,
              material: s.material_from ? slug(fr[s.material_from]) : null };
  const head = { step: s.id, t: fr.t, label: s.label, question: s.question, pillar: s.pillar, say: s.say };
  const noSource = (gap, extra = {}) => { const p = db.protocolById[s.fallback], ok = p && db.findingById[p.finding_id];
    return { ...head, state: 'NO_SOURCE', basis: null, rule_id: null, earth: null, nasa: [], interpretation: false, limits: null, coverage: null, gap, ...extra,
             action: ok ? p.action : 'Hand the decision to the crew. No verified protocol line for this step.',
             protocol: ok ? { id: p.id, action: p.action, finding_id: p.finding_id, limit: p.limit } : null }; };
  if (s.kind === 'material') {
    const c = cell(q.material, s.pillar, q, db);
    if (c.status === 'NEVER_TESTED') return noSource('no_row_no_finding', { cell: c });
    const cites = rank(c.finding_ids.map(id => db.findingById[id]), q, db).slice(0, 3);
    return { ...head, state: 'SOURCED', basis: c.rows ? 'experiment' : basisOf(cites[0].f.n.work), rule_id: null, earth: null,
             nasa: cites.map(x => ({ finding_id: x.f.id, score: x.total })), row_ids: c.hit_ids ?? (c.nearest ? [c.nearest.id] : []),
             action: s.action_if_tested, interpretation: true, limits: s.limits ?? null, coverage: { status: c.status, reasons: c.reasons }, cell: c, protocol: null, gap: null };
  }
  const rule = (s.rule_ids ?? []).map(id => db.ruleById[id]).find(r => r && r.finding_ids.some(id => db.findingById[id]));
  const ids  = [...new Set([...(s.finding_ids ?? []), ...(rule ? rule.finding_ids : [])])];
  const F    = ids.map(id => db.findingById[id]).filter(Boolean);
  if (!rule || !F.length) return noSource((s.rule_ids ?? []).length ? 'rule_without_verified_finding' : 'no_verified_finding_on_topic');
  const cites = rank(F, q, db).slice(0, 3), best = cites[0].f, cov = findingStatus(best, q, db, { fuel_class: s.fuel_class });
  return { ...head, state: 'SOURCED', basis: basisOf(best.n.work), rule_id: rule.id,
           earth: { text: rule.earth_instinct, finding_id: db.findingById[rule.earth_instinct_finding_id] ? rule.earth_instinct_finding_id : null },
           nasa: cites.map(x => ({ finding_id: x.f.id, score: x.total })), action: rule.vesta_decides, interpretation: true, limits: rule.limits,
           coverage: { status: cov.status, reasons: cov.reasons }, protocol: null, gap: null };
}


export function decisionLog(frames, db, meta) {
  const steps = run(frames, db, meta), last = steps.length ? steps[steps.length - 1].t : 0;
  const first = frames.find(f => f.o2_percent !== undefined || f.pressure_kpa !== undefined) ?? {};
  return { schema: 'vesta.decision-log/1', scenario: meta.id ?? null, simulated: meta.simulated !== false,
           scope: 'decision-support prototype, not certified flight software',
           cabin: { preset: meta.preset ?? null, habitat: meta.habitat ?? null, gclass: meta.gclass ?? null, zone: meta.zone ?? first.zone ?? null,
                    o2_percent: first.o2_percent ?? null, pressure_kpa: first.pressure_kpa ?? null },
           steps, clock: clock(meta, last, steps, db) };
}

export const TELEMETRY = 'vesta.telemetry/1';
export const FRAME_FIELDS = { schema: 'string', t: 'number', simulated: 'boolean', zone: 'string',
  smoke_pct_alarm: 'number', co_ppm: 'number', temp_c: 'number', airflow_cm_s: 'number', o2_percent: 'number', pressure_kpa: 'number',
  fans_on: 'boolean', zone_power_on: 'boolean', flame_visible: 'boolean', suppressant_discharged: 'boolean', material_reported: 'string|null' };

export function checkFrame(fr) {
  if (fr === null || typeof fr !== 'object' || Array.isArray(fr)) return 'the line is not a JSON object';
  if (fr.schema !== TELEMETRY) return `schema (expected "${TELEMETRY}")`;
  if (typeof fr.t !== 'number' || !Number.isFinite(fr.t)) return 't (expected a number of seconds)';
  for (const [k, type] of Object.entries(FRAME_FIELDS)) {
    const v = fr[k];
    if (v === undefined) continue;
    if (type === 'string|null') { if (v !== null && typeof v !== 'string') return `${k} (expected a string or null)`; }
    else if (typeof v !== type || (type === 'number' && !Number.isFinite(v))) return `${k} (expected a ${type})`;
  }
  return null;
}

export function parseFrames(text) {
  const fail = (line, field) => ({ frames: [], error: { line, field, message: `Line ${line} is not ${TELEMETRY}: ${field}.` } });
  const src = String(text ?? '').replace(/^﻿/, '');
  let items;
  if (src.trimStart().startsWith('[')) {
    try { items = JSON.parse(src).map((v, i) => [i + 1, v]); } catch { return fail(1, 'the file is not valid JSON'); }
  } else {
    items = [];
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      try { items.push([i + 1, JSON.parse(lines[i])]); } catch { return fail(i + 1, 'the line is not valid JSON'); }
    }
  }
  if (!items.length) return fail(1, 'the file has no frame');
  for (const [n, fr] of items) { const bad = checkFrame(fr); if (bad) return fail(n, bad); }
  return { frames: items.map(([, fr]) => fr), error: null };
}
