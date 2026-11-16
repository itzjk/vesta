// Animated view of the FLEX oxygen-band table: one drawn mark per recorded droplet test.
// Everything shown comes from flexReplay(); this file only draws and animates it.
import { flexReplay, replayState, hasEnded, markText, counterText, replaySummary, REPLAY_SCOPE, REPLAY_ORDER } from '../core/flex-replay.js?v=flex-replay-20261115-1';

const DURATION_MS = 7000;
let serial = 0;
const make = (tag, text, cls) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (cls) node.className = cls; return node; };

/** Builds the replay element for the loaded rows. It never throws: with nothing to draw it returns a hidden placeholder. */
export function createFlexReplay(tests) {
  let replay = null; try { replay = flexReplay(tests); } catch { replay = null; }
  const root = make('section', null, 'flex-replay');
  if (!replay || !replay.rows) { root.hidden = true; return root; }
  if (!document.querySelector('link[data-vesta-flex-replay]')) {
    const sheet = make('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('../../css/flex-replay.css?v=flex-replay-20261115-1', import.meta.url).href;
    sheet.dataset.vestaFlexReplay = ''; document.head.append(sheet);
  }
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const key = `flex-replay-${++serial}`;
  root.setAttribute('aria-label', 'Replay of the recorded FLEX test endings, by oxygen band');

  const head = make('div', null, 'fr-head'), title = make('h4', `${replay.rows} recorded tests, one mark each`, 'fr-title');
  const button = make('button', '', 'fr-play'); button.type = 'button'; button.setAttribute('aria-describedby', `${key}-hint`);
  head.append(title, button);

  const bandsBox = make('div', null, 'fr-bands'); bandsBox.setAttribute('role', 'img'); bandsBox.setAttribute('aria-label', replaySummary(replay));
  const marks = [], counters = [];
  for (const band of replay.bands) {
    const column = make('div', null, 'fr-band'), field = make('div', null, 'fr-marks'), counter = make('div', null, 'fr-count');
    for (const mark of band.marks) {
      const node = make('span', null, `fr-mark fr-${mark.end}`); node.dataset.i = String(marks.length);
      marks.push({ mark, node, band: counters.length, done: false }); field.append(node);
    }
    if (!band.tests) field.append(make('span', 'no tests', 'fr-none'));
    counters.push({ node: counter, shown: -1 });
    column.append(make('div', `Oxygen ${band.label.toLowerCase()}`, 'fr-band-label'), field, counter); bandsBox.append(column);
  }

  const legend = make('div', null, 'fr-legend'); legend.setAttribute('aria-hidden', 'true');
  const pending = make('span', null, 'fr-key'); pending.append(make('span', null, 'fr-mark'), make('span', 'Not yet settled'));
  legend.append(pending);
  for (const ending of replay.endings) {
    const item = make('span', null, 'fr-key'), total = replay.bands.reduce((sum, band) => sum + band.counts[ending.id], 0);
    item.append(make('span', null, `fr-mark fr-${ending.id} is-ended`), make('span', `${ending.label} · ${total}`)); legend.append(item);
  }
  const idle = 'Point at a mark to read that test. With the button focused, the arrow keys step through the marks.';
  const readout = make('div', idle, 'fr-readout'); readout.id = `${key}-hint`; readout.setAttribute('aria-live', 'polite');
  root.append(head, bandsBox, legend, readout, make('p', `${REPLAY_SCOPE} ${REPLAY_ORDER}`, 'fr-scope'));

  let t = still ? 1 : 0, playing = false, startedAt = 0, frame = 0, active = -1, started = still;
  function label() { button.textContent = playing ? 'Pause' : t >= 1 ? (still ? 'Show the start' : 'Replay') : t > 0 ? 'Resume' : (still && started ? 'Show the endings' : 'Play'); }
  function draw() {
    const state = replayState(replay, t);
    for (const item of marks) { const done = hasEnded(item.mark, t); if (done !== item.done) { item.done = done; item.node.classList.toggle('is-ended', done); } }
    state.bands.forEach((band, i) => { if (counters[i].shown !== band.extinction) { counters[i].shown = band.extinction; counters[i].node.textContent = counterText(band.extinction, band.tests); } });
  }
  function stop() { playing = false; if (frame) cancelAnimationFrame(frame); frame = 0; label(); }
  function tick(now) {
    frame = 0; if (!playing) return;
    if (!root.isConnected) { playing = false; return; }
    t = Math.min(1, (now - startedAt) / DURATION_MS); draw();
    if (t >= 1) stop(); else frame = requestAnimationFrame(tick);
  }
  function play() {
    started = true;
    if (still) { t = t >= 1 ? 0 : 1; draw(); label(); return; }
    if (t >= 1) t = 0;
    playing = true; startedAt = performance.now() - t * DURATION_MS; root.classList.add('is-live'); label(); draw(); frame = requestAnimationFrame(tick);
  }
  button.addEventListener('click', () => { if (playing) stop(); else play(); });

  function show(index) {
    if (active >= 0) marks[active].node.classList.remove('is-active');
    active = index;
    if (index < 0) { readout.textContent = idle; return; }
    marks[index].node.classList.add('is-active'); readout.textContent = markText(marks[index].mark);
  }
  const indexOf = target => { const node = target instanceof Element ? target.closest('.fr-mark[data-i]') : null; return node ? Number(node.dataset.i) : -1; };
  bandsBox.addEventListener('pointerover', event => { const i = indexOf(event.target); if (i >= 0 && i !== active) show(i); });
  bandsBox.addEventListener('click', event => { const i = indexOf(event.target); if (i >= 0) show(i); });
  bandsBox.addEventListener('pointerleave', () => { if (document.activeElement !== button) show(-1); });
  button.addEventListener('blur', () => show(-1));
  button.addEventListener('keydown', event => {
    const last = marks.length - 1, at = active < 0 ? -1 : active; let next = null;
    if (event.key === 'ArrowRight') next = Math.min(last, at + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, at - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // Jump to the first mark of the next or previous band that has tests.
      const step = event.key === 'ArrowDown' ? 1 : -1, from = at < 0 ? (step > 0 ? -1 : counters.length) : marks[at].band;
      for (let band = from + step; band >= 0 && band < counters.length && next === null; band += step) { const first = marks.findIndex(item => item.band === band); if (first >= 0) next = first; }
      if (next === null) next = Math.max(0, at);
    }
    if (next === null) return;
    event.preventDefault(); show(next);
  });

  draw(); label();
  // Motion starts once, when the view is actually on screen; reduced motion shows the final state and never animates.
  if (!still) {
    const begin = () => { if (!started && root.isConnected) play(); };
    if (typeof IntersectionObserver === 'function') {
      const watcher = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { watcher.disconnect(); begin(); } }, { threshold: .4 });
      watcher.observe(root);
    } else requestAnimationFrame(begin);
  }
  return root;
}
