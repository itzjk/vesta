import { balanceWorldLight } from '../scene/materials.js';
import { build as buildCabin } from '../scene/cabin.js';
import { build as buildDrillThread } from './drill-thread.js';
import { build as buildDebrief } from './debrief.js';
import { polishDecisionContent, ensureInformationPolishStyles } from './information-polish.js';

const finite = (value, fallback) => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : fallback;
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export async function build(world) {
  ensureInformationPolishStyles();
  world.host.classList.add('information-polish');
  const { db, core } = world;
  const params = { ...world.q, ...world.params };
  const scenario = db.scenario, meta = scenario?.meta, frames = scenario?.frames || [];
  const root = el('section', null, 'world-drill');
  root.setAttribute('aria-label', 'Scripted fire drill');
  const style = el('style');
  style.textContent = `
.drill-hud[hidden],.drill-marker[hidden]{display:none!important}
.drill-hud{position:absolute;inset:0;pointer-events:none;color:var(--ivory);font:18px/1.35 var(--font);z-index:2}
.world-host[data-hologram-open=true] .drill-hud .drill-notice{top:68px;bottom:auto}html[data-tour="running"] .drill-hud{visibility:hidden;pointer-events:none}.drill-hud .drill-answer{position:absolute;bottom:165px;left:50%;transform:translateX(-50%);margin:0;max-width:calc(100% - 100px);white-space:nowrap;font-size:20px;background:rgba(18,16,14,.84);padding:5px 12px;text-align:center}
.world-drill .drill-controls{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:0 0 16px;pointer-events:auto}.world-drill .drill-controls button{padding:6px 10px}.world-drill .drill-time{font-size:14px;color:var(--ivory-dim)}
.drill-hud button{border:0;background:rgba(18,16,14,.9);color:var(--ivory);font:18px/1 var(--font);min-width:44px;min-height:44px;padding:8px 12px;cursor:pointer;touch-action:manipulation}
.drill-hud button:disabled{opacity:.35;cursor:default}.drill-hud button:focus-visible{outline:2px solid var(--amber);outline-offset:4px}
.drill-hud button[data-drill=run]{background:var(--rust-deep)}.drill-hud .drill-time{font:14px/1 var(--mono);padding:0 6px;color:var(--ivory-dim)}
.drill-hud .drill-notice{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);font:14px/1.35 var(--font);text-align:center;max-width:calc(100% - 36px);width:max-content;color:var(--ivory-dim);margin:0;background:rgba(18,16,14,.84);padding:3px 8px}
.drill-hud .drill-marker{position:absolute;transform:translate(-50%,-50%);border-radius:50%;min-width:44px;width:44px;height:44px;padding:0;color:var(--amber);background:rgba(18,16,14,.5);box-shadow:0 0 18px #e0a45828;font-size:24px;pointer-events:auto}
.drill-marker[aria-expanded=true]{outline:1px solid var(--amber)}
.world-drill{width:480px;color:var(--ivory);font:18px/1.4 var(--font);padding:18px 24px;box-sizing:border-box;overflow:auto;background:rgba(18,16,14,.96)}
.world-drill .drill-inner{display:flex;flex-direction:column;min-height:0}.world-drill .drill-body{min-height:0;overflow:visible;overscroll-behavior:contain}
.world-drill .drill-heading{display:flex;align-items:start;justify-content:space-between;gap:18px;flex-shrink:0}.world-drill h2{font:600 28px/1.1 var(--display);margin:0 0 12px}.world-drill h3{font:600 19px/1.2 var(--display);margin:0 0 8px}.world-drill p,.world-drill small{font-size:18px;line-height:1.4;margin:0 0 12px}.world-drill .drill-dismiss{min-width:44px;flex-shrink:0;padding:0 8px;min-height:44px}
.world-drill .drill-triad{display:grid;grid-template-columns:.8fr 1.2fr 1fr;gap:24px}.world-drill .drill-instinct{color:var(--rust-text)}.world-drill .drill-decision{color:var(--amber)}.world-drill .drill-limit,.world-drill .drill-truth{color:var(--ivory-dim)}.world-drill .drill-summary{display:flex;gap:18px;flex-wrap:wrap}.world-drill .drill-summary b{color:var(--amber);padding-right:8px}.world-drill .drill-truth{padding-top:12px}.world-drill .drill-truth p{margin:0;font-size:18px}
@media(max-width:759px){.drill-hud .drill-answer{bottom:198px;font-size:18px;max-width:calc(100% - 24px);padding:5px 8px}.drill-hud button{padding:8px 10px}.drill-hud .drill-notice{bottom:88px;width:calc(100% - 40px);font-size:14px}.world-drill{width:354px;padding:14px 18px;max-height:42vh!important}.world-drill h2{font-size:25px}.world-drill .drill-triad{display:block}.world-drill .drill-beat{margin-bottom:20px}}
`;
  const hud = el('section', null, 'drill-hud');
  hud.dataset.stationUi = 'drill'; hud.hidden = true;
  hud.setAttribute('aria-label', 'Scripted drill controls');
  const title = el('h2'), answer = el('p', null, 'drill-answer'), content = el('div'), clockLine = el('p', null, 'drill-clock');
  answer.setAttribute('role', 'status'); answer.setAttribute('aria-live', 'polite');
  const assumption = el('p', null, 'drill-limit');
  const controls = el('div', null, 'drill-controls');
  const button = (name, label, fn, parent = controls) => {
    const b = el('button', label); b.type = 'button'; b.dataset.drill = name; b.onclick = fn; parent.append(b); return b;
  };
  const runButton = button('run', 'Run', () => playing ? pause() : run());
  const stepButton = button('step', 'Next', () => next());
  stepButton.setAttribute('aria-label', 'Next decision');
  const resetButton = button('reset', 'Restart', () => reset()); resetButton.setAttribute('aria-label', 'Restart drill'); resetButton.title = 'Restart drill';
  const timeLabel = el('span', null, 'drill-time'); controls.append(timeLabel);
  let silenceButton = button('silence', '◌', () => { closePanel(); outside = !outside; autoOutside = false; sync(); write(); world.invalidate?.(); }, hud);
  silenceButton.className = 'drill-marker'; silenceButton.title = 'The Silence';
  let evidenceMarker = button('evidence', '△', () => togglePanel(), hud);
  evidenceMarker.className = 'drill-marker'; evidenceMarker.title = 'Decision evidence'; evidenceMarker.setAttribute('aria-label', 'Open decision evidence');
  const body = el('div', null, 'drill-body');
  body.append(content, clockLine, assumption, el('small', core.text.SCOPE));
  const truth = el('footer', null, 'drill-truth');
  truth.append(el('p', 'SIMULATED TELEMETRY · SCRIPTED · NOT A PHYSICS MODEL'),
    el('p', core.text.STATUS_LINE), el('p', 'Low-momentum flame illustration only.'));
  const heading = el('header', null, 'drill-heading');
  const closeButton = el('button', '×', 'drill-dismiss'); closeButton.type = 'button'; closeButton.setAttribute('aria-label', 'Close decision evidence'); closeButton.onclick = () => closePanel(true);
  heading.append(title, closeButton);
  const inner = el('div', null, 'drill-inner'); inner.append(heading, controls, body); body.append(truth);
  root.append(inner); hud.append(style);
  const notice = el('p', null, 'drill-notice');
  notice.append(document.createTextNode('SIMULATED TELEMETRY · SCRIPTED · NOT A PHYSICS MODEL'), el('br'), document.createTextNode('Low-momentum flame illustration only.'));
  if (!world.answer) hud.append(answer); hud.append(notice); (world.overlay || world.host).append(hud);
  if (!meta || !frames.length || !db.playbook?.steps?.length) {
    title.textContent = 'The scripted drill is unavailable.';
    runButton.disabled = stepButton.disabled = true;
    hud.append(style); answer.textContent = title.textContent; world.answer?.(answer.textContent); runButton.disabled = stepButton.disabled = resetButton.disabled = silenceButton.disabled = evidenceMarker.disabled = true;
    return { enter() { hud.hidden = false; }, leave() { hud.hidden = true; }, update() {}, holograms: () => [], dispose() { hud.remove(); } };
  }
  const log = core.officer.run(frames, db, meta);
  const thread = buildDrillThread(world);
  const debrief = buildDebrief({ ...world, onReplay: () => { reset(); world.overlay.querySelector('[data-station-action=next-decision]')?.focus({ preventScroll: true }); } });
  hud.append(thread.element); body.insertBefore(debrief.element, truth);
  const timeline = el('details', null, 'drill-timeline'), timelineTitle = el('summary', 'Eight decision points'), timelineList = el('ol');
  const timelineButtons = log.map((entry, i) => {
    const item = el('li'), jump = el('button', `${i + 1}. ${entry.label}`); jump.type = 'button'; jump.dataset.drillDecision = entry.step;
    jump.onclick = () => { playing = false; setTime(entry.t); if (!panelOpen) togglePanel(); };
    item.append(jump); timelineList.append(item); return jump;
  });
  timeline.append(timelineTitle, timelineList); inner.insertBefore(timeline, body);
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
  let panelOpen = false;
  const h = world.hologram(root, { at: [0, -1, 0.7], face: true, width: 480, dock: 'right', marker: false, phoneRatio: .48 });
  if (world.marker) {
    const localPoint = point => new world.THREE.Vector3(...point).add(new world.THREE.Vector3(...(world.origin || [0, 0, 0])));
    const evidence = world.marker({ at: () => localPoint([2.05, .7, -.6]), label: 'Open decision evidence', onClick: () => togglePanel() });
    const silence = world.marker({ at: () => localPoint(outside ? [-2.5, .25, 0] : [-2.55, 1.65, -1.15]), label: 'The Silence', onClick: () => {
      if (silenceButton.disabled) return;
      closePanel(); outside = !outside; autoOutside = false; sync(); write(); world.invalidate?.();
    } });
    evidenceMarker.remove(); silenceButton.remove(); evidenceMarker = evidence.element; silenceButton = silence.element;
    evidenceMarker.dataset.drill = 'evidence'; silenceButton.dataset.drill = 'silence';
    listeners.push(() => evidence.dispose(), () => silence.dispose());
  }

  function closePanel(focus = false) { panelOpen = false; h.close?.(); evidenceMarker.setAttribute('aria-expanded', 'false'); if (focus) evidenceMarker.focus({ preventScroll: true }); }
  // focus: true when a person opens the panel (focus moves to its close button). The station opens it by itself on
  // arrival with focus: false, so the arrow keys keep travelling between stations instead of stopping on a button.
  function togglePanel(focus = true) {
    if (panelOpen && h.target > 0) { closePanel(true); return; }
    world.closeSource?.(); panelOpen = true; renderContent(fired().at(-1), time >= end); h.toggle ? h.toggle() : h.open?.();
    evidenceMarker.setAttribute('aria-expanded', 'true');
    if (focus) closeButton.focus({ preventScroll: true });
    world.invalidate?.();
  }
  const phrase = (text, id) => id ? world.cite(String(text), id) : el('span', text);
  const nowClock = () => core.clock.clock(meta, time - t0, shifted, db);
  const fired = () => log.filter(entry => entry.t <= time);
  const frame = () => frames.findLast(entry => entry.t <= time) || frames[0];
  const write = () => world.setQ?.({ t: Math.round(time * 1000) / 1000, paused: playing ? null : '1', play: playing ? '1' : null, shot: outside ? 'silence' : null }, { replace: true, render: false });
  const setTime = value => { autoOutside = false; time = clamp(value, start, end); beatAge = 0; held = hold; currentKey = ''; outside = false; sync(); write(); world.invalidate?.(); };
  function pause() { closePanel(); playing = false; sync(); write(); }
  function run() { closePanel(); if (time >= end) reset(); playing = true; previousTick = null; sync(); write(); }
  function next() { playing = false; const entry = log.find(item => item.t > time); setTime(entry ? entry.t : end); }
  function reset() { playing = false; silenceShown = false; autoOutside = false; setTime(start); }
  function beat(label, value, className, id) {
    const section = el('section', null, `drill-beat ${className}`);
    section.append(el('h3', label));
    const p = el('p'); p.append(phrase(value, id)); section.append(p); return section;
  }
  function renderContent(entry, done) {
    renderDecisionContent(entry, done);
    polishDecisionContent(content, { entry, done, outside });
  }
  function renderDecisionContent(entry, done) {
    content.replaceChildren();
    if (outside) {
      title.textContent = 'The Silence';
      root.dataset.state = 'silence';
      return;
    }
    title.textContent = done ? 'The on-board decisions are in.' : (innerWidth < 760 ? entry?.label.toLowerCase() : entry?.question) || meta.title;
    if (done) {
      return;
    }
    if (!entry) { content.append(el('p', 'Start at the alarm, then advance through eight on-board decisions. Each step shows the NASA evidence, VESTA interpretation and what remains unsupported.'), el('p', db.lines?.lines?.standby || db.lines?.standby)); return; }
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
    thread.update({ t: time, shot: outside ? 'silence' : null }); debrief.update({ t: time, shot: outside ? 'silence' : null });
    clockLine.hidden = assumption.hidden = done;
    const key = `${entry?.step || 'standby'}:${done}:${outside}`;
    if (key !== currentKey) { currentKey = key; beatAge = capture || reduced ? 10 : 0; renderContent(entry, done); }
    const coverage = entry?.state === 'NO_SOURCE' ? 'NO_SOURCE' : entry?.coverage?.status || entry?.state || 'SIMULATED';
    const computed = outside ? `The Silence${clock.heard === null ? '' : ' · ' + core.clock.mmss(Math.max(0, clock.heard - (time - t0)), true)}` : done ? `${core.clock.mmss(time - t0)} · ${clock.decided.steps} ${core.text.status('SIMULATED')}` : `${entry?.label || meta.zone_label} · ${core.text.status(coverage)}`;
    if (answer.textContent !== computed) { answer.textContent = computed; world.answer?.(computed); }
    const hearing = clock.heard === null ? 'Delay has no verified source.' : !entries.length ? 'Earth has not been alerted.' : time - t0 >= clock.heard ? 'Earth has heard the alarm.' : `Earth hears the alarm in ${core.clock.mmss(Math.max(0, clock.heard - (time - t0)), true)}`;
    if (clockLine.dataset.text !== hearing) { clockLine.dataset.text = hearing; clockLine.replaceChildren(phrase(hearing, clock.heard === null ? null : meta.comm.one_way_finding)); }
    assumption.textContent = meta.comm.assumes;
    timeLabel.textContent = core.clock.mmss(time - t0);
    runButton.textContent = playing ? 'Pause' : done ? 'Replay' : 'Run';
    runButton.setAttribute('aria-label', playing ? 'Pause drill' : done ? 'Run drill again' : 'Run the drill');
    runButton.dataset.action = playing ? 'pause' : 'play';
    stepButton.disabled = done;
    stepButton.textContent = !entries.length ? 'Start drill' : done ? 'Complete' : 'Next decision';
    timelineTitle.textContent = `${entries.length} of ${log.length} decisions · jump to a step`;
    timelineButtons.forEach((button, i) => button.setAttribute('aria-current', log[i].step === entry?.step ? 'step' : 'false'));
    silenceButton.disabled = !entries.length || clock.heard === null;
    silenceButton.setAttribute('aria-label', outside ? 'Return to cabin' : 'The Silence'); silenceButton.title = outside ? 'Return to cabin' : 'The Silence';
    if (!world.marker) silenceButton.textContent = outside ? '↵' : '◌';
    hud.dataset.shot = outside ? 'silence' : 'cabin'; hud.dataset.panelOpen = String(panelOpen && h.target > 0);
    hud.dataset.time = String(time); hud.dataset.step = entry?.step || 'standby';
    evidenceMarker.style.visibility = outside ? 'hidden' : '';
    root.dataset.shot = outside ? 'silence' : 'cabin';
  }
  const ctx = world.stage.context || world.stage.ctx || world.context || world.stage;
  if (ctx?.scene && world.vesta) {
    scenery = await buildCabin({ ...ctx, THREE: world.THREE, vesta: world.vesta, world: true });
    ctx.scene.add(scenery.group); scenery.group.visible = false;
  }
  const balanceLight = balanceWorldLight(world, 0);
  const camera = t => {
    const mobile = innerWidth < 760;
    return outside ? { position: [0, 1.3, mobile ? 27 : 10], target: [0, 0, 0], fov: mobile ? 44 : 35 }
      : { position: [0.22 + (reduced ? 0 : Math.sin(t * 0.22) * 0.18), 0.8, mobile ? 13.5 : 8.5], target: [0.2, 0.65, 0], fov: 35 };
  };
  function keydown(event) {
    if (!active) return;
    if (event.key === 'Escape' && panelOpen) { closePanel(true); return; }
    if (event.target.closest('button,a,input,textarea,select,summary,[contenteditable]')) return;
    if (event.code === 'Space') { event.preventDefault(); event.stopImmediatePropagation(); playing ? pause() : run(); }
  }
  document.addEventListener('keydown', keydown, true); listeners.push(() => document.removeEventListener('keydown', keydown, true));
  const outsideTap = event => { if (active && panelOpen && !root.contains(event.target) && !hud.contains(event.target) && !evidenceMarker.contains(event.target) && !silenceButton.contains(event.target) && !event.target.closest('.wc-source,.world-sheet-toggle,.world-guide')) closePanel(); };
  const citation = event => { if (active && event.detail?.open) closePanel(); };
  document.addEventListener('pointerdown', outsideTap); window.addEventListener('vesta:cite', citation);
  listeners.push(() => document.removeEventListener('pointerdown', outsideTap), () => window.removeEventListener('vesta:cite', citation));
  sync();
  return {
    camera,
    actions: () => [
      { id: 'next-decision', label: () => time >= end ? 'Drill complete' : fired().length ? 'Next decision' : 'Start drill', primary: true, disabled: () => time >= end, run: () => { next(); if (!panelOpen || !h.target) { panelOpen = false; togglePanel(); } } },
      { id: 'play-drill', label: () => playing ? 'Pause timeline' : time >= end ? 'Replay timeline' : 'Play timeline', run: () => playing ? pause() : run() },
      { id: 'decision-evidence', label: 'Decision evidence', expanded: () => panelOpen && h.target > 0, run: () => togglePanel() },
      { id: 'restart-drill', label: 'Restart', run: () => reset() }
    ],
    ready() { if (!panelOpen) togglePanel(false); },
    enter() {
      balanceLight(true); active = true; hud.hidden = false; world.answer?.(answer.textContent); previousTick = null; if (scenery) scenery.group.visible = true; closePanel();
      if (!capture && params?.play === '1' && params?.paused == null) run();
    },
    leave() { balanceLight(false); delete world.camera.userData.focusDistance; delete world.camera.userData.aperture; active = false; hud.hidden = true; closePanel(); world.vesta.group.visible = true; world.setCamera?.(null); playing = false; previousTick = null; h.close?.(); if (scenery) scenery.group.visible = false; },
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
        if (!silenceShown && fired().length === 1 && beatAge > Math.max(hold, 3)) { closePanel(); outside = true; autoOutside = true; silenceShown = true; beatAge = 0; }
        if (autoOutside && beatAge > 3) { outside = false; autoOutside = false; beatAge = 0; }
        if (time >= end) playing = false;
      }
      if (h.target > 0 && !panelOpen) { panelOpen = true; renderContent(fired().at(-1), time >= end); evidenceMarker.setAttribute('aria-expanded', 'true'); }
      if (panelOpen && h.target === 0) closePanel();
      sync();
      const beats = content.querySelectorAll('.drill-beat');
      beats.forEach((node, i) => {
        const phase = capture || reduced || !playing ? 1 : clamp((beatAge - i * 0.28) / 0.5, 0, 1);
        node.style.opacity = String(phase);
        node.style.transform = `perspective(900px) rotateY(${(1 - phase) * -12}deg) scaleX(${0.94 + phase * 0.06})`;
      });
      if (!world.marker) {
        const cameraNow = world.camera || world.stage.camera;
        cameraNow.updateMatrixWorld();
        const mobile = innerWidth < 760, bounds = world.host.getBoundingClientRect();
        const projectMarker = (node, at) => {
          const point = new world.THREE.Vector3(...at).add(new world.THREE.Vector3(...(world.origin || [0, 0, 0]))).project(cameraNow);
          const x = (point.x + 1) * bounds.width / 2, y = (1 - point.y) * bounds.height / 2;
          node.hidden = panelOpen || point.z > 1 || Math.abs(point.x) > .9 || y < 80 || y > bounds.height - (mobile ? 265 : 230);
          node.style.left = `${clamp(x, 28, bounds.width - 28)}px`; node.style.top = `${y}px`;
        };
        evidenceMarker.hidden = outside;
        if (!outside) projectMarker(evidenceMarker, [2.05, .7, -.6]);
        projectMarker(silenceButton, outside ? [-2.5, .25, 0] : [-2.55, 1.65, -1.15]);
      }
      const entries = fired(), entry = entries.at(-1), frameNow = frame();
      const alarmThreshold = db.playbook.steps[0]?.when.find(item => item[0] === 'smoke_pct_alarm')?.[2];
      scenery?.update(reduced ? 0 : t, { frame: frameNow, activeStep: entry, t: time, elapsed: time - t0, flowTime: reduced ? time : t, clock: nowClock(), alarmed: entries.length > 0, alarmThreshold, shot: outside ? 'silence' : 'cabin', officerScale: innerWidth < 760 ? 1.6 : 2.1, officerAt: innerWidth < 760 ? { x: -.6, y: 1.8, z: 0 } : { x: world.host.dataset.hologramOpen === 'true' ? -.9 : -2.2, y: 0.55, z: 0.65 } });
      // Focus follows the same breakpoint as the camera (window width). cabin.js picks it by canvas aspect, and on a
      // narrow, short window the two disagreed and left the officer out of focus.
      if (scenery && world.camera) world.camera.userData.focusDistance = camera(t).position[2];
    },
    holograms: () => [],
    dispose() { disposed = true; thread.dispose(); debrief.dispose(); listeners.forEach(fn => fn()); h.dispose?.(); scenery?.group.removeFromParent(); scenery?.dispose?.(); root.remove(); hud.remove(); },
  };
}
