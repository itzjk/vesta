import { build as buildCabin } from '../scene/cabin.js';

const finite = (value, fallback) => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : fallback;
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export async function build(world) {
  const { db, core } = world;
  const params = { ...world.q, ...world.params };
  const scenario = db.scenario, meta = scenario?.meta, frames = scenario?.frames || [];
  const root = el('section', null, 'world-drill');
  root.setAttribute('aria-label', 'Scripted fire drill');
  const style = el('style');
  style.textContent = `
.world-drill{width:850px;max-width:calc(100vw - 38px);color:var(--ivory);font:22px/1.35 'Source Sans 3',sans-serif;background:rgba(25,23,21,.94);padding:24px 30px;box-sizing:border-box;max-height:72vh;overflow:hidden;overscroll-behavior:contain;display:flex;flex-direction:column;height:72vh}
.world-drill[data-shot=silence]{height:auto}.world-drill>h2,.world-drill>p,.world-drill>.drill-controls,.world-drill>.drill-truth{flex-shrink:0}.world-drill .drill-body{min-height:0;overflow:auto;overscroll-behavior:contain;flex:1}.world-drill .drill-truth{padding-top:10px;border-top:1px solid var(--line);font-size:18px;color:var(--ivory-dim)}.world-drill .drill-truth p{font-size:18px;margin:0;line-height:1.3}.world-drill h2{font:600 42px/1.05 'Barlow Condensed',sans-serif;margin:0 0 12px;max-width:30ch}.world-drill h3{font:600 19px/1.2 'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase;margin:0 0 12px}.world-drill p{margin:0 0 14px}.world-drill small{display:block;font-size:18px;color:var(--ivory-dim)}
.world-drill .drill-triad{display:grid;grid-template-columns:.7fr 1.2fr 1fr;gap:24px;margin:22px 0}.world-drill .drill-instinct{color:var(--rust-text)}.world-drill .drill-quote{color:var(--ivory)}.world-drill .drill-decision{color:var(--amber)}.world-drill .drill-beat{transform-origin:left top}.world-drill .drill-beat p{font-size:22px}.world-drill .drill-controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:20px;border-top:1px solid var(--line);padding-top:14px}.world-drill button{font:inherit;color:inherit;border:0;border-bottom:1px solid var(--line-strong);border-radius:0;background:none;min-height:44px;padding:7px 12px;cursor:pointer}.world-drill button[data-drill=run]{background:var(--rust);color:var(--ivory)}.world-drill button:focus-visible{outline:2px solid var(--amber);outline-offset:3px}.world-drill button:disabled{opacity:.45;cursor:default}.world-drill .drill-clock{font-variant-numeric:tabular-nums;color:var(--earth);margin-top:12px}.world-drill .drill-limit{font-size:18px;color:var(--ivory-dim)}.world-drill .drill-disclosure{font-size:18px;line-height:1.3;color:var(--ivory-dim);margin-top:16px}.world-drill .drill-summary{margin:20px 0}.world-drill .drill-summary p{display:flex;gap:18px;border-bottom:1px solid var(--line);padding-bottom:9px}.world-drill .drill-summary b{color:var(--amber);min-width:1.2em}.world-drill .drill-time{font-size:18px;color:var(--ivory-dim);margin-left:auto}
@media(max-width:759px){.world-drill{width:352px;max-width:calc(100vw - 24px);height:57vh;max-height:57vh;padding:18px 20px;font-size:18px}.world-drill h2{font-size:30px}.world-drill .drill-triad{display:block;margin:18px 0}.world-drill .drill-beat{margin-bottom:22px}.world-drill .drill-beat p{font-size:18px}.world-drill .drill-controls{background:var(--bg-1);padding:8px 0;margin-top:8px}.world-drill small,.world-drill .drill-disclosure,.world-drill .drill-limit{font-size:18px}.world-drill .drill-time{margin-left:0}}
`;
  root.append(style);
  const title = el('h2'), answer = el('p'), content = el('div'), clockLine = el('p', null, 'drill-clock');
  const assumption = el('p', null, 'drill-limit');
  const controls = el('div', null, 'drill-controls');
  const button = (name, label, fn) => {
    const b = el('button', label); b.type = 'button'; b.dataset.drill = name; b.onclick = fn; controls.append(b); return b;
  };
  const runButton = button('run', 'Run the drill', () => playing ? pause() : run());
  const stepButton = button('step', 'Next decision', () => next());
  button('reset', 'Restart', () => reset());
  const silenceButton = button('silence', 'The Silence', () => { outside = !outside; autoOutside = false; sync(); write(); world.invalidate?.(); });
  const timeLabel = el('span', null, 'drill-time'); controls.append(timeLabel);
  const body = el('div', null, 'drill-body');
  body.append(content, clockLine, assumption, el('small', core.text.SCOPE));
  const truth = el('footer', null, 'drill-truth');
  truth.append(el('p', 'SIMULATED TELEMETRY · SCRIPTED · NOT A PHYSICS MODEL'),
    el('p', core.text.STATUS_LINE), el('p', 'Low-momentum flame illustration only.'));
  root.append(title, answer, controls, body, truth);
  if (!meta || !frames.length || !db.playbook?.steps?.length) {
    title.textContent = 'The scripted drill is unavailable.';
    runButton.disabled = stepButton.disabled = true;
    const handle = world.hologram(root, { at: [0, 0.5, 0], face: true });
    return { enter() { handle.open?.(); }, leave() { handle.close?.(); }, update() {}, holograms: () => [handle] };
  }
  const log = core.officer.run(frames, db, meta);
  const shifted = log.map(entry => ({ ...entry, t: entry.t - (log[0]?.t || 0) }));
  const t0 = log[0]?.t || 0, start = frames[0].t, last = log.at(-1)?.t ?? frames.at(-1).t;
  const clockBase = core.clock.clock(meta, 0, shifted, db);
  const end = Math.max(last, clockBase.heard === null ? last : t0 + clockBase.heard);
  const speed = Math.max(1, finite(params?.speed, meta.playback?.speed || 1));
  const hold = Math.max(0, finite(params?.hold, meta.playback?.hold_s || 0));
  const capture = !!world.capture || params.capture === '1' || params.capture === 1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let time = clamp(finite(params?.t, start), start, end), active = false, playing = false;
  let outside = params?.shot === 'silence', autoOutside = false, silenceShown = false;
  let previousTick = null, beatAge = 0, currentKey = '', held = 0, scenery = null, disposed = false;
  const listeners = [];
  const h = world.hologram(root, { at: [1.3, 0.65, 0.7], face: true, width: 850 });
  const phrase = (text, id) => id ? world.cite(String(text), id) : el('span', text);
  const nowClock = () => core.clock.clock(meta, time - t0, shifted, db);
  const fired = () => log.filter(entry => entry.t <= time);
  const frame = () => frames.findLast(entry => entry.t <= time) || frames[0];
  const write = () => world.setQ?.({ t: Math.round(time * 1000) / 1000, paused: playing ? null : '1', play: playing ? '1' : null, shot: outside ? 'silence' : null }, { replace: true, render: false });
  const setTime = value => { time = clamp(value, start, end); beatAge = 0; held = hold; currentKey = ''; outside = false; sync(); write(); };
  function pause() { playing = false; sync(); write(); }
  function run() { if (time >= end) reset(); playing = true; previousTick = null; sync(); write(); }
  function next() { playing = false; const entry = log.find(item => item.t > time); setTime(entry ? entry.t : end); }
  function reset() { playing = false; silenceShown = false; autoOutside = false; setTime(start); }
  function beat(label, value, className, id) {
    const section = el('section', null, `drill-beat ${className}`);
    section.append(el('h3', label));
    const p = el('p'); p.append(phrase(value, id)); section.append(p); return section;
  }
  function renderContent(entry, done) {
    content.replaceChildren();
    if (outside) {
      title.textContent = 'The Silence';
      root.dataset.state = 'silence';
      return;
    }
    title.textContent = done ? 'The on-board decisions are in.' : (innerWidth < 760 ? entry?.label.toLowerCase() : entry?.question) || meta.title;
    if (done) {
      const counts = nowClock().decided, summary = el('div', null, 'drill-summary');
      for (const key of ['experiment', 'summary', 'operations', 'no_source']) {
        const p = el('p'); p.append(el('b', String(counts[key])), el('span', core.text.basis(key))); summary.append(p);
      }
      content.append(summary, el('p', core.text.NO_SOURCE_LINE, 'drill-limit'));
      const trust = el('button', 'Can you trust it?'); trust.type = 'button'; trust.onclick = () => world.go('#/engine'); content.append(trust);
      return;
    }
    if (!entry) { content.append(el('p', db.lines?.lines?.standby || db.lines?.standby)); return; }
    root.dataset.state = entry.state;
    if (entry.state === 'NO_SOURCE') {
      content.append(el('p', core.text.NO_SOURCE_LINE, 'drill-decision'));
      content.append(el('p', core.text.reasonSentence(entry.gap, { n: db.investigations.length }), 'drill-limit'));
      const p = entry.protocol, finding = p && db.findingById[p.finding_id];
      if (finding) {
        content.append(beat('ISS procedure, conditional fallback', p.action, 'drill-decision', p.finding_id));
        if (finding.quote) content.append(beat('NASA wrote', `“${finding.quote}”`, 'drill-quote', finding.id));
        content.append(el('p', p.limit, 'drill-limit'));
      } else content.append(el('p', core.text.NO_PROTOCOL_LINE));
      return;
    }
    const triad = el('div', null, 'drill-triad');
    if (entry.earth?.text) {
      const instinct = beat(entry.earth.finding_id ? 'Earth practice' : 'Earth instinct', entry.earth.text, 'drill-instinct', entry.earth.finding_id);
      instinct.querySelector('p').style.textDecoration = 'line-through'; triad.append(instinct);
    }
    const finding = db.findingById[entry.nasa?.[0]?.finding_id];
    if (finding?.quote) triad.append(beat('NASA showed', `“${finding.quote}”`, 'drill-quote', finding.id));
    else {
      const rows = beat('NASA recorded', '', 'drill-quote');
      for (const id of entry.row_ids || []) { const r = db.testById[id]; if (r) rows.append(phrase(`${r.fuel || r.psi_id}`, id)); }
      triad.append(rows);
    }
    triad.append(beat('VESTA decides, interpretation', entry.action, 'drill-decision'));
    content.append(triad);
    if (entry.coverage) content.append(el('p', `${core.text.status(entry.coverage.status)} · ${core.text.statusMeaning(entry.coverage.status)}`, 'drill-limit'));
    if (entry.limits) content.append(el('p', entry.limits, 'drill-limit'));
    for (const id of entry.step === 'S3' ? ['PROT-05'] : entry.step === 'S5' ? ['PROT-07'] : []) {
      const protocol = db.protocolById[id];
      if (protocol && db.findingById[protocol.finding_id]) {
        const p = el('p', null, 'drill-limit'); p.append(phrase(protocol.action, protocol.finding_id)); content.append(p, el('p', protocol.limit, 'drill-limit'));
      }
    }
  }
  function sync() {
    const entries = fired(), entry = entries.at(-1), done = time >= end, clock = nowClock();
    const key = `${entry?.step || 'standby'}:${done}:${outside}`;
    if (key !== currentKey) { currentKey = key; beatAge = capture || reduced ? 10 : 0; renderContent(entry, done); }
    const computed = core.text.incidentAnswer(meta, time - t0, shifted, db);
    if (answer.textContent !== computed) answer.textContent = computed;
    const hearing = clock.heard === null ? 'Delay has no verified source.' : !entries.length ? 'Earth has not been alerted.' : time - t0 >= clock.heard ? 'Earth has heard the alarm.' : `Earth hears the alarm in ${core.clock.mmss(Math.max(0, clock.heard - (time - t0)), true)}`;
    if (clockLine.dataset.text !== hearing) { clockLine.dataset.text = hearing; clockLine.replaceChildren(phrase(hearing, clock.heard === null ? null : meta.comm.one_way_finding)); }
    assumption.textContent = meta.comm.assumes;
    timeLabel.textContent = core.clock.mmss(time - t0);
    runButton.textContent = playing ? 'Pause drill' : done ? 'Run again' : 'Run the drill';
    runButton.dataset.action = playing ? 'pause' : 'play';
    stepButton.disabled = done;
    silenceButton.disabled = !entries.length || clock.heard === null;
    silenceButton.textContent = outside ? 'Return to cabin' : 'The Silence';
    root.dataset.shot = outside ? 'silence' : 'cabin';
  }
  const ctx = world.stage.context || world.stage.ctx || world.context || world.stage;
  if (ctx?.scene && world.vesta) {
    scenery = await buildCabin({ ...ctx, THREE: world.THREE, vesta: world.vesta, world: true });
    ctx.scene.add(scenery.group); scenery.group.visible = false;
  }
  const camera = t => {
    const mobile = innerWidth < 760;
    return outside ? { position: [0, 1.3, mobile ? 16 : 10], target: [0, 0, 0], fov: 35 }
      : { position: [0.22 + (reduced ? 0 : Math.sin(t * 0.22) * 0.18), 0.8, mobile ? 13.5 : 8.5], target: [0.2, 0.65, 0], fov: 35 };
  };
  function keydown(event) {
    if (!active || event.target.closest('button,a,input,textarea,select,[contenteditable]')) return;
    if (event.code === 'Space') { event.preventDefault(); event.stopImmediatePropagation(); playing ? pause() : run(); }
  }
  document.addEventListener('keydown', keydown, true); listeners.push(() => document.removeEventListener('keydown', keydown, true));
  sync();
  return {
    camera,
    enter() {
      active = true; previousTick = null; if (scenery) scenery.group.visible = true; h.open?.();
      if (!capture && params?.play === '1' && params?.paused == null) run();
    },
    leave() { active = false; world.vesta.group.visible = true; world.setCamera?.(null); playing = false; previousTick = null; h.close?.(); if (scenery) scenery.group.visible = false; },
    update(t) {
      if (!active || disposed) return;
      const delta = previousTick === null ? 0 : clamp(t - previousTick, 0, 0.1); previousTick = t;
      beatAge += delta;
      if (playing && !capture) {
        if (held > 0) held = Math.max(0, held - delta);
        else if (autoOutside) {
          const upcoming = log.find(entry => entry.t > time);
          time = Math.min(upcoming ? upcoming.t - 0.000001 : end, time + delta * speed);
        } else {
          const proposed = time + delta * (time >= last ? meta.playback.speed_after_last_step : speed);
          const upcoming = log.find(entry => entry.t > time && entry.t <= proposed);
          time = upcoming ? upcoming.t : Math.min(end, proposed);
          if (upcoming) { held = upcoming === log[0] && !silenceShown ? Math.max(hold, 3.5) : hold; beatAge = 0; }
        }
        if (!silenceShown && fired().length === 1 && beatAge > Math.max(hold, 3)) { outside = true; autoOutside = true; silenceShown = true; beatAge = 0; }
        if (autoOutside && beatAge > 3) { outside = false; autoOutside = false; beatAge = 0; }
        if (time >= end) playing = false;
      }
      sync();
      const beats = content.querySelectorAll('.drill-beat');
      beats.forEach((node, i) => {
        const phase = capture || reduced ? 1 : clamp((beatAge - i * 0.28) / 0.5, 0, 1);
        node.style.opacity = String(phase);
        node.style.transform = `perspective(900px) rotateY(${(1 - phase) * -12}deg) scaleX(${0.94 + phase * 0.06})`;
      });
      if (innerWidth < 760) {
        const cameraNow = world.camera || world.stage.camera;
        cameraNow.updateMatrixWorld();
        const framing = camera(reduced ? 0 : t), projectedCamera = cameraNow.clone();
        projectedCamera.position.fromArray(framing.position).add(new world.THREE.Vector3(...(world.origin || [0, 0, 0])));
        projectedCamera.fov = framing.fov; projectedCamera.updateProjectionMatrix();
        projectedCamera.lookAt(new world.THREE.Vector3(...framing.target).add(new world.THREE.Vector3(...(world.origin || [0, 0, 0]))));
        projectedCamera.updateMatrixWorld();
        const distance = 10, vector = new world.THREE.Vector3(0, -0.24, -1).unproject(projectedCamera);
        const direction = vector.sub(projectedCamera.position).normalize();
        const at = projectedCamera.position.clone().addScaledVector(direction, distance);
        h.set?.({ at: at.toArray().map((value, index) => value - (world.origin?.[index] || 0)), keepPosition: true });
      }
      if (innerWidth >= 760) {
        const at = outside ? [0, 1.7, 0.7] : [1.3, 0.65, 0.7];
        h.set?.({ at, keepPosition: false });
      }
      const entries = fired(), entry = entries.at(-1), frameNow = frame();
      const alarmThreshold = db.playbook.steps[0]?.when.find(item => item[0] === 'smoke_pct_alarm')?.[2];
      scenery?.update(reduced ? 0 : t, { frame: frameNow, activeStep: entry, t: time, elapsed: time - t0, flowTime: reduced ? time : t, clock: nowClock(), alarmed: entries.length > 0, alarmThreshold, shot: outside ? 'silence' : 'cabin', officerScale: innerWidth < 760 ? 1.6 : 2.1, officerAt: innerWidth < 760 ? { x: 0, y: 3, z: 0 } : { x: -2.2, y: 0.55, z: 0.65 } });
    },
    holograms: () => [h],
    dispose() { disposed = true; listeners.forEach(fn => fn()); h.dispose?.(); scenery?.group.removeFromParent(); scenery?.dispose?.(); root.remove(); },
  };
}
