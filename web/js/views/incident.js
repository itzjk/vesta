
export const TELEMETRY_SCHEMA = 'vesta.telemetry/1';
export const DECISION_LOG_SCHEMA = 'vesta.decision-log/1';

export const FRAME_FIELDS = {
  schema: 'string', t: 'number', simulated: 'boolean', zone: 'string',
  smoke_pct_alarm: 'number', co_ppm: 'number', temp_c: 'number', airflow_cm_s: 'number',
  o2_percent: 'number', pressure_kpa: 'number',
  fans_on: 'boolean', zone_power_on: 'boolean', flame_visible: 'boolean', suppressant_discharged: 'boolean',
  material_reported: 'string|null',
};
const EXPECT = { string: 'a string', number: 'a number', boolean: 'true or false', 'string|null': 'a string or null' };
const typeOk = (v, type) => type === 'number' ? typeof v === 'number' && Number.isFinite(v)
  : type === 'string|null' ? v === null || typeof v === 'string' : typeof v === type;

export function frameProblem(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return { field: 'frame', detail: 'A frame is one flat JSON object.' };
  if (f.schema !== TELEMETRY_SCHEMA) return { field: 'schema', detail: `Expected "${TELEMETRY_SCHEMA}".` };
  if (!typeOk(f.t, 'number')) return { field: 't', detail: 'Expected a number of seconds.' };
  for (const [k, type] of Object.entries(FRAME_FIELDS)) if (k in f && !typeOk(f[k], type)) return { field: k, detail: `Expected ${EXPECT[type]}.` };
  return null;
}
export const telemetryError = (line, field) => `Line ${line} is not ${TELEMETRY_SCHEMA}: ${field}.`;

export function parseTelemetry(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const bad = (line, field, detail) => ({ ok: false, line, field, detail, message: telemetryError(line, field) });
  const body = src.trim();
  if (!body) return bad(1, 'schema', 'The file is empty.');
  const items = [];
  if (body[0] === '[') {
    let arr; try { arr = JSON.parse(body); } catch { return bad(1, 'JSON', 'The file starts like a JSON array but does not parse.'); }
    if (!Array.isArray(arr) || !arr.length) return bad(1, 'schema', 'The array holds no frame.');
    arr.forEach((value, i) => items.push({ line: i + 1, value }));
  } else {
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const s = lines[i].trim(); if (!s) continue;
      try { items.push({ line: i + 1, value: JSON.parse(s) }); } catch { return bad(i + 1, 'JSON', 'The line does not parse as JSON.'); }
    }
  }
  let prev = -Infinity;
  for (const { line, value } of items) {
    const p = frameProblem(value); if (p) return bad(line, p.field, p.detail);
    if (value.t < prev) return bad(line, 't', 'Frames must be in time order.');
    prev = value.t;
  }
  return { ok: true, frames: items.map(x => x.value) };
}

export function prepareFrames(frames) {
  const out = frames.map(f => ({ ...f }));
  const usable = out.length > 0;
  return { frames: out, cabin_from: 'file', usable };
}

export function thresholds(playbook) {
  const out = {};
  for (const s of playbook?.steps ?? []) for (const [field, op, value] of s.when ?? [])
    if (typeof value === 'number' && field !== 't' && !(out[field] ||= []).some(x => x.op === op && x.value === value)) out[field].push({ op, value, step: s.id });
  return out;
}

const firstSentence = s => { const m = String(s ?? '').match(/^.*?[.!?](?=\s|$)/); return m ? m[0] : String(s ?? ''); };
const zoneLabel = meta => meta?.zone_label ?? String(meta?.zone ?? '').replace(/-/g, ' ');

const CHANGES = [
  ['fans_on', v => v ? 'fans on' : 'fans off'],
  ['zone_power_on', v => v ? 'zone power on' : 'zone power off'],
  ['flame_visible', v => v ? 'flame visible' : 'no visible flame'],
  ['suppressant_discharged', v => v ? 'suppressant discharged' : null],
];
export function crewLog(frames, log, meta) {
  const out = []; let prev = null;
  const push = (t, kind, text, extra) => out.push({ t, kind, text, ...extra });
  const byT = new Map(); for (const e of log) { if (!byT.has(e.t)) byT.set(e.t, []); byT.get(e.t).push(e); }
  for (const f of frames) {
    if (prev) {
      for (const [k, word] of CHANGES) if (typeof f[k] === 'boolean' && typeof prev[k] === 'boolean' && f[k] !== prev[k]) { const w = word(f[k]); if (w) push(f.t, 'telemetry', w); }
      if (f.material_reported != null && f.material_reported !== prev.material_reported) push(f.t, 'crew', `crew reports burnt material: ${f.material_reported}`);
    }
    for (const e of byT.get(f.t) ?? []) {
      if (e === log[0]) { push(f.t, 'alarm', `alarm, ${zoneLabel(meta) || f.zone || 'cabin'}`); push(f.t, 'comm', 'alert sent to Earth'); }
      push(f.t, e.state === 'NO_SOURCE' ? 'nosource' : 'vesta',
        e.state === 'NO_SOURCE' ? (e.protocol ? `VESTA: NO SOURCE. ISS procedure: ${e.protocol.action}` : 'VESTA: NO SOURCE. No verified protocol line.') : `VESTA: ${firstSentence(e.action)}`, { step: e.step });
    }
    byT.delete(f.t); prev = f;
  }
  return out;
}

export function decisionLog({ db, meta, frames, core, source = null }) {
  const out = core.officer.decisionLog(frames, db, meta);
  return source ? { ...out, simulated: frames.some(f => f.simulated !== false), telemetry: source } : out;
}

const pad2 = n => String(n).padStart(2, '0');
const mmss = s => { const a = Math.abs(Math.round(s)); return pad2(Math.floor(a / 60)) + ':' + pad2(a % 60); };
const tplus = s => (s < 0 ? 'T-' : 'T+') + mmss(s);
const numOr = (v, d) => { const x = Number(v); return v != null && v !== '' && Number.isFinite(x) ? x : d; };
const CHANNEL_FALLBACK = [
  { field: 'smoke_pct_alarm', label: 'smoke', unit: '% of alarm' }, { field: 'co_ppm', label: 'CO', unit: 'ppm' },
  { field: 'temp_c', label: 'temp', unit: '°C' }, { field: 'airflow_cm_s', label: 'airflow', unit: 'cm/s' }];
const ACTUATORS = [
  ['fans_on', 'fans', 'ON', 'OFF'], ['zone_power_on', 'zone power', 'ON', 'OFF'],
  ['flame_visible', 'flame', 'VISIBLE', 'NOT SEEN'], ['suppressant_discharged', 'suppressant', 'DISCHARGED', 'NOT USED']];
const GLABEL = { micro: '0 g', normal: '1 g' };
const EPS = 1e-9;

export function mount(root, ctx) {
  const view = build(root, ctx);
  return () => view.destroy();
}

function build(root, ctx) {
  const { db, ui, core } = ctx, h = ui.el, svg = ui.svg, text = core.text ?? {};
  const replace = (node, ...children) => node.replaceChildren(...children.flat().filter(x => x != null && x !== false));
  const params = ctx.params ?? {};
  const simple = params.view !== 'details' && ctx.view !== 'details';
  const still = !!ctx.capture || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let raf = 0, dead = false, sceneStage = null;
  try { ui.css('css/views/incident.css'); } catch { /* the shell reports a missing stylesheet */ }
  root.textContent = '';

  const scenario = db.scenario, meta = scenario?.meta ?? null;
  const lines = (db.lines && db.lines.lines && typeof db.lines.lines === 'object' ? db.lines.lines : db.lines) ?? {};
  const steps = db.playbook?.steps ?? [];
  if (!(meta && scenario.frames?.length && steps.length && core.officer?.run && core.clock?.clock)) {
    const why = !meta || !scenario.frames?.length ? 'The scenario file is not in the build.' : !steps.length ? 'The playbook is not in the build.' : 'The officer module did not load.';
    const msg = `Incident mode has nothing to replay. ${why} Nothing is shown without its source.`;
    root.append(h('div.inc.inc-missing', ui.empty ? ui.empty('none', msg) : h('p', msg)));
    return { destroy() { root.textContent = ''; } };
  }
  const preset = db.presetById?.[meta.preset] ?? null;
  const nInv = db.investigations?.length || null;
  const baseWords = text.base ? text.base(nInv) : "in VESTA's evidence base";
  const thr = thresholds(db.playbook);
  const channels = meta.channels?.length ? meta.channels : CHANNEL_FALLBACK;

  const S = { frames: [], log: [], crew: [], t0: 0, tMin: 0, tLast: 0, tEnd: 0, tMax: 0, heard: null, reply: null, unusable: false,
              t: 0, playing: false, started: false, holdUntil: 0, lastTick: 0, selected: null, user: null, cabinFrom: 'file', series: {} };
  const speedBase = Math.max(1, numOr(params.speed, numOr(meta.playback?.speed, 40)));
  const speedAfter = Math.max(speedBase, numOr(meta.playback?.speed_after_last_step, 240));
  const holdS = Math.max(0, numOr(params.hold, numOr(meta.playback?.hold_s, 2.5)));

  function load(frames, user) {
    const prep = prepareFrames(frames);
    S.frames = prep.frames; S.cabinFrom = prep.cabin_from; S.user = user ?? null; S.unusable = !prep.usable;
    S.log = prep.usable ? core.officer.run(S.frames, db, meta) : [];
    S.t0 = S.log[0]?.t ?? 0;
    S.crew = crewLog(S.frames, S.log, meta);
    S.tMin = S.frames[0].t; S.tLast = S.log.length ? S.log[S.log.length - 1].t : S.frames[S.frames.length - 1].t;
    const c = core.clock.clock(meta, 0, [], db);
    S.heard = S.log.length ? c.heard : null; S.reply = S.log.length ? c.reply : null;
    S.tEnd = S.heard != null ? Math.max(S.tLast, S.t0 + S.heard) : S.tLast;
    S.tMax = S.reply != null ? Math.max(S.tEnd, S.t0 + S.reply) : S.tEnd;
    S.series = {}; for (const ch of channels) S.series[ch.field] = S.frames.filter(f => typeof f[ch.field] === 'number').map(f => [f.t, f[ch.field]]);
  }
  load(scenario.frames, null);
  const tParam = numOr(params.t, null), wantsPlay = params.play != null && params.play !== '0';
  S.t = tParam != null ? Math.min(Math.max(tParam, S.tMin), S.tMax) : S.tMin;
  S.started = tParam != null || wantsPlay;
  S.playing = wantsPlay && !ctx.capture && params.paused == null && S.t < S.tEnd - EPS;
  S.selected = params.step || null;

  const fired = () => S.log.filter(e => e.t <= S.t + EPS);
  const frameAt = () => { let f = S.frames[0]; for (const x of S.frames) { if (x.t <= S.t + EPS) f = x; else break; } return f; };
  const ended = () => S.log.length > 0 && S.t >= S.tEnd - EPS;
  const shifted = () => S.log.map(e => ({ ...e, t: e.t - S.t0 }));
  const clockNow = () => core.clock.clock(meta, S.t - S.t0, shifted(), db);
  const simulated = () => S.frames.some(f => f.simulated !== false);
  const finding = id => (id != null && db.findingById?.[id]) || null;
  const say = key => (typeof lines[key] === 'string' ? lines[key] : null);
  const levelOf = f => { try { return (text.level && text.level(f)) || ''; } catch { return ''; } };
  const pressureOf = kpa => { try { return text.pressure ? text.pressure(kpa) : `${kpa} kPa`; } catch { return `${kpa} kPa`; } };
  const gLabel = preset?.g_display ?? GLABEL[meta.gclass] ?? (text.gravity ? text.gravity(meta.gclass) : String(meta.gclass ?? ''));
  const cabinLine = f => [typeof f.o2_percent === 'number' ? `${Math.round(f.o2_percent * 10) / 10} % O2` : 'O2: unknown',
    typeof f.pressure_kpa === 'number' ? pressureOf(f.pressure_kpa) : 'pressure: unknown', gLabel || null].filter(Boolean).join(' · ');
  const cite = (id, opts) => { try { return ui.cite(id, opts); } catch { return h('span.cite', { data: { cite: id } }, String(id)); } };
  const chip = (status, opts) => { try { return ui.chip(status, opts); } catch { return h('span.chip', { data: { status } }, String(status).replace(/_/g, ' ')); } };
  const vesta = (pose, line, size) => { try { return ui.vesta(pose, { size, say: line || undefined }); } catch { return line ? h('div.inc-say', line) : null; } };
  const writeHash = patch => { try { ctx.setParams?.(patch, { replace: true, render: false }); } catch { /* the hash is a convenience here */ } };
  const stop = () => { S.playing = false; if (raf) cancelAnimationFrame(raf); raf = 0; };

  const N = {};                                                   // the nodes that change
  N.sim = h('div.inc-sim', { data: { sim: '' } });
  N.cabin = h('div.inc-cabin');
  N.channels = h('div.inc-channels');
  N.actuators = h('div.inc-actuators');
  N.crew = h('ol.inc-crew');
  const left = ui.panel(h('h2.panel-title', h('span.inc-dim', 'CABIN '), zoneLabel(meta)), [
    N.sim, N.cabin, N.channels, N.actuators,
    h('p.inc-params', 'thresholds are scenario parameters, not NASA limits'),
    h('div.inc-crewbox', h('div.inc-subhead', 'CREW LOG'), N.crew),
  ], { class: 'inc-left' });

  N.stage = h('div.inc-stage');
  N.list = h('ol.inc-list');
  const centre = ui.panel(null, [N.stage,
    h('div.inc-listbox', h('div.inc-subhead', h('span', 'DECISION LOG'), h('span.inc-subnote', 'click a fired step to inspect its source')), N.list)],
    { class: 'inc-centre', strong: true });

  N.delays = h('div.inc-delays');
  N.track = h('div.inc-track');
  N.readouts = h('div.inc-readouts');
  N.houston = h('div.inc-houston');
  N.decided = h('div.inc-decided');
  N.source = h('div.inc-source');
  const right = ui.panel('THE SILENCE', [N.delays, N.track, N.readouts, N.houston, N.decided, N.source], { class: 'inc-right' });

  N.btnRun = ui.button('RUN', { action: 'play', onClick: () => (S.playing ? pause() : run()), title: 'Run or pause (Space)' });
  N.btnStep = ui.button('STEP', { action: 'step', onClick: () => stepTo(+1), title: 'Next step (right arrow)' });
  N.btnReset = ui.button('RESET', { action: 'reset', onClick: reset, title: 'Back to standby' });
  N.now = h('span.inc-now');
  N.scrubFill = h('div.inc-scrub-fill'); N.scrubKnob = h('div.inc-scrub-knob'); N.scrubMarks = h('div.inc-scrub-marks');
  N.scrub = h('div.inc-scrub', { role: 'slider', tabindex: '0', 'aria-label': 'Scenario time', title: 'Drag to move through the replay' }, h('div.inc-scrub-rail'), N.scrubFill, N.scrubMarks, N.scrubKnob);
  N.endLabel = h('span.inc-end');
  N.speed = h('span.inc-speed');
  N.file = h('input.inc-file', { type: 'file', accept: '.jsonl,.json,.ndjson,application/json,text/plain', hidden: true, data: { telemetryInput: '' } });
  N.msg = h('div.inc-msg', { role: 'status', hidden: true });
  const bar = h('div.inc-transport',
    h('div.inc-buttons', N.btnReset, N.btnRun, N.btnStep),
    N.now, N.scrub, N.endLabel, N.speed,
    h('div.inc-buttons',
      ui.button('Export log', { action: 'export-json', small: true, onClick: exportLog, title: 'Download the decision log (vesta.decision-log/1)' }),
      ui.button('Load telemetry .jsonl', { action: 'load-telemetry', small: true, onClick: () => N.file.click(), title: 'Run the same officer on your own vesta.telemetry/1 file' }), N.file));
  const wrap = h('div.inc', { data: { incident: '', presentation: simple ? 'simple' : 'details' } });
  if (simple) {
    const intro = ui.answer('What do you do when Earth cannot answer yet?', S.started ? text.incidentAnswer(meta, S.t - S.t0, shifted(), db) : 'Every scripted decision needs evidence. Run the drill to see what happens.', { class: 'inc-simple-intro' });
    N.answer = intro.querySelector('[data-answer]');
    N.answer.classList.add('inc-answer');
    intro.append(h('p.inc-simple-scenario', 'Separate spacecraft scenario: a scripted fire on the way to Mars, in weightlessness.'));
    N.simpleStep = h('section.inc-simple-step', { 'aria-label': 'Current decision' });
    N.simpleClock = h('p.inc-simple-clock', { data: { silenceClock: '' } });
    N.simpleAssumption = h('p.inc-simple-assumption');
    N.simpleSimulation = h('p', 'SIMULATED TELEMETRY · SCRIPTED · NOT A PHYSICS MODEL');
    N.simpleDots = h('div.inc-dots', { role: 'group', 'aria-label': 'Drill steps' });
    N.simpleRun = ui.button('Run the drill', { primary: true, action: 'play', onClick: () => S.playing ? pause() : run() });
    N.simpleTrust = ui.button('Can you trust it?', { action: 'next-story', onClick: () => ctx.go?.('#/engine') });
    N.simpleStepButton = ui.button('Next step', { action: 'step', onClick: () => stepTo(+1) });
    wrap.append(
      intro,
      N.simpleStep,
      h('section.inc-simple-silence', { 'aria-label': 'The Silence' }, h('h2', 'The Silence'), N.simpleClock, N.track, N.simpleAssumption,
        h('div.inc-simple-clock-source', finding(meta.comm?.one_way_finding) ? cite(meta.comm.one_way_finding, { label: 'source' }) : null)),
      h('section.inc-simple-progress', { 'aria-label': 'Drill progress' }, N.simpleDots,
        h('div.inc-simple-actions', N.simpleRun, N.simpleStepButton, N.simpleTrust)),
      h('footer.inc-simple-disclosures', N.simpleSimulation, h('p', text.STATUS_LINE ?? 'STATUS = EVIDENCE COVERAGE, NOT A SAFETY CERTIFICATION')), N.msg);
  } else wrap.append(left, centre, right, bar, N.msg);
  root.append(wrap);

  let leftKey = null;
  function renderLeft() {
    const f = frameAt(), key = `${S.frames.indexOf(f)}:${fired().length}:${S.user?.name ?? ''}`;
    if (key === leftKey) return; leftKey = key;
    const sim = simulated();                                      // SIMULATED unless every frame says simulated: false
    N.sim.replaceChildren(chip('SIMULATED', { label: sim ? 'SIMULATED TELEMETRY' : 'TELEMETRY FROM A FILE', small: true }),
      h('span.inc-sim-rest', sim ? '· SCRIPTED · NOT A PHYSICS MODEL' : '· REPLAYED AS WRITTEN · NOT A PHYSICS MODEL'));
    N.sim.title = S.user ? `File: ${S.user.name}` : (meta.note ?? '');
    const cabinCite = !S.user && finding(meta.cabin_finding) ? cite(meta.cabin_finding, { small: true }) : null;
    N.cabin.replaceChildren(
      h('div.inc-cabin-line', { data: { claim: cabinCite ? 'cabin' : null } }, h('span.inc-cabin-num', cabinLine(f)), cabinCite),
      h('div.inc-cabin-sub', S.user ? `${S.user.name} · ${S.frames.length} frames · scenario gravity and playbook`
        : [preset?.label, 'fictional vehicle'].filter(Boolean).join(' · ')));
    const tTo = S.frames[S.frames.length - 1].t;
    N.channels.replaceChildren(...channels.map(ch => {
      const v = f[ch.field], t = thr[ch.field]?.find(x => x.op === '>=' || x.op === '>') ?? null, pts = S.series[ch.field];
      const hi = Math.max(...pts.map(p => p[1]), t?.value ?? -Infinity, 1);
      let sp = null; try { sp = pts.length ? ui.spark(pts, S.t, { width: 212, height: 44, min: 0, max: hi * 1.1, threshold: t?.value, from: S.tMin, to: tTo, label: `${ch.label} over time` }) : null; } catch { sp = null; }
      const over = !!t && typeof v === 'number' && (t.op === '>=' ? v >= t.value : v > t.value);
      return h('div.inc-ch', { data: { channel: ch.field, over: over || null } },
        h('div.inc-ch-name', h('b', ch.label), h('span', ch.unit)),
        h('div.inc-ch-spark', sp),
        h('div.inc-ch-val', typeof v === 'number' ? h('b', String(v)) : h('span.inc-na', 'no value'),
          t ? h('span.inc-ch-thr', { title: `scenario parameter of step ${t.step}` }, `step at ${t.value}`) : null));
    }));
    N.actuators.replaceChildren(
      ...ACTUATORS.map(([k, label, on, off]) => h('div.inc-act', { data: { field: k, state: f[k] === true ? 'on' : f[k] === false ? 'off' : 'unknown' } },
        h('span.inc-act-name', label), h('b', f[k] === true ? on : f[k] === false ? off : 'NO VALUE'))),
      h('div.inc-act.inc-act-wide', { data: { field: 'material_reported', state: f.material_reported ? 'on' : 'off' } },
        h('span.inc-act-name', 'burnt material (crew report)'), h('b', f.material_reported ?? 'NONE YET')));
    const seen = S.crew.filter(e => e.t <= S.t + EPS);
    N.crew.replaceChildren(...(seen.length ? seen.slice(-10).map(e => h('li', { data: { kind: e.kind } }, h('span.inc-crew-t', mmss(e.t - S.t0)), h('span.inc-crew-x', e.text)))
      : [h('li.inc-crew-idle', h('span.inc-crew-t', '--:--'), h('span.inc-crew-x', 'nominal · no alarm'))]));
  }

  const frameOf = e => S.frames.find(f => f.t === e.t) ?? frameAt();
  const materialLabel = e => frameOf(e).material_reported ?? db.materials?.[e.cell?.material]?.label ?? e.cell?.material ?? 'this material';
  function gapSentence(e) {
    if (e.gap === 'no_row_no_finding') {
      const m = materialLabel(e), rows = db.rowsByMaterial?.[e.cell?.material] ?? [], where = e.cell?.elsewhere ?? [];
      const names = [...new Set(rows.map(r => r.investigation).filter(Boolean))];
      const also = rows.length && where.length ? ` ${m} appears only in ${where.join(' and ')} tables: ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}${names.length ? ` (${names.join(', ')})` : ''}.` : '';
      return { text: `No test row and no verified finding for ${m} and ${e.pillar} ${baseWords}.${also}`, cite: rows[0]?.id ?? null };
    }
    const topic = steps.find(x => x.id === e.step)?.topic;
    if (e.gap === 'no_verified_finding_on_topic' && topic) return { text: `No rule and no verified finding on ${topic.replace(/_/g, ' ')} ${baseWords}.`, cite: null };
    let s = null; try { s = text.reasonSentence ? text.reasonSentence(e.gap, { n: nInv }) : null; } catch { s = null; }
    return { text: s ?? `No verified finding for this step ${baseWords}.`, cite: null };
  }

  function gapSource(e) {
    return ui.button('source', { class: 'cite', onClick: () => {
      const material = e.cell?.material;
      const topic = steps.find(s => s.id === e.step)?.topic;
      const rows = material ? (db.rowsByMaterial[material] ?? []).filter(r => r.n.pillars.includes(e.pillar)) : [];
      const findings = db.findings.filter(f => material ? f.pillar === e.pillar && (f.n.material_ids ?? []).includes(material) : f.topic === topic);
      const dialog = h('dialog.inc-gap-dialog', { 'aria-label': 'Evidence behind this gap' });
      const close = ui.button('Close', { onClick: () => dialog.close() });
      dialog.append(h('h2', 'Evidence behind this gap'),
        h('p', material ? `Query: ${materialLabel(e)} and ${text.concern(e.pillar).toLowerCase()}. No atmosphere match is claimed.` : `Query: verified findings about ${String(topic ?? '').replace(/_/g, ' ')}.`),
        h('p', `${db.tests.length} source-table rows and ${db.findings.length} gated findings searched ${baseWords}.`),
        h('p', material ? `${rows.length} material-and-concern rows; ${findings.length} matching findings.` : `${findings.length} matching findings.`),
        h('p', 'This is a query of this evidence base, not a claim about all NASA research.'),
        h('div.inc-gap-links', h('a', { href: 'api/v1/tests.csv', target: '_blank', rel: 'noopener' }, 'Source-table rows'), h('a', { href: 'api/v1/findings.csv', target: '_blank', rel: 'noopener' }, 'Gated findings')),
        close);
      dialog.addEventListener('close', () => dialog.remove(), { once: true });
      wrap.append(dialog); dialog.showModal(); close.focus();
    } });
  }

  function chipsRow(e) {
    const fr = frameOf(e), q = { o2: fr.o2_percent, p: fr.pressure_kpa, g_label: gLabel, gclass: meta.gclass };
    if (e.state === 'NO_SOURCE') {
      const g = gapSentence(e);
      return h('div.inc-chips', { data: { chips: 'NO_SOURCE' } },
        h('p.inc-gap', { data: { gapSentence: '', claim: g.cite ? 'gap' : null } }, h('span.inc-limits-tag', 'THE GAP'), ' ', g.text, [' ', gapSource(e)]),
        h('div.inc-chiprow', chip('NO_SOURCE'), h('span.inc-chipnote', e.protocol ? 'no action written by VESTA · the ISS procedure applies, with its limit' : 'no action written by VESTA · handed to the crew')));
    }
    const best = finding(e.nasa?.[0]?.finding_id), delta = e.cell?.nearest?.delta ?? {};
    const detail = best ? levelOf(best) : (e.cell ? `PSI test rows · ${e.cell.rows} ${e.cell.rows === 1 ? 'row' : 'rows'}` : '');
    let reasons = []; try { reasons = (e.coverage?.reasons ?? []).map(code => ui.reason(code, { q, delta, n: nInv })); } catch { reasons = []; }
    return h('div.inc-chips', { data: { chips: 'SOURCED' } },
      h('div.inc-chiprow', chip('SOURCED'), chip(e.coverage?.status ?? 'EXTRAPOLATED', { qualifier: e.cell?.qualifier ?? null }), h('span.inc-chipnote', detail)),
      h('div.inc-chiprow', h('span.inc-chipnote', `at this cabin (${cabinLine(fr)})`), reasons),
      e.limits ? h('p.inc-limits', h('span.inc-limits-tag', 'LIMITS'), ' ', e.limits) : null);
  }

  function protocolCard(id, compact = false) {
    const p = db.protocolById?.[id], f = finding(p?.finding_id);
    if (!p || !f?.quote) return null;
    const quote = f.quote;
    return h('div.inc-operation', { class: compact ? 'inc-operation-compact' : '', data: { protocol: id, claim: f.id } },
      h('p.inc-operation-label', simple && compact && id === 'PROT-07' ? `ISS procedure: ${p.action}` : 'ISS procedure, limited fallback'),
      simple && compact ? null : h('p.inc-operation-action', p.action),
      h('p.inc-operation-quote', `“${quote}”`),
      cite(f.id, { label: simple ? 'source' : undefined }),
      h('p.inc-operation-limit', p.limit));
  }

  function renderSimple() {
    const F = fired(), selected = F.find(e => e.step === S.selected), active = selected ?? F.at(-1), c = clockNow();
    N.simpleSimulation.textContent = simulated() ? 'SIMULATED TELEMETRY · SCRIPTED · NOT A PHYSICS MODEL' : 'TELEMETRY FROM A FILE · REPLAYED AS WRITTEN · NOT A PHYSICS MODEL';
    const end = ended() && !selected;
    const answer = !S.started ? 'Every scripted decision needs evidence. Run the drill to see what happens.' : !F.length ? 'Watching the cabin. No alarm has been sent.' : text.incidentAnswer(meta, S.t - S.t0, shifted(), db);
    if (N.answer.textContent !== answer) N.answer.textContent = answer;
    const key = `${active?.step}:${end}:${S.user?.name ?? ''}`;
    if (N.simpleKey !== key) {
      N.simpleKey = key;
      if (!active) replace(N.simpleStep, h('h2', 'A fire behind a spacecraft panel'),
        h('p', 'Run the scripted drill. Each decision must show its evidence, or stop at NO SOURCE.'),
        h('p.inc-simple-muted', 'This prototype supports a decision; it is not a flight procedure.'));
      else if (end) {
        const gapCount = F.filter(e => e.state === 'NO_SOURCE').length;
        replace(N.simpleStep, h('h2', 'The drill is complete'),
          h('p.inc-simple-result', gapCount ? `${gapCount} steps had no supporting finding. VESTA showed a limited ISS fallback instead of inventing an action.` : 'Every step kept its supporting finding and its limits.'),
          h('p', 'Inspect how the evidence was checked next.'));
      } else if (active.state === 'NO_SOURCE') {
        const gap = active.gap === 'no_row_no_finding'
          ? `Material coverage cannot be established: no test row or verified finding for ${materialLabel(active)} and fire prevention ${baseWords}.`
          : `No verified finding for this question ${baseWords}.`;
        replace(N.simpleStep, h('div.inc-simple-stephead', h('h2', active.label.toLowerCase()), chip('NO_SOURCE', { class: 'inc-simple-no-source' })),
          h('p.inc-simple-gap', gap, ' ', gapSource(active)),
          protocolCard(active.protocol?.id) ?? h('p', 'Hand the decision to the crew. No verified protocol line for this step.'));
      } else {
        const f = finding(active.nasa?.[0]?.finding_id), cov = active.coverage?.status ?? 'EXTRAPOLATED';
        const meaning = text.statusMeaning ? text.statusMeaning(cov) : cov === 'PROVEN' ? 'NASA tested these conditions' : 'Evidence from different or incomplete conditions';
        replace(N.simpleStep,
          h('div.inc-simple-stephead', h('h2', active.label.toLowerCase()), h('span.inc-simple-evidence', 'SOURCED · has a source')),
          h('div.inc-simple-triad',
            active.earth?.text ? h('div.inc-simple-beat.inc-simple-instinct', h('h3', active.earth.finding_id ? 'Earth practice' : 'Common assumption'), h('p', h('s', active.earth.text)), active.earth.finding_id ? cite(active.earth.finding_id, { label: 'source' }) : null) : null,
            h('div.inc-simple-beat', h('h3', 'NASA showed'), h('p.inc-simple-quote', f?.quote ? `“${f.quote}”` : 'This step cites test rows.'),
              (active.nasa ?? []).slice(0, 1).map(n => cite(n.finding_id, { label: 'source' }))),
            h('div.inc-simple-beat.inc-simple-decision', h('h3', 'VESTA decides · interpretation'), h('p', active.action ?? 'Hand the decision to the crew.'))),
          h('p.inc-simple-coverage', `${cov.replace(/_/g, ' ')} · ${meaning}`),
          active.coverage?.reasons?.includes('different_fuel_class') ? h('p.inc-simple-limit', 'This evidence is from liquid fuel droplets, a different fuel class from this scripted solid-material fire.') : null,
          active.step === 'S3' ? protocolCard('PROT-05', true) : active.step === 'S5' ? protocolCard('PROT-07', true) : null);
      }
    }
    const alarmed = F.length > 0, heard = c.heard != null && S.t - S.t0 >= c.heard;
    N.simpleClock.textContent = c.heard == null ? 'Delay has no verified source.' : !alarmed ? 'Earth has not been alerted.' : heard ? 'Earth has heard the alarm.' : `Earth hears the alarm in ${mmss(Math.max(0, c.heard - (S.t - S.t0)))}`;
    N.simpleAssumption.textContent = c.heard == null ? 'The clock stays hidden without its source.' : `Maximum-delay drill: ${meta.comm.one_way_min} minutes each way; an immediate ground response is assumed.`;
    const dotsKey = `${F.length}:${active?.step}:${end}`;
    if (N.dotsKey !== dotsKey) {
      N.dotsKey = dotsKey;
      N.simpleDots.replaceChildren(...steps.map((step, i) => {
        const e = F.find(x => x.step === step.id);
        return ui.button(String(i + 1), { disabled: !e, class: 'inc-dot-button' + (e === active && !end ? ' is-current' : ''), data: { step: step.id, fired: !!e, state: e?.state, current: e === active && !end ? 'step' : null }, title: `${step.label}${e ? ': inspect this decision' : ': not reached yet'}`, onClick: () => select(step.id) });
      }));
    }
    const label = S.playing ? 'Pause drill' : ended() ? 'Run again' : 'Run the drill';
    (N.simpleRun.querySelector('.btn-label') ?? N.simpleRun).textContent = label;
    N.simpleRun.classList.toggle('btn-primary', !ended());
    N.simpleTrust.classList.toggle('btn-primary', ended());
    N.simpleRun.dataset.action = S.playing ? 'pause' : 'play';
    N.simpleStepButton.disabled = !S.log.some(e => e.t > S.t + EPS);
  }

  function stepView(e, idx) {
    const noSrc = e.state === 'NO_SOURCE';
    const line = noSrc ? say(e.protocol ? 'no_source' : 'no_protocol') : say(e.say);
    const ack = ui.button('ACK', { small: true, action: 'ack', data: { vestaNext: '' }, onClick: acknowledge, title: 'Acknowledge and go on' });
    let tri;
    try { tri = ui.triad(e, db, { strikeAfter: S.playing && !still ? 800 : 0, limits: false, actions: noSrc ? null : [e.rule_id ? h('span.inc-rule', `rule ${e.rule_id}`) : null, ack], noSourceLine: text.NO_SOURCE_LINE }); }
    catch (err) { console.error('VESTA incident: triad failed', err); tri = h('div.triad', h('p', e.action ?? '')); }
    if (noSrc && e.protocol) {
      const original = tri.querySelector('.protocol-card');
      if (original) original.replaceWith(protocolCard(e.protocol.id));
    }
    return [
      h('div.inc-top', vesta(noSrc ? 'nosource' : 'point', line, 112),
        h('div.inc-head',
          h('div.inc-head-line', h('span.inc-stepno', `STEP ${idx + 1} of ${steps.length}`), h('span.inc-stept', tplus(e.t - S.t0)), h('span.inc-steplabel', e.label)),
          h('p.inc-question', e.question ?? ''))),
      h('div.inc-triadbox', { data: { state: e.state } }, tri),
      e.step === 'S3' ? protocolCard('PROT-05', true) : e.step === 'S5' ? protocolCard('PROT-07', true) : null,
      chipsRow(e),
      h('p.inc-statusline', text.STATUS_LINE ?? 'STATUS = EVIDENCE COVERAGE, NOT A SAFETY CERTIFICATION')];
  }

  function endCard(c) {
    const d = c.decided, n = d.steps, heardKnown = S.heard != null && S.tLast - S.t0 < S.heard;
    const counts = [['experiment', d.experiment, 'from experiments'], ['summary', d.summary, 'from NASA summaries'], ['operations', d.operations, 'from ISS operations'], ['no_source', d.no_source, 'with no source']];
    return h('div.inc-endcard', { data: { end: '' } },
      h('div.inc-end-top',
        vesta('point', null, 112),
        h('div.inc-end-title',
          h('div.inc-end-big', h('span.inc-end-n', String(n)), n === 1 ? ' decision' : ' decisions'),
          h('div.inc-end-sub', { data: { claim: heardKnown ? 'end' : null } }, heardKnown ? 'before Earth heard the alarm ' : 'made on board ',
            heardKnown ? [h('span.inc-end-max', '(maximum delay) '), cite(meta.comm.one_way_finding, { small: true })] : h('span.inc-na', '· delay: no verified source')))),
      h('div.inc-end-counts', counts.map(([k, v, label]) => h('div.inc-end-count', { data: { basis: k } }, h('b', String(v)), h('span', label)))),
      h('p.inc-end-line', { data: { endLine: '' } },
        `${n} ${n === 1 ? 'decision' : 'decisions'}${heardKnown ? ' before Earth heard the alarm (maximum delay)' : ''}. ${d.experiment} from experiments, ${d.summary} from NASA summaries, ${d.operations} from ISS operations, ${d.no_source} with no source, handled by the ISS procedure.`),
      h('div.inc-end-actions',
        ui.button('Export log', { action: 'export-json', onClick: exportLog }),
        ui.button('Run again', { action: 'play', onClick: () => { reset(); run(); } }),
        ui.button('See this cabin in Design mode', { onClick: () => ctx.go?.(`#/design?preset=${encodeURIComponent(meta.preset ?? '')}`) })));
  }

  let centreKey = null;
  function renderCentre() {
    const F = fired(), sel = (S.selected && F.find(e => e.step === S.selected)) || null;
    const active = sel ?? F[F.length - 1] ?? null;
    const mode = S.unusable ? 'unusable' : !active ? 'standby' : ended() && !sel ? 'end' : 'step';
    const key = `${mode}:${active?.step ?? ''}:${F.length}:${mode === 'standby' ? `${S.started}${S.playing}` : ''}:${S.user?.name ?? ''}`;
    if (key === centreKey) return; centreKey = key;
    wrap.dataset.mode = mode; wrap.dataset.step = mode === 'step' ? active.step : '';
    if (mode === 'unusable') {
      replace(N.stage, h('div.inc-standby', vesta('nosource', say('no_protocol'), 190),
        h('p.inc-standby-sub', 'Every frame needs its own cabin oxygen and pressure to evaluate coverage. Missing fields stay unknown; no scenario values stand in for them. Nothing runs.')));
    } else if (mode === 'standby') {
      replace(N.stage, h('div.inc-standby',
        vesta('alert', S.user ? say('user_file') : finding(meta.comm?.one_way_finding) ? say('standby') : say('standby_no_delay'), 210),
        h('div.inc-standby-title', S.user ? S.user.name : (meta.title ?? '')),
        h('p.inc-standby-sub', S.started ? `Watching ${zoneLabel(meta)}. No alarm yet.` : `A scripted fire drill. ${steps.length} possible steps; each one has to show its source or say NO SOURCE.`),
        S.playing ? null : ui.button('RUN', { primary: true, action: 'play', class: 'inc-run-big', onClick: run, title: 'Run the drill (Space)' }),
        S.heard == null && S.log.length ? h('p.inc-na', 'delay: no verified source') : null));
    } else if (mode === 'end') {
      replace(N.stage, endCard(clockNow()));
    } else {
      replace(N.stage, ...stepView(active, S.log.indexOf(active)));
    }
    N.list.replaceChildren(...(S.user && !S.log.length ? [h('li.inc-row.inc-row-note', S.unusable ? 'Nothing ran.' : 'No step of the playbook fired on this file.')] : steps.map((s, i) => {
      const e = F.find(x => x.step === s.id);
      if (!e) return null;
      const what = e.state === 'NO_SOURCE' ? (e.protocol ? `ISS procedure: ${e.protocol.action}` : firstSentence(e.action)) : firstSentence(e.action);
      return h('li.inc-row', { tabindex: '0', role: 'button', class: e === active && mode === 'step' ? 'is-active' : '', data: { step: e.step, state: e.state },
        onclick: () => select(e.step), onkeydown: ev => { if (ev.key === 'Enter') select(e.step); } },
        h('span.inc-row-n', String(i + 1)), h('span.inc-row-t', mmss(e.t - S.t0)), h('span.inc-row-l', e.label), h('span.inc-row-x', what), chip(e.state, { small: true }));
    }).filter(Boolean)));
    renderSource(mode === 'step' ? active : null);
  }

  function buildSilence() {
    const c = meta.comm ?? {}, one = finding(c.one_way_finding), two = finding(c.round_trip_finding);
    N.delays.replaceChildren(
      h('div.inc-delay', { data: { claim: one ? 'delay-one-way' : null } }, h('span.inc-delay-k', 'one way'),
        one ? [h('b', `up to ${c.one_way_min} min`), cite(c.one_way_finding, { small: true })] : h('span.inc-na', 'delay: no verified source')),
      h('p.inc-clock-assumption', `Separate spacecraft scenario. This drill assumes ${c.one_way_min} minutes per leg and an immediate ground response.`),
      h('div.inc-delay', { data: { claim: two ? 'delay-round-trip' : null } }, h('span.inc-delay-k', 'round trip'),
        two ? [h('b', `up to ${c.round_trip_min} min`), cite(c.round_trip_finding, { small: true })] : h('span.inc-na', 'delay: no verified source')));
    const W = 452, H = 96, x0 = 52, x1 = W - 70, y = 44;
    N.dot = svg('g.inc-dot', svg('circle.inc-dot-glow', { r: 10 }), svg('circle.inc-dot-core', { r: 4.5 }));
    N.back = svg('circle.inc-dot-back', { r: 4, cy: y });
    N.trail = svg('line.inc-trail', { x1: x0, y1: y, x2: x0, y2: y });
    N.geo = { x0, x1, y };
    N.trackNote = h('div.inc-track-note');
    N.sceneHost = h('div.inc-scene-host', { 'aria-hidden': 'true', data: { incidentScene: '' } });
    N.sceneAlt = h('p.inc-scene-alt');
    N.sceneLabels = h('div.inc-scene-labels', h('span', 'SHIP'), h('span', 'EARTH'));
    N.sceneDisclosure = simple ? N.simpleSimulation : h('p', 'SIMULATED TELEMETRY · SCRIPTED · NOT A PHYSICS MODEL');
    N.sceneDisclosure.classList.add('inc-scene-disclosure');
    N.sceneVisual = h('div.inc-scene-visual', N.sceneHost, N.sceneLabels, N.sceneDisclosure);
    N.track.replaceChildren(N.sceneVisual, N.sceneAlt, svg('svg.inc-track-svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'The alert travelling from the ship to Earth' },
      svg('line.inc-rail', { x1: x0, y1: y, x2: x1, y2: y }), N.trail,
      svg('path.inc-ship', { d: `M${x0 - 36} ${y - 10} L${x0 - 8} ${y} L${x0 - 36} ${y + 10} L${x0 - 28} ${y} Z` }),
      svg('circle.inc-earth-disc', { cx: x1 + 36, cy: y, r: 24 }),
      svg('path.inc-earth-arc', { d: `M${x1 + 14} ${y - 8} q 22 -9 44 0 M${x1 + 12} ${y + 5} q 24 9 48 0` }),
      svg('text.inc-track-label', { x: x0 - 22, y: H - 8, 'text-anchor': 'middle' }, 'SHIP'), svg('text.inc-track-label', { x: x1 + 36, y: H - 8, 'text-anchor': 'middle' }, 'EARTH'),
      N.back, N.dot), N.trackNote);
    N.rSent = h('b'); N.rHeard = h('b'); N.rReply = h('b');
    N.readouts.replaceChildren(
      h('div.inc-ro', h('span', 'alert sent'), N.rSent, h('i', '')),
      h('div.inc-ro', h('span', 'Earth hears'), N.rHeard, h('i', one ? '(maximum delay)' : '')),
      h('div.inc-ro', h('span', 'first reply'), N.rReply, h('i', two ? '(maximum delay)' : '')));
    N.hText = h('div.inc-houston-text'); N.hCount = h('div.inc-houston-count');
    N.houston.replaceChildren(h('div.inc-houston-head', 'HOUSTON'), N.hText, N.hCount);
    N.dSteps = h('b.inc-decided-n');
    N.dRows = {}; const row = (k, label) => h('div.inc-decided-row', { data: { basis: k } }, (N.dRows[k] = h('b')), h('span', label));
    N.decided.replaceChildren(h('div.inc-subhead', 'DECIDED WITHOUT EARTH'),
      h('div.inc-decided-grid', h('div.inc-decided-top', N.dSteps, h('span', 'steps')),
        h('div.inc-decided-rows', row('experiment', 'from experiments'), row('summary', 'from NASA summaries'), row('operations', 'from ISS operations'), row('no_source', 'no source'))));
  }
  function renderSilence() {
    const c = clockNow(), alarmed = S.log.length > 0 && S.t >= S.t0 - EPS, elapsed = S.t - S.t0;
    const g = N.geo, span = g.x1 - g.x0, heardNow = c.heard != null && alarmed && elapsed >= c.heard - EPS, replyNow = c.reply != null && alarmed && elapsed >= c.reply - EPS;
    wrap.dataset.heard = heardNow ? '1' : '0';
    if (c.progress == null || !alarmed) { N.dot.setAttribute('visibility', 'hidden'); N.back.setAttribute('visibility', 'hidden'); N.trail.setAttribute('x2', g.x0); }
    else {
      const x = g.x0 + span * c.progress;
      N.dot.setAttribute('visibility', 'visible'); N.dot.setAttribute('transform', `translate(${x.toFixed(1)} ${g.y})`); N.trail.setAttribute('x2', x.toFixed(1));
      const leg = c.reply != null ? c.reply - c.heard : 0, since = elapsed - c.heard;
      if (since >= 0 && leg > 0) { N.back.setAttribute('visibility', 'visible'); N.back.setAttribute('cx', (g.x1 - span * Math.min(1, since / leg)).toFixed(1)); }
      else N.back.setAttribute('visibility', 'hidden');
    }
    const fr = frameAt();
    if (!simple) N.sceneDisclosure.textContent = simulated() ? 'SIMULATED TELEMETRY · SCRIPTED · NOT A PHYSICS MODEL' : 'TELEMETRY FROM A FILE · REPLAYED AS WRITTEN · NOT A PHYSICS MODEL';
    N.sceneAlt.textContent = `Illustration · scripted airflow: ${typeof fr.airflow_cm_s === 'number' ? fr.airflow_cm_s > 0 ? 'scripted flow' : 'zero' : 'unknown'}. Flame: ${typeof fr.flame_visible === 'boolean' ? fr.flame_visible ? 'visible' : 'not seen' : 'unknown'}. Distances not to scale.`;
    N.trackNote.textContent = c.heard == null ? 'delay: no verified source' : !alarmed ? 'no alarm yet · nothing sent'
      : heardNow ? 'At the maximum delay, Earth hears the alarm now' : `the alert is ${Math.floor(c.progress * 100)} % of the way to Earth (maximum delay)`;
    N.trackNote.dataset.heard = heardNow ? '1' : '0';
    N.rSent.textContent = alarmed ? tplus(c.sent) : '--:--';
    N.rHeard.textContent = c.heard != null ? tplus(c.heard) : 'no verified source';
    N.rReply.textContent = c.reply != null ? tplus(c.reply) : 'no verified source';
    N.rSent.parentNode.dataset.reached = alarmed ? '1' : '0';
    N.rHeard.parentNode.dataset.missing = c.heard == null ? '1' : '0';
    N.rReply.parentNode.dataset.missing = c.reply == null ? '1' : '0';
    N.rHeard.parentNode.dataset.reached = heardNow ? '1' : '0';
    N.rReply.parentNode.dataset.reached = replyNow ? '1' : '0';
    N.hText.textContent = replyNow ? 'a first reply could arrive now' : 'No reply yet';
    N.hCount.textContent = c.reply == null ? 'delay: no verified source' : !alarmed ? 'no alert sent yet' : replyNow ? 'at the maximum delay, the round trip is complete' : `${mmss(c.to_reply)} until a reply could arrive in this maximum-delay drill`;
    N.houston.dataset.state = replyNow ? 'reply' : 'silent';
    N.decided.querySelector('.inc-subhead').textContent = S.heard == null || S.log.some(e => e.t - S.t0 >= S.heard) ? 'DECIDED ON BOARD' : 'DECIDED WITHOUT EARTH';
    N.dSteps.textContent = String(c.decided.steps);
    for (const k of Object.keys(N.dRows)) N.dRows[k].textContent = String(c.decided[k]);
  }
  function renderSource(e) {
    const f = finding(e ? (e.state === 'NO_SOURCE' ? e.protocol?.finding_id : e.nasa?.[0]?.finding_id) : null);
    if (!f) {
      N.source.replaceChildren(h('div.inc-subhead', 'SOURCE'),
        h('p.inc-source-idle', e && e.row_ids?.length ? 'This step cites PSI test rows. A row chip opens its cells.' : 'The source of the active step shows here. Any cite chip opens the full record.'));
      return;
    }
    const c = f.context ?? {}, url = /^https:\/\//.test(f.source?.url ?? '') ? f.source.url : null;
    N.source.replaceChildren(
      h('div.inc-subhead', h('span', 'SOURCE'), h('span.inc-subnote', [f.id, f.pillar].filter(Boolean).join(' · '))),
      h('div.inc-source-body', { data: { claim: 'source' } },
        h('p.inc-sentence', '“', c.before ? h('span.inc-ctx', c.before) : null, h('mark.inc-quote', f.quote ?? f.claim ?? ''), c.after ? h('span.inc-ctx', c.after) : null, '”'),
        h('div.inc-source-meta', { title: [f.source?.title, f.source?.year].filter(Boolean).join(' · ') }, [f.source?.title, f.source?.year].filter(Boolean).join(' · ')),
        h('div.inc-citerow', cite(f.id, { small: true }), url ? h('a.inc-link', { href: url, target: '_blank', rel: 'noopener' }, 'open NASA source') : null)));
  }

  function buildMarks() {
    const span = S.tMax - S.tMin || 1, at = t => `${((t - S.tMin) / span * 100).toFixed(3)}%`;
    const marks = S.log.map(e => h('i.inc-mark', { style: { left: at(e.t) }, data: { markStep: e.step, state: e.state }, title: `${tplus(e.t - S.t0)} ${e.label}` }));
    if (S.heard != null) marks.push(h('i.inc-mark-major', { style: { left: at(S.t0 + S.heard) } }, h('span', 'Earth hears')));
    if (S.reply != null) marks.push(h('i.inc-mark-major.inc-mark-last', { style: { left: at(S.t0 + S.reply) } }, h('span', 'first reply')));
    N.scrubMarks.replaceChildren(...marks);
    N.endLabel.textContent = tplus(S.tMax - S.t0);
  }
  function renderTransport() {
    const span = S.tMax - S.tMin || 1, pct = `${((S.t - S.tMin) / span * 100).toFixed(3)}%`;
    N.scrubFill.style.width = pct; N.scrubKnob.style.left = pct;
    N.now.textContent = tplus(S.t - S.t0);
    N.scrub.setAttribute('aria-valuemin', String(S.tMin)); N.scrub.setAttribute('aria-valuemax', String(S.tMax)); N.scrub.setAttribute('aria-valuenow', String(Math.round(S.t)));
    for (const m of N.scrubMarks.querySelectorAll('[data-mark-step]')) { const e = S.log.find(x => x.step === m.dataset.markStep); m.dataset.fired = e && e.t <= S.t + EPS ? '1' : '0'; }
    const next = S.log.find(e => e.t > S.t + EPS);
    N.speed.textContent = `x${next ? speedBase : speedAfter}`;
    const label = S.playing ? 'PAUSE' : 'RUN', standby = wrap.dataset.mode === 'standby';
    const lab = N.btnRun.querySelector('.btn-label') ?? N.btnRun; if (lab.textContent !== label) lab.textContent = label;
    N.btnRun.dataset.action = S.playing ? 'pause' : 'play';
    N.btnRun.classList.toggle('btn-primary', !S.playing && !standby && !ended());   // one amber button on the screen: the big RUN in standby, this one when paused
    N.btnRun.disabled = S.unusable; N.btnStep.disabled = !next || S.unusable;
    wrap.dataset.playing = S.playing ? '1' : '0';
  }

  function sceneState() {
    const f = frameAt(), F = fired(), clock = clockNow();
    let flowTime = 0;
    for (let i = 0; i < S.frames.length; i++) {
      const row = S.frames[i], end = Math.min(S.t, S.frames[i + 1]?.t ?? S.t);
      if (row.t >= S.t) break;
      flowTime += Math.max(0, end - row.t) * Math.max(0, Number(row.airflow_cm_s) || 0) / 12;
    }
    return { t: S.t, elapsed: S.t - S.t0, frame: f, flowTime, clock, alarmed: F.length > 0,
      activeStep: F.find(e => e.step === S.selected) ?? F.at(-1) ?? null };
  }
  async function mountScene() {
    try {
      const [engine, cabin] = await Promise.all([import('../scene/engine.js'), import('../scene/cabin.js')]);
      if (dead) return;
      const stage = await engine.createStage(N.sceneHost, { capture: !!ctx.capture, time: S.t, still: 'assets/scene/cabin.jpg' });
      if (dead) { stage.dispose(); return; }
      sceneStage = stage;
      await stage.use(cabin, sceneState());
      if (dead) { stage.dispose(); return; }
      N.track.dataset.sceneReady = '1';
      N.track.dataset.sceneMode = stage.mode;
      stage.set(sceneState());
    } catch (error) {
      N.track.dataset.sceneReady = '0';
      N.sceneAlt.textContent += ' The 3D illustration is unavailable; the clock and sources remain available.';
      console.warn('VESTA cabin unavailable:', error.message);
    }
  }
  function render() { if (dead) return; renderCentre(); renderLeft(); renderSilence(); renderTransport(); if (simple) renderSimple(); sceneStage?.set(sceneState()); }

  function loop(now) {
    raf = 0; if (dead || !S.playing) return;
    const dt = Math.min(0.25, Math.max(0, (now - S.lastTick) / 1000)); S.lastTick = now;
    if (now >= S.holdUntil) {
      const next = S.log.find(e => e.t > S.t + EPS);
      let t2 = S.t + dt * (next ? speedBase : speedAfter);
      if (next && t2 >= next.t) { t2 = next.t; S.holdUntil = now + holdS * 1000; S.selected = null; }
      if (t2 >= S.tEnd) { t2 = S.tEnd; S.playing = false; }
      S.t = t2;
      render();
      if (!S.playing) writeHash({ t: Math.round(S.t), paused: 1, play: null, step: null });
    }
    if (S.playing) raf = requestAnimationFrame(loop);
  }
  function run() {
    if (S.unusable) return;
    if (ctx.capture) { stepTo(+1); return; }
    if (S.t >= S.tEnd - EPS) S.t = S.tMin;
    showMsg(null);
    S.started = true; S.playing = true; S.selected = null; S.holdUntil = 0; S.lastTick = performance.now();
    writeHash({ play: 1, paused: null, t: null, step: null });
    render(); if (!raf) raf = requestAnimationFrame(loop);
  }
  function pause() {
    stop(); writeHash({ t: Math.round(S.t), paused: 1, play: null });
    centreKey = null; render();
  }
  function seek(t) {
    stop(); S.t = Math.min(Math.max(t, S.tMin), S.tMax); S.started = true; S.selected = null;
    writeHash({ t: Math.round(S.t), paused: 1, play: null, step: null });
    centreKey = null; render();
  }
  function stepTo(dir) {                                          // +1: the next step; -1: the step before the one on screen
    const F = fired(), times = S.log.map(e => e.t);
    const target = dir > 0 ? times.find(t => t > S.t + EPS) : [...times].reverse().find(t => t < (F.length ? F[F.length - 1].t : S.t) - EPS);
    if (target != null) seek(target); else if (dir < 0 && F.length) seek(S.tMin);
  }
  function acknowledge() {                                        // the frames assume the crew acts: ACK only ends the reading pause
    if (S.playing) { S.holdUntil = 0; return; }
    if (S.log.some(e => e.t > S.t + EPS)) stepTo(+1); else seek(S.tEnd);
  }
  function select(id) {
    stop(); S.selected = id;
    writeHash({ step: id, t: Math.round(S.t), paused: 1, play: null });
    centreKey = null; render();
  }
  function reset() {
    stop(); S.t = S.tMin; S.started = false; S.selected = null; S.holdUntil = 0;
    writeHash({ t: null, paused: null, play: null, step: null });
    centreKey = leftKey = null; showMsg(null); render();
  }
  const exportObject = () => decisionLog({ db, meta, frames: S.frames, log: S.log, core, source: S.user ? { kind: 'user file', file: S.user.name, frames: S.frames.length } : null });
  function exportLog() {
    const obj = exportObject(), name = `${S.user ? 'user-telemetry' : meta.id}.decision-log.json`;
    try { ui.downloadJson ? ui.downloadJson(name, obj) : ui.download(name, JSON.stringify(obj, null, 2) + '\n', 'application/json'); wrap.dataset.exported = String(obj.steps.length); }
    catch (e) { showMsg(`The log could not be downloaded: ${e.message}`, true); }
    return obj;
  }
  function showMsg(msg, isError) { N.msg.hidden = !msg; N.msg.textContent = msg ?? ''; N.msg.dataset.error = isError ? '1' : '0'; wrap.dataset.error = msg && isError ? '1' : '0'; }
  function loadText(body, name) {
    const r = parseTelemetry(body);
    if (!r.ok) { showMsg(`${r.message} ${r.detail ?? ''} Nothing runs.`.replace(/\s+/g, ' ').trim(), true); return r; }   // the replay on screen stays as it was
    stop(); load(r.frames, { name: name || 'telemetry.jsonl' });
    S.t = S.tMin; S.started = false; S.selected = null; S.holdUntil = 0;
    writeHash({ t: null, paused: null, play: null, step: null });
    showMsg(`${name || 'File'}: ${r.frames.length} ${r.frames.length === 1 ? 'frame' : 'frames'} of ${TELEMETRY_SCHEMA}; ${S.log.length} ${S.log.length === 1 ? 'step fires' : 'steps fire'}. Press RUN.`, false);
    centreKey = leftKey = null; buildMarks(); render();
    return r;
  }
  N.file.addEventListener('change', () => {
    const file = N.file.files && N.file.files[0]; if (!file) return;
    file.text().then(body => loadText(body, file.name), e => showMsg(`The file could not be read: ${e.message}`, true)).finally(() => { N.file.value = ''; });
  });
  wrap.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  wrap.addEventListener('drop', e => { const file = e.dataTransfer?.files?.[0]; if (!file) return; e.preventDefault(); file.text().then(body => loadText(body, file.name), e => showMsg(`The file could not be read: ${e.message}`, true)); });

  const scrubAt = ev => { const r = N.scrub.getBoundingClientRect(); return S.tMin + Math.min(1, Math.max(0, (ev.clientX - r.left) / (r.width || 1))) * (S.tMax - S.tMin); };
  N.scrub.addEventListener('pointerdown', ev => {
    try { N.scrub.setPointerCapture(ev.pointerId); } catch { /* not every pointer can be captured */ }
    seek(scrubAt(ev));
    const move = e => seek(scrubAt(e)), up = () => { N.scrub.removeEventListener('pointermove', move); N.scrub.removeEventListener('pointerup', up); N.scrub.removeEventListener('pointercancel', up); };
    N.scrub.addEventListener('pointermove', move); N.scrub.addEventListener('pointerup', up); N.scrub.addEventListener('pointercancel', up);
  });
  function onKey(ev) {
    if (document.querySelector('#drawer.is-open') || wrap.querySelector('dialog[open]')) return;
    const tag = ev.target?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.code === 'Space') { if (tag === 'BUTTON' || tag === 'A') return; ev.preventDefault(); S.playing ? pause() : run(); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); stepTo(+1); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); stepTo(-1); }
  }
  window.addEventListener('keydown', onKey);

  buildSilence(); buildMarks(); render(); mountScene();
  if (S.playing) { S.lastTick = performance.now(); raf = requestAnimationFrame(loop); }
  wrap.__incident = { state: S, exportObject, loadText };

  return { destroy() { dead = true; stop(); sceneStage?.dispose(); window.removeEventListener('keydown', onKey); root.textContent = ''; } };
}
