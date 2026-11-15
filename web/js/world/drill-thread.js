const number = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;

export function createDrillModel({ db, core }) {
  const scenario = db.scenario;
  if (!scenario?.meta?.comm || !scenario.frames?.length || !db.playbook?.steps?.length) return null;
  const { meta, frames } = scenario;
  const log = core.officer.run(frames, db, meta);
  if (!log.length) return null;
  const first = log[0].t;
  const shifted = log.map(entry => ({ ...entry, t: entry.t - first }));
  const delay = core.clock.clock(meta, 0, shifted, db);
  const end = Math.max(log.at(-1).t, delay.heard === null ? log.at(-1).t : first + delay.heard);
  return { meta, frames, log, first, end, at(q = {}) {
    const t = number(q.t) ?? frames[0].t;
    const entries = log.filter(entry => entry.t <= t);
    const current = entries.at(-1) ?? null;
    return { t, entries, current, total: log.length, count: entries.length, complete: t >= end,
      clock: core.clock.clock(meta, t - first, shifted, db), silence: q.shot === 'silence' };
  } };
}

export function basisKey(entry) {
  return entry?.state === 'NO_SOURCE' ? 'no_source' : entry?.basis ?? 'no_source';
}

export function evidenceIds(entry, db) {
  return [...new Set((entry?.nasa ?? []).map(item => item.finding_id))].filter(id => db.findingById[id]);
}

export const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
};

export function build(world) {
  const { db, core } = world, model = createDrillModel(world);
  const element = node('section', null, 'vesta-drill-thread');
  element.setAttribute('aria-label', 'Drill progress');
  const style = node('style');
  style.textContent = `
.vesta-drill-thread{box-sizing:border-box;width:100%;min-width:0;color:var(--ivory);background:var(--bg-0);font:18px/1.3 var(--font);padding:12px 16px;border-left:2px solid var(--amber);overflow-wrap:anywhere;pointer-events:auto}
.vesta-drill-thread p{margin:4px 0;font:inherit}.vesta-drill-thread .thread-position{font:14px/1.4 var(--mono);color:var(--amber)}
.vesta-drill-thread .thread-basis{color:var(--ivory-dim)}.vesta-drill-thread button,.vesta-drill-thread a{font:inherit;color:inherit;min-height:44px;touch-action:manipulation}
.vesta-drill-thread :focus-visible{outline:2px solid var(--amber);outline-offset:3px}
`;
  const status = node('div'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
  const position = node('p', null, 'thread-position'), question = node('p'), basis = node('p', null, 'thread-basis');
  status.append(position, question, basis); element.append(style, status);
  let key, disposed = false;
  function update(q = world.q) {
    if (disposed) return;
    if (!model) { position.textContent = 'Drill unavailable'; question.textContent = 'No scripted decisions in this collection.'; return; }
    const state = model.at(q), entry = state.current;
    const nextKey = `${entry?.step}:${state.complete}:${state.silence}`;
    if (nextKey === key) return; key = nextKey;
    element.dataset.step = entry?.step ?? 'standby';
    position.textContent = `${state.count} of ${state.total} decisions${state.complete ? ' · complete' : state.silence ? ' · The Silence' : ''}`;
    question.textContent = entry?.question ?? model.meta.title;
    basis.replaceChildren();
    if (!entry) { basis.textContent = 'Start the scripted drill.'; return; }
    const id = evidenceIds(entry, db)[0] ?? entry.row_ids?.find(id => db.testById[id]);
    const finding = db.findingById[id];
    const label = basisKey(entry) === 'experiment' && finding ? core.text.work(finding.n.work) : core.text.basis(basisKey(entry));
    basis.append(id ? world.cite(label, id) : node('span', label));
  }
  update();
  return { element, update, dispose() { disposed = true; element.remove(); } };
}
