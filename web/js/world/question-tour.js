import { QUESTION_SECONDS, QUESTION_STEPS, questionStep, questionTime, questionMotion, questionReveal } from './question-timeline.js?v=expert-20261115-1';
import { buildQuestionModel } from './question-model.js?v=expert-20261115-1';
import { LAMP_STAGGER } from '../scene/lamp-sequence.js?v=expert-20261115-1';

const node = (tag, className, text) => {
  const el = document.createElement(tag); el.className = className;
  if (text) el.textContent = text;
  return el;
};
const requested = () => new URLSearchParams(location.search).get('question') === '1'
  || new URLSearchParams(location.hash.split('?')[1]).get('question') === '1';
const labels = { PROVEN: 'Nearby', EXTRAPOLATED: 'Other conditions', NEVER_TESTED: 'No source' };

export function createQuestionTour({ host, overlay, api, context, world, invalidate }) {
  const sheet = node('link', ''); sheet.rel = 'stylesheet'; sheet.href = new URL('../../css/question-tour.css?v=expert-20261115-1', import.meta.url).href;
  document.head.append(sheet);
  const controller = new AbortController(), signal = controller.signal;
  const large = matchMedia('(min-width:1100px) and (min-height:700px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let run = null, pending = false, raf = 0, target = null, previousPose = null, lastPose = null, attention = null, attentionAt = 0, presentation = null;
  const launches = [], changedRows = [], unknownRows = [];
  const label = node('h2', 'question-label'); label.hidden = true; label.setAttribute('role', 'status'); label.setAttribute('aria-live', 'polite');
  const focus = node('div', 'question-focus'); focus.hidden = true; focus.setAttribute('aria-hidden', 'true');
  const story = node('section', 'question-story'); story.hidden = true; story.setAttribute('aria-label', 'One condition, actual evidence');
  const atmosphere = node('p', 'question-atmosphere');
  const gravity = node('p', 'question-gravity');
  const count = node('p', 'question-count'); count.dataset.questionCount = '';
  const other = node('p', 'question-count-context');
  const track = node('p', 'question-track', 'Track the changed questions');
  const changes = node('ol', 'question-changes'); changes.setAttribute('aria-label', 'Coverage before and after the gravity change');
  const inference = node('p', 'question-inference', 'Facility-inferred pressure remains labelled.');
  const unknown = node('section', 'question-unknown'); unknown.append(node('p', 'question-unknown-heading', 'Not compared'));
  const unknownList = node('ul', 'question-unknown-list'); unknown.append(unknownList);
  const missing = node('p', 'question-missing');
  const source = node('div', 'question-source');
  const verdict = node('p', 'question-verdict', 'Evidence coverage is not safety.'); verdict.dataset.questionVerdict = '';
  story.append(atmosphere, gravity, count, other, track, changes, inference, unknown, missing, source, verdict);
  const controls = node('nav', 'question-controls'); controls.hidden = true; controls.setAttribute('aria-label', 'One question walkthrough');
  const button = (text, action, fn) => {
    const b = node('button', '', text); b.type = 'button'; b.dataset.questionControl = action; b.onclick = fn; controls.append(b); return b;
  };
  const pause = button('Pause', 'pause', () => {
    if (!run) return;
    run.offset = elapsed(); run.paused = !run.paused; run.epoch = performance.now();
    pause.textContent = run.paused ? 'Resume' : 'Pause'; pause.setAttribute('aria-pressed', String(run.paused)); tick();
  });
  pause.setAttribute('aria-pressed', 'false');
  const skip = button('Next', 'skip', () => {
    if (!run) return;
    const next = QUESTION_STEPS[questionStep(elapsed()) + 1];
    if (!next) { finish('done'); return; }
    run.offset = next.at; run.epoch = performance.now(); tick();
  });
  button('Stop', 'stop', () => finish('stopped'));
  overlay.append(label, focus, story, controls);
  host.dataset.questionState = 'idle'; host.dataset.questionStep = 'idle';
  const find = selector => host.querySelector(selector);
  const elapsed = () => run ? questionTime(run.offset, run.epoch, performance.now(), run.paused) : 0;
  function launchAt(parent) {
    if (!parent || parent.querySelector('.question-launch')) return;
    const launch = node('button', 'question-launch', `One condition · ${QUESTION_SECONDS}s`); launch.type = 'button';
    launch.setAttribute('aria-label', `Play one evidence question, change gravity only, ${QUESTION_SECONDS} seconds`);
    if (parent === overlay) launch.classList.add('question-launch-docked');
    launch.onclick = () => start(launch);
    launch.disabled = host.dataset.evidenceReady !== 'true';
    parent.insertBefore(launch, parent.querySelector('.vesta-welcome-nav')); launches.push(launch);
  }
  launchAt(find('.vesta-welcome')); launchAt(overlay);
  function viewport() { host.dataset.questionCompact = String(!large.matches); invalidate(); }
  large.addEventListener('change', viewport, { signal }); viewport();
  function closeSource() { find('.wc-source .wc-dismiss')?.click(); }
  function buildStory(model) {
    atmosphere.textContent = `O₂ ${model.before.o2}% · ${model.before.p} kPa — held fixed`;
    changedRows.length = unknownRows.length = 0; changes.replaceChildren(); unknownList.replaceChildren(); source.replaceChildren();
    for (const cell of model.changed) {
      const row = node('li', 'question-change'); row.dataset.questionLamp = cell.key;
      const title = node('strong', '', `${cell.label} · ${cell.concern}`);
      const before = node('span', 'question-before', labels[cell.before]);
      const arrow = node('span', 'question-arrow', ' → '); arrow.setAttribute('aria-hidden', 'true');
      const after = node('span', 'question-after', labels[cell.after]); after.dataset.coverage = cell.after;
      row.append(title, before, arrow, after); changes.append(row); changedRows.push({ row, before, arrow, after, cell });
    }
    if (!model.changed.length) changes.append(node('li', '', 'No coverage labels change for this collection.'));
    for (const item of model.notCompared) {
      const li = node('li', '', item.label); li.dataset.questionUnknown = item.key; li.hidden = true;
      unknownList.append(li); unknownRows.push(li);
    }
    missing.textContent = model.partialRows === 0 ? 'No partial-gravity rows in this collection.' : `${model.partialRows} source-table rows at partial gravity in this collection.`;
    if (model.nearestId) source.append(world().cite('Inspect the compared source row', model.nearestId));
  }
  function step(index) {
    closeSource(); focus.hidden = true; target = null; attention = null;
    const s = QUESTION_STEPS[index]; run.index = index;
    host.dataset.questionStep = s.id; host.dataset.questionIndex = String(index + 1); label.textContent = s.label;
    if (s.id === 'cabin') run.hook.transition(run.model.after, run.model.changed.map(cell => cell.key));
    const changed = index >= 1, totals = run.model.counts[changed ? 'after' : 'before'];
    gravity.textContent = changed ? 'Gravity: 0 g → 1/6 g' : 'Gravity: 0 g';
    count.textContent = `${totals.PROVEN} / ${run.model.total} questions nearby`;
    count.dataset.nearby = String(totals.PROVEN); count.dataset.total = String(run.model.total);
    other.textContent = `${totals.EXTRAPOLATED} other conditions · ${totals.NEVER_TESTED} no source`;
    for (const entry of changedRows) {
      entry.arrow.hidden = entry.after.hidden = !changed;
      entry.before.dataset.prior = String(changed);
      entry.row.dataset.currentCoverage = changed ? entry.cell.after : entry.cell.before;
    }
    const closing = index >= 3;
    track.hidden = changes.hidden = closing;
    inference.hidden = index !== 2;
    unknown.hidden = !closing; missing.hidden = index !== 3; verdict.hidden = index !== 4;
    source.hidden = index !== 2 && index !== 4;
    host.dataset.questionCoverage = JSON.stringify(totals);
    invalidate();
  }
  function start(trigger) {
    if (run || pending) return false;
    document.querySelector('[data-tour-control=close]')?.click();
    if (context().params?.tour) context().setParams({ tour: null }, { render: false });
    pending = true; host.dataset.questionState = 'preparing'; launches.forEach(b => { b.disabled = true; });
    try {
      if (host.dataset.evidenceReady !== 'true') throw new Error('Evidence station is still loading. Try again in a moment.');
      api.setCinema(false); api.navigate('evidence', { cut: true });
      const w = world(), hook = w?.evidenceWalkthrough;
      if (!hook) throw new Error('The evidence walkthrough is not ready yet.');
      const model = buildQuestionModel(w.db);
      run = { epoch: performance.now(), offset: 0, paused: false, index: -1, trigger, model, hook, world: w, original: { ...w.q } };
      hook.prepare(model.before); buildStory(model);
      host.dataset.questionState = 'running'; host.dataset.questionCapture = String(Boolean(context().capture || context().params?.capture === '1'));
      host.dataset.questionDone = 'false'; host.dataset.questionEpoch = String(run.epoch); delete host.dataset.questionError;
      label.hidden = story.hidden = controls.hidden = false; pause.textContent = 'Pause'; pause.setAttribute('aria-pressed', 'false');
      controls.querySelector('button').focus({ preventScroll: true }); tick();
    } catch (error) {
      host.dataset.questionError = error.message; finish('unavailable');
      if (trigger) { trigger.textContent = 'Try again shortly'; trigger.title = error.message; }
    } finally { pending = false; launches.forEach(b => { b.disabled = host.dataset.evidenceReady !== 'true'; }); }
    return Boolean(run);
  }
  function finish(state) {
    pending = false; cancelAnimationFrame(raf);
    const prior = run; run = null; target = null; previousPose = lastPose = null; attention = null;
    prior?.hook.clear();
    if (prior && ['stopped', 'error', 'unavailable'].includes(state)) prior.world.setQ(prior.original, { render: false });
    label.hidden = focus.hidden = story.hidden = controls.hidden = true;
    closeSource(); host.dataset.questionState = state; host.dataset.questionDone = String(state === 'done');
    if (presentation) presentation = { ...presentation, state, paused: false, seconds: state === 'done' ? QUESTION_SECONDS : presentation.seconds };
    if (state === 'done') host.dataset.questionSeconds = String(QUESTION_SECONDS);
    launches.forEach(b => { b.disabled = host.dataset.evidenceReady !== 'true'; });
    if (prior?.trigger?.isConnected) prior.trigger.focus({ preventScroll: true });
    invalidate();
  }
  function tick() {
    cancelAnimationFrame(raf);
    if (!run) return;
    if (api.station !== 'evidence' || document.documentElement.dataset.tour === 'running') { finish('stopped'); return; }
    try {
      const t = elapsed(), index = questionStep(t);
      while (run.index < index) step(run.index + 1);
      host.dataset.questionSeconds = t.toFixed(3);
      const changeAt = QUESTION_STEPS[1].at, transition = Math.max(0, t - changeAt);
      run.hook.frame(transition, reduced.matches);
      let pointed = -1;
      if (index === 0) pointed = 0;
      if (index === 1 && transition < run.model.changed.length * LAMP_STAGGER + .55) pointed = Math.min(run.model.changed.length - 1, Math.floor(transition / LAMP_STAGGER));
      changedRows.forEach((entry, i) => { entry.row.dataset.active = String(i === pointed); });
      const reveal = questionReveal(t, unknownRows.length, reduced.matches);
      unknownRows.forEach((row, i) => { row.hidden = i >= reveal; });
      host.dataset.questionUnknowns = String(reveal);
      const cell = run.model.changed[pointed];
      const nextTarget = cell ? large.matches ? `lamp:${cell.key}` : `[data-question-lamp="${cell.key}"]`
        : index === 3 && reveal ? `[data-question-unknown="${run.model.notCompared[reveal - 1].key}"]`
          : index === 4 ? '[data-question-verdict]' : '[data-question-count]';
      if (nextTarget !== target && !large.matches && !nextTarget.startsWith('lamp:')) {
        find(nextTarget)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      }
      target = nextTarget;
      const s = QUESTION_STEPS[index], q = index ? run.model.after : run.model.before;
      presentation = { schema: 'vesta.question-presentation/1', state: 'running', phase: s.id, title: s.label,
        caption: ['Can this evidence transfer?', 'Hold oxygen and pressure fixed', `${run.model.changed.length} questions change coverage`, 'Not compared by this method', 'Evidence coverage is not safety'][index],
        seconds: t, duration: QUESTION_SECONDS, paused: run.paused, reducedMotion: reduced.matches,
        query: { oxygen_percent: q.o2, pressure_kpa: q.p, gravity: q.g, gravity_class: q.gclass, material: q.material, concern: q.concern },
        coverage: { ...run.model.counts[index ? 'after' : 'before'] }, total: run.model.total,
        countCaption: `${run.model.counts[index ? 'after' : 'before'].PROVEN} / ${run.model.total} questions nearby`,
        selected: { material: 'pmma', concern: 'prevention', status: run.model.selected[index ? 'after' : 'before']?.status ?? null },
        nearbyRowIds: [...run.model.nearbyRowIds[index ? 'after' : 'before']], nearbyRowScope: 'Unique source-table hit IDs across all coverage cells.',
        changed: run.model.changed.map(entry => ({ ...entry, current: index ? entry.after : entry.before })),
        indicatedQuestion: cell?.key ?? null, notCompared: run.model.notCompared.slice(0, reveal).map(entry => ({ key: entry.key, label: entry.label })),
        sourceRowId: run.model.nearestId, scope: 'Evidence coverage in VESTA’s loaded collection, not safety. Lamp movement illustrates a software result, not physical fire behaviour.' };
      if (t >= QUESTION_SECONDS) { finish('done'); return; }
      invalidate();
      if (!run.paused) raf = requestAnimationFrame(tick);
    } catch (error) { host.dataset.questionError = error.message; finish('error'); }
  }
  function pose(base) {
    if (!run || !target || !api.camera || !world()?.THREE) return base;
    const r = target.startsWith('lamp:') ? run.hook.lampRect(...target.slice(5).split(':')) : find(target)?.getBoundingClientRect();
    const canvas = find('.world-canvas'), c = canvas?.getBoundingClientRect(), h = host.getBoundingClientRect();
    if (!r?.width || !r.height || !c?.width) { focus.hidden = true; return base; }
    focus.hidden = false;
    Object.assign(focus.style, { left: `${Math.round(r.left - h.left - 5)}px`, top: `${Math.round(r.top - h.top - 5)}px`, width: `${Math.round(r.width + 10)}px`, height: `${Math.round(r.height + 10)}px` });
    const { THREE: T, origin } = run.world, camera = api.camera;
    run.world.vesta.group.visible = true; camera.userData.aperture = 0;
    const compact = !large.matches, rightPanel = r.left > h.left + h.width / 2;
    const px = compact ? c.left + 45 : Math.min(c.right - 85, Math.max(c.left + 85, rightPanel ? r.left - 105 : r.right + 105));
    const py = Math.min(h.bottom - 155, Math.max(h.top + 165, r.top + r.height / 2));
    const point = new T.Vector3((px - c.left) / c.width * 2 - 1, 1 - (py - c.top) / c.height * 2, .5).unproject(camera);
    point.sub(camera.position).normalize().multiplyScalar(8).add(camera.position); point.sub(new T.Vector3(...origin));
    const direction = compact || rightPanel ? 1 : -1;
    const next = { ...base, x: point.x, y: point.y, z: point.z, scale: compact ? .36 : .65,
      yaw: direction * .25, lookX: direction, lookY: 0, armL: direction > 0 ? .15 : .9, armR: direction > 0 ? .9 : .15,
      armFwdL: direction > 0 ? 0 : .65, armFwdR: direction > 0 ? .65 : 0, beacon: .45, beaconWarm: 1, idle: 0, blink: 0, thrust: .35 };
    if (reduced.matches) {
      run.guideDock ||= { x: next.x, y: next.y, z: next.z, scale: next.scale };
      Object.assign(next, run.guideDock);
    }
    if (attention !== target) { previousPose = { ...(lastPose || next) }; attention = target; attentionAt = elapsed(); }
    const mix = questionMotion(elapsed() - attentionAt, reduced.matches);
    for (const key of ['x', 'y', 'z', 'scale']) next[key] = previousPose[key] == null ? next[key] : previousPose[key] + (next[key] - previousPose[key]) * mix;
    host.dataset.questionGuide = JSON.stringify({ x: next.x, y: next.y, z: next.z, scale: next.scale, target });
    lastPose = next; return next;
  }
  document.addEventListener('keydown', event => {
    if (!run && !pending) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish('stopped'); }
    else if (!event.target.closest('button,a,input,select,textarea,summary')) {
      if (event.key === ' ') { event.preventDefault(); pause.click(); }
      if (event.key === 'ArrowRight') { event.preventDefault(); skip.click(); }
    }
  }, { capture: true, signal });
  document.addEventListener('click', event => {
    if (run && event.isTrusted && event.target.closest('button,a,input,select') && !event.target.closest('.question-controls')) finish(event.target.closest('.question-source') ? 'inspecting' : 'stopped');
  }, { capture: true, signal });
  document.addEventListener('visibilitychange', () => { if (run && document.hidden && !run.paused) pause.click(); }, { signal });
  const observer = new MutationObserver(() => {
    launchAt(find('.vesta-welcome')); launchAt(overlay);
    launches.forEach(b => { b.disabled = pending || host.dataset.evidenceReady !== 'true'; });
    if (requested() && window.vesta?.world === api && host.dataset.worldAllBuilt === 'true' && host.dataset.questionState === 'idle') start();
  });
  observer.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-world-all-built', 'data-evidence-ready'] });
  const autoTimer = requested() ? setInterval(() => {
    if (window.vesta?.world === api && host.dataset.worldAllBuilt === 'true' && host.dataset.questionState === 'idle') { clearInterval(autoTimer); start(); }
  }, 100) : null;
  const autoTimeout = autoTimer ? setTimeout(() => { clearInterval(autoTimer); if (host.dataset.questionState === 'idle') host.dataset.questionState = 'unavailable'; }, 15000) : null;
  return { pose, start: () => start(), stop: () => { if (run || pending) finish('stopped'); }, presentation: () => presentation ? JSON.parse(JSON.stringify(presentation)) : null, dispose() {
    finish('disposed'); clearInterval(autoTimer); clearTimeout(autoTimeout); controller.abort(); observer.disconnect();
    launches.forEach(b => b.remove()); label.remove(); focus.remove(); story.remove(); controls.remove(); sheet.remove();
    for (const key of ['questionState', 'questionStep', 'questionDone', 'questionSeconds', 'questionIndex', 'questionEpoch', 'questionCapture', 'questionGuide', 'questionError', 'questionCompact', 'questionCoverage', 'questionUnknowns']) delete host.dataset[key];
  } };
}
