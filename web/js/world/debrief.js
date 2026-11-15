import { createDrillModel, basisKey, evidenceIds, node } from './drill-thread.js';
import { replayControls } from '../ui/replay.js';

export function summarize(model, q) {
  if (!model) return null;
  const state = model.at(q);
  const counts = { experiment: 0, summary: 0, operations: 0, no_source: 0 };
  for (const entry of state.entries) counts[basisKey(entry)]++;
  return { ...state, counts };
}

export function build(world) {
  const { db, core } = world, model = createDrillModel(world);
  const element = node('section', null, 'vesta-debrief'); element.hidden = true;
  element.setAttribute('aria-label', 'Drill debrief');
  const style = node('style');
  style.textContent = `
.vesta-debrief[hidden]{display:none!important}.vesta-debrief{box-sizing:border-box;width:100%;min-width:0;max-height:100%;overflow:auto;overscroll-behavior:contain;pointer-events:auto;background:var(--bg-0);color:var(--ivory);font:18px/1.4 var(--font);padding:20px;overflow-wrap:anywhere}
.vesta-debrief h2{font:600 32px/1.05 var(--display);margin:0 0 8px}.vesta-debrief h3{font:600 24px/1.2 var(--display);margin:20px 0 8px}.vesta-debrief p{font:inherit;margin:8px 0}.vesta-debrief .debrief-label{font:14px/1.4 var(--mono);color:var(--amber)}
.vesta-debrief .debrief-counts{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:12px 0;border-block:1px solid var(--line);margin:16px 0}.vesta-debrief .debrief-counts p{margin:0}.vesta-debrief .debrief-counts strong{font:600 32px/1 var(--display);color:var(--amber);margin-right:8px}
.vesta-debrief details{border-top:1px solid var(--line);padding:4px 0}.vesta-debrief summary{cursor:pointer;min-height:44px;box-sizing:border-box;padding:10px 0;touch-action:manipulation}.vesta-debrief .debrief-detail{padding:0 0 16px}.vesta-debrief .debrief-limit{color:var(--ivory-dim)}
.vesta-debrief button,.vesta-debrief a{font:inherit;min-height:44px;color:inherit;touch-action:manipulation}.vesta-debrief .debrief-actions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.vesta-debrief .debrief-actions button{background:var(--surface-1);border:1px solid var(--line-strong);padding:10px 14px;cursor:pointer}.vesta-debrief .debrief-actions button:first-child{color:var(--amber)}
.vesta-debrief :focus-visible{outline:2px solid var(--amber);outline-offset:3px}.vesta-debrief .debrief-disclosure{font:14px/1.4 var(--mono);color:var(--ivory-dim)}
@media(max-width:500px){.vesta-debrief{padding:16px}.vesta-debrief .debrief-counts{gap:8px 12px}.vesta-debrief .debrief-actions button{flex:1 1 140px}}
`;
  const heading = node('h2', 'The drill is complete'); heading.tabIndex = -1;
  const subtitle = node('p', model?.meta.title);
  const counts = node('div', null, 'debrief-counts');
  const countNodes = Object.keys({ experiment: 0, summary: 0, operations: 0, no_source: 0 }).map(key => {
    const line = node('p'), value = node('strong'); line.dataset.basis = key;
    line.append(value, node('span', core.text.basis(key))); counts.append(line); return [key, value];
  });
  const delay = node('div');
  if (model) {
    for (const id of [model.meta.comm.one_way_finding, model.meta.comm.round_trip_finding]) {
      const finding = db.findingById[id], line = node('p');
      line.append(finding ? world.cite(finding.claim, id) : node('span', 'Communication delay: no verified source in this collection.')); delay.append(line);
    }
    delay.append(node('p', `Scenario assumption: ${model.meta.comm.assumes}.`, 'debrief-limit'));
  }
  const decisions = node('div');
  for (const entry of model?.log ?? []) {
    const item = node('details'); item.dataset.decision = entry.step;
    const summary = node('summary', entry.question), body = node('div', null, 'debrief-detail');
    body.append(node('p', `${core.clock.mmss(entry.t - model.first)} · ${core.text.basis(basisKey(entry))}`, 'debrief-label'));
    body.append(node('p', entry.action));
    if (entry.state === 'NO_SOURCE') body.append(node('p', core.text.NO_SOURCE_LINE), node('p', core.text.reasonSentence(entry.gap, { n: db.investigations.length }), 'debrief-limit'));
    else body.append(node('p', core.text.statusMeaning('INTERPRETATION'), 'debrief-limit'));
    for (const id of evidenceIds(entry, db)) {
      const finding = db.findingById[id], p = node('p');
      p.append(world.cite(finding.claim || finding.title, id));
      body.append(p, node('p', core.text.level(finding), 'debrief-limit'));
    }
    for (const id of entry.row_ids ?? []) {
      const row = db.testById[id];
      if (row) { const p = node('p'); p.append(world.cite(`${row.fuel || id}: table row`, id)); body.append(p); }
    }
    if (entry.coverage) body.append(node('p', `${core.text.status(entry.coverage.status)}: ${core.text.statusMeaning(entry.coverage.status)}`, 'debrief-limit'));
    if (entry.limits) body.append(node('p', entry.limits, 'debrief-limit'));
    if (entry.protocol) {
      const p = node('p', 'ISS procedure, conditional fallback: '), protocol = entry.protocol;
      p.append(world.cite(protocol.action, protocol.finding_id));
      body.append(p, node('p', protocol.limit, 'debrief-limit'));
    }
    item.append(summary, body); decisions.append(item);
  }
  const actions = node('div', null, 'debrief-actions');
  const button = (label, action, fn) => { const b = node('button', label); b.type = 'button'; b.dataset.debrief = action; b.onclick = fn; actions.append(b); return b; };
  let disposed = false, lastComplete = false;
  const replay = replayControls({ db, getInput: () => ({ frames: model.frames, meta: model.meta }) });
  if (!model) for (const b of replay.querySelectorAll('button')) b.disabled = true;
  button('Run again', 'replay', () => {
    if (!model) return;
    const q = { t: model.frames[0].t, shot: null, play: null, paused: '1' };
    update(q);
    if (world.onReplay) world.onReplay();
    else world.setQ(q);
  });
  button('Evidence: see the gaps', 'evidence', () => world.go(`#/design?${new URLSearchParams({ preset: model?.meta.preset ?? '', mat: '' })}`));
  element.append(style, heading, subtitle, counts, actions, replay, node('p', core.text.STATUS_LINE, 'debrief-limit'),
    node('h3', 'Earth response delay'), delay, node('h3', 'Review each decision'), decisions,
    node('p', 'SIMULATED TELEMETRY · SCRIPTED · NOT A PHYSICS MODEL', 'debrief-disclosure'));
  function update(q = world.q) {
    if (disposed) return;
    const state = summarize(model, q); element.hidden = !state?.complete;
    if (!state) return;
    for (const [key, value] of countNodes) value.textContent = String(state.counts[key]);
    if (!state.complete && lastComplete) for (const item of decisions.children) item.open = false;
    if (state.complete && !lastComplete) { element.scrollTop = 0; element.dispatchEvent(new CustomEvent('vesta:debrief', { bubbles: true })); }
    lastComplete = state.complete;
  }
  update();
  return { element, update, focus() { heading.focus({ preventScroll: true }); }, dispose() { disposed = true; element.remove(); } };
}
