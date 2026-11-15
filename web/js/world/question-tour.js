import { createReceipt } from '../core/receipt.js';
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
  let run = null, pending = false, serial = 0, raf = 0, sourceReady = false, target = null, previousPose = null, lastPose = null, attention = null, attentionAt = 0;
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
    const launch = node('button', 'question-launch', 'One question · 28s'); launch.type = 'button';
    launch.setAttribute('aria-label', 'Play one question from cabin to source and recheck, 28 seconds');
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
    find('.wc-source .wc-dismiss')?.click(); sourceReady = false;
  }
  function material(id) {
    click(`[data-sample-material="${id}"]`);
    if (find('[data-sample-concern="prevention"]')?.getAttribute('aria-pressed') !== 'true') click('[data-sample-concern="prevention"]');
  }
  function step(index) {
    closeSource(); focus.hidden = true; target = null; attention = null;
    const s = QUESTION_STEPS[index]; run.index = index;
    host.dataset.questionStep = s.id; host.dataset.questionIndex = String(index + 1); label.textContent = s.label;
    if (s.id === 'cabin') {
      action('cabin');
      const select = find('[data-evidence-choice="preset"]');
      if (!select) throw new Error('Cabin preset control unavailable');
      select.value = 'lunar-base'; select.dispatchEvent(new Event('change', { bubbles: true }));
      target = '[data-evidence-choice="preset"]';
    }
    if (s.id === 'rack') {
      find('.evidence-close')?.click(); target = '.evidence-rack-legend';
    }
    if (s.id === 'question' || s.id === 'comparison') {
      material('pmma'); target = s.id === 'question' ? '.coverage-detail h3' : '.matchpanel-strip';
    }
    if (s.id === 'source') {
      if (!find('.coverage-detail h4 + p .world-cite') || context().q.material !== 'pmma') material('pmma');
      click('.coverage-detail h4 + p .world-cite'); target = '.wc-sentence';
    }
    if (s.id === 'gap') {
      material('kapton'); target = '.coverage-state';
    }
    if (s.id === 'repeat') {
      material('pmma'); action('receipt'); target = '[data-action="receipt-save"]'; run.saved = false; run.loaded = false;
    }
    invalidate();
  }
  async function start(trigger) {
    if (run || pending || !large.matches) return;
    document.querySelector('[data-tour-control=close]')?.click();
    if (context().params?.tour) context().setParams({ tour: null }, { render: false });
    const id = ++serial; pending = true; host.dataset.questionState = 'preparing';
    launches.forEach(b => { b.disabled = true; });
    try {
      if (host.dataset.evidenceReady !== 'true') throw new Error('Evidence station is still loading. Try again in a moment.');
      const ctx = context(), q = ctx.core.index.presetPoint(ctx.db, 'lunar-base', 'prevention', 'pmma');
      const receipt = await createReceipt(ctx.db, q);
      if (id !== serial || !host.isConnected) return;
      const file = new File([JSON.stringify(receipt, null, 2) + '\n'], 'vesta-evidence-receipt.json', { type: 'application/json', lastModified: 0 });
      api.setCinema(false); api.navigate('evidence', { cut: true });
      action('cabin');
      const preset = find('[data-evidence-choice="preset"]');
      preset.value = 'station'; preset.dispatchEvent(new Event('change', { bubbles: true }));
      find('.evidence-close')?.click();
      run = { epoch: performance.now(), offset: 0, paused: false, index: -1, trigger, file };
      host.dataset.questionState = 'running'; host.dataset.questionCapture = String(Boolean(context().capture || context().params?.capture === '1')); host.dataset.questionDone = 'false'; host.dataset.questionEpoch = String(run.epoch); delete host.dataset.questionError;
      label.hidden = controls.hidden = false; pause.textContent = 'Pause'; pause.setAttribute('aria-pressed', 'false');
      controls.querySelector('button').focus({ preventScroll: true }); tick();
    } catch (error) {
      host.dataset.questionState = 'unavailable'; host.dataset.questionError = error.message;
      if (trigger) { trigger.textContent = 'Try again shortly'; trigger.title = error.message; }
    } finally { pending = false; launches.forEach(b => { b.disabled = false; }); }
  }
  function finish(state) {
    serial++; pending = false; cancelAnimationFrame(raf);
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
      if (index !== run.index) step(index);
      const local = t - QUESTION_STEPS[index].at;
      host.dataset.questionSeconds = t.toFixed(3);
      if (QUESTION_STEPS[index].id === 'cabin') target = '[data-evidence-choice="preset"]';
      if (QUESTION_STEPS[index].id === 'source' && !sourceReady) {
        const quote = find('.wc-sentence'), panel = find('.wc-source');
        if (quote && panel) {
          panel.prepend(controls);
          panel.scrollTop = Math.max(0, quote.offsetTop - 90); sourceReady = true;
        }
      }
      if (QUESTION_STEPS[index].id === 'repeat') {
        if (!run.saved && local >= .4) { click('[data-action="receipt-save"]'); run.saved = true; }
        const wrap = find('[data-receipt]');
        if (!run.loaded && local >= 1.4 && wrap?.dataset.receiptStatus === 'SAVED') {
          const transfer = new DataTransfer(); transfer.items.add(run.file);
          const input = find('[data-receipt-input]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
          run.loaded = true;
        }
        if (wrap?.dataset.receiptStatus === 'MATCH') {
          target = '[data-receipt] [role="status"]'; label.textContent = `${wrap.dataset.receiptStatus} · Same result`;
        }
      }
      if (t >= QUESTION_SECONDS) {
        if (find('[data-receipt]')?.dataset.receiptStatus !== 'MATCH') throw new Error('Receipt did not reach MATCH before the walkthrough ended');
        finish('done'); return;
      }
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
    camera.userData.aperture = 0;
    const rightPanel = r.left > h.left + h.width / 2;
    const px = Math.min(c.right - 100, Math.max(c.left + 100, rightPanel ? r.left - 125 : r.right + 125)), py = Math.min(h.bottom - 190, Math.max(h.top + 180, r.top + r.height / 2));
    const point = new T.Vector3((px - c.left) / c.width * 2 - 1, 1 - (py - c.top) / c.height * 2, .5).unproject(camera);
    point.sub(camera.position).normalize().multiplyScalar(8).add(camera.position);
    point.sub(new T.Vector3(...origin));
    const next = { ...base, x: point.x, y: point.y, z: point.z, scale: .75, yaw: rightPanel ? .25 : -.25, lookX: rightPanel ? 1 : -1, lookY: 0, armL: rightPanel ? .15 : .9, armR: rightPanel ? .9 : .15, armFwdL: rightPanel ? 0 : .65, armFwdR: rightPanel ? .65 : 0, beacon: .45, beaconWarm: 1, idle: 0, blink: 0, thrust: .35 };
    if (attention !== target) { previousPose = { ...(lastPose || base) }; attention = target; attentionAt = target === '[data-receipt] [role="status"]' ? QUESTION_STEPS[run.index].at + 1.4 : QUESTION_STEPS[run.index].at; }
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
