import { QUESTION_SECONDS, QUESTION_STEPS, questionStep, questionTime, questionMotion } from './question-timeline.js';

const node = (tag, className, text) => {
  const el = document.createElement(tag); el.className = className;
  if (text) el.textContent = text;
  return el;
};
const requested = () => new URLSearchParams(location.search).get('question') === '1'
  || new URLSearchParams(location.hash.split('?')[1]).get('question') === '1';

export function createQuestionTour({ host, overlay, api, context, world, actions, invalidate }) {
  const sheet = node('link', ''); sheet.rel = 'stylesheet'; sheet.href = new URL('../../css/question-tour.css', import.meta.url).href;
  document.head.append(sheet);
  const controller = new AbortController(), signal = controller.signal;
  const large = matchMedia('(min-width:1100px) and (min-height:700px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let run = null, pending = false, raf = 0, target = null, previousPose = null, lastPose = null, attention = null, attentionAt = 0, guideLight = null;
  const launches = [];
  const label = node('h2', 'question-label'); label.hidden = true; label.setAttribute('role', 'status'); label.setAttribute('aria-live', 'polite');
  const focus = node('div', 'question-focus'); focus.hidden = true; focus.setAttribute('aria-hidden', 'true');
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
  button('Skip', 'skip', () => {
    if (!run) return;
    const next = QUESTION_STEPS[questionStep(elapsed()) + 1];
    if (!next) { finish('stopped'); return; }
    run.offset = next.at; run.epoch = performance.now(); tick();
  });
  button('Stop', 'stop', () => finish('stopped'));
  overlay.append(label, focus, controls);
  host.dataset.questionState = 'idle'; host.dataset.questionStep = 'idle';
  const find = selector => host.querySelector(selector);
  const click = selector => {
    const el = find(selector);
    if (!el) throw new Error(`Walkthrough control unavailable: ${selector}`);
    el.click(); return el;
  };
  const action = id => {
    const item = actions()?.find(item => item.id === id);
    if (!item) throw new Error(`Walkthrough action unavailable: ${id}`);
    if (!item.expanded?.()) item.run();
  };
  function launchAt(parent) {
    if (!parent || parent.querySelector('.question-launch')) return;
    const launch = node('button', 'question-launch', `One question · ${QUESTION_SECONDS}s`); launch.type = 'button';
    launch.setAttribute('aria-label', `Play one question, change gravity only, ${QUESTION_SECONDS} seconds`);
    if (parent === overlay) launch.classList.add('question-launch-docked');
    launch.onclick = () => start(launch);
    launch.disabled = host.dataset.evidenceReady !== 'true';
    parent.insertBefore(launch, parent.querySelector('.vesta-welcome-nav')); launches.push(launch);
  }
  launchAt(find('.vesta-welcome')); launchAt(overlay);
  function supported() {
    launches.forEach(b => { b.hidden = !large.matches; });
    if (!large.matches && (run || pending)) finish('unavailable');
  }
  large.addEventListener('change', supported, { signal }); supported();
  const elapsed = () => run ? questionTime(run.offset, run.epoch, performance.now(), run.paused) : 0;
  function closeSource() {
    if (controls.parentElement !== overlay) overlay.append(controls);
    find('.wc-source .wc-dismiss')?.click();
  }
  function material(id) {
    click(`[data-sample-material="${id}"]`);
    if (find('[data-sample-concern="prevention"]')?.getAttribute('aria-pressed') !== 'true') click('[data-sample-concern="prevention"]');
  }
  function step(index) {
    closeSource(); focus.hidden = true; target = null; attention = null;
    const s = QUESTION_STEPS[index]; run.index = index;
    if (guideLight) guideLight.visible = s.id === 'gap';
    host.dataset.questionStep = s.id; host.dataset.questionIndex = String(index + 1); label.textContent = s.label;
    if (s.id === 'cabin') {
      action('cabin');
      click('[data-cabin-gravity="moon"]');
      target = '.cabin-gravity';
    }
    if (s.id === 'question' || s.id === 'comparison' || s.id === 'close') {
      material('pmma'); target = s.id === 'close' ? '.matchpanel-warning' : '.matchpanel-strip';
    }
    if (s.id === 'gap') {
      action('conditions'); target = '.field-empty strong';
      if (!guideLight) {
        guideLight = new (world().THREE.HemisphereLight)(0xede4d4, 0x191715, 2);
        world().vesta.group.add(guideLight);
      }
      guideLight.visible = true;
    }
    invalidate();
  }
  function start(trigger) {
    if (run || pending || !large.matches) return;
    document.querySelector('[data-tour-control=close]')?.click();
    if (context().params?.tour) context().setParams({ tour: null }, { render: false });
    pending = true; host.dataset.questionState = 'preparing';
    launches.forEach(b => { b.disabled = true; });
    try {
      if (host.dataset.evidenceReady !== 'true') throw new Error('Evidence station is still loading. Try again in a moment.');
      api.setCinema(false); api.navigate('evidence', { cut: true });
      action('cabin');
      const preset = find('[data-evidence-choice="preset"]');
      preset.value = 'station'; preset.dispatchEvent(new Event('change', { bubbles: true }));
      find('.evidence-close')?.click();
      run = { epoch: performance.now(), offset: 0, paused: false, index: -1, trigger };
      host.dataset.questionState = 'running'; host.dataset.questionCapture = String(Boolean(context().capture || context().params?.capture === '1')); host.dataset.questionDone = 'false'; host.dataset.questionEpoch = String(run.epoch); delete host.dataset.questionError;
      label.hidden = controls.hidden = false; pause.textContent = 'Pause'; pause.setAttribute('aria-pressed', 'false');
      controls.querySelector('button').focus({ preventScroll: true }); tick();
    } catch (error) {
      host.dataset.questionState = 'unavailable'; host.dataset.questionError = error.message;
      if (trigger) { trigger.textContent = 'Try again shortly'; trigger.title = error.message; }
    } finally { pending = false; launches.forEach(b => { b.disabled = false; }); }
  }
  function finish(state) {
    pending = false; cancelAnimationFrame(raf);
    if (guideLight) { guideLight.removeFromParent(); guideLight.dispose(); guideLight = null; }
    const trigger = run?.trigger; run = null; target = null; previousPose = lastPose = null; attention = null;
    label.hidden = focus.hidden = controls.hidden = true;
    closeSource(); host.dataset.questionState = state; host.dataset.questionDone = String(state === 'done');
    if (state === 'done') host.dataset.questionSeconds = String(QUESTION_SECONDS);
    launches.forEach(b => { b.disabled = false; });
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    invalidate();
  }
  function tick() {
    cancelAnimationFrame(raf);
    if (!run) return;
    if (!large.matches || api.station !== 'evidence' || document.documentElement.dataset.tour === 'running') { finish('stopped'); return; }
    try {
      const t = elapsed(), index = questionStep(t);
      while (run.index < index) step(run.index + 1);
      host.dataset.questionSeconds = t.toFixed(3);
      if (QUESTION_STEPS[index].id === 'gap') {
        const moon = find('.field-gravities [data-field-gravity="moon"]');
        if (moon && moon.getAttribute('aria-pressed') !== 'true') moon.click();
      }
      if (t >= QUESTION_SECONDS) { finish('done'); return; }
      if (context().capture || context().params?.capture === '1') invalidate();
      raf = requestAnimationFrame(tick);
    } catch (error) { host.dataset.questionError = error.message; finish('error'); }
  }
  function pose(base) {
    if (!run || !target || !api.camera || !world()?.THREE) return base;
    const el = find(target), canvas = find('.world-canvas'), r = el?.getBoundingClientRect(), c = canvas?.getBoundingClientRect(), h = host.getBoundingClientRect();
    if (!r?.width || !r.height || !c?.width) { focus.hidden = true; return base; }
    focus.hidden = false;
    Object.assign(focus.style, { left: `${Math.round(r.left - h.left - 6)}px`, top: `${Math.round(r.top - h.top - 6)}px`, width: `${Math.round(r.width + 12)}px`, height: `${Math.round(r.height + 12)}px` });
    const { THREE: T, origin } = world(), camera = api.camera;
    world().vesta.group.visible = true;
    camera.userData.aperture = 0;
    const chart = QUESTION_STEPS[run.index].id === 'gap' ? find('.field-instrument')?.getBoundingClientRect() : null;
    const boundary = chart || r, rightPanel = Boolean(chart) || r.left > h.left + h.width / 2;
    const px = Math.min(c.right - 100, Math.max(c.left + 100, rightPanel ? boundary.left - 125 : boundary.right + 125)), py = Math.min(h.bottom - 190, Math.max(h.top + 180, r.top + r.height / 2));
    const point = new T.Vector3((px - c.left) / c.width * 2 - 1, 1 - (py - c.top) / c.height * 2, .5).unproject(camera);
    point.sub(camera.position).normalize().multiplyScalar(8).add(camera.position);
    point.sub(new T.Vector3(...origin));
    const next = { ...base, x: point.x, y: point.y, z: point.z, scale: .75, yaw: rightPanel ? .25 : -.25, lookX: rightPanel ? 1 : -1, lookY: 0, armL: rightPanel ? .15 : .9, armR: rightPanel ? .9 : .15, armFwdL: rightPanel ? 0 : .65, armFwdR: rightPanel ? .65 : 0, beacon: .45, beaconWarm: 1, idle: 0, blink: 0, thrust: .35 };
    if (attention !== target) { previousPose = { ...(lastPose || base) }; attention = target; attentionAt = QUESTION_STEPS[run.index].at; }
    const mix = questionMotion(elapsed() - attentionAt, reduced.matches || run.paused);
    for (const key of ['x', 'y', 'z', 'scale']) next[key] = previousPose[key] == null ? next[key] : previousPose[key] + (next[key] - previousPose[key]) * mix;
    host.dataset.questionGuide = JSON.stringify({ x: next.x, y: next.y, z: next.z, scale: next.scale, target });
    lastPose = next; return next;
  }
  document.addEventListener('keydown', event => {
    if ((run || pending) && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish('stopped'); }
  }, { capture: true, signal });
  document.addEventListener('click', event => {
    if (run && event.isTrusted && event.target.closest('button,a,input,select') && !event.target.closest('.question-controls')) finish('stopped');
  }, { capture: true, signal });
  document.addEventListener('visibilitychange', () => { if (run && document.hidden && !run.paused) pause.click(); }, { signal });
  const observer = new MutationObserver(() => {
    launchAt(find('.vesta-welcome')); launchAt(overlay);
    launches.forEach(b => { b.disabled = pending || host.dataset.evidenceReady !== 'true'; });
    if (requested() && window.vesta?.world === api && host.dataset.worldAllBuilt === 'true' && host.dataset.questionState === 'idle') {
      if (large.matches) start(); else host.dataset.questionState = 'unavailable';
    }
  });
  observer.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-world-all-built', 'data-evidence-ready'] });
  const autoTimer = requested() ? setInterval(() => {
    if (window.vesta?.world === api && host.dataset.worldAllBuilt === 'true' && host.dataset.questionState === 'idle') {
      clearInterval(autoTimer);
      if (large.matches) start(); else host.dataset.questionState = 'unavailable';
    }
  }, 100) : null;
  const autoTimeout = autoTimer ? setTimeout(() => { clearInterval(autoTimer); if (host.dataset.questionState === 'idle') host.dataset.questionState = 'unavailable'; }, 15000) : null;
  return { pose, dispose() {
    finish('disposed'); clearInterval(autoTimer); clearTimeout(autoTimeout); controller.abort(); observer.disconnect(); launches.forEach(b => b.remove()); label.remove(); focus.remove(); controls.remove(); sheet.remove();
    for (const key of ['questionState', 'questionStep', 'questionDone', 'questionSeconds', 'questionIndex', 'questionEpoch', 'questionCapture', 'questionGuide', 'questionError']) delete host.dataset[key];
  } };
}
