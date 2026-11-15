import * as status from '../core/status.js';
import * as ranking from '../core/rank.js';
import * as text from '../core/text.js';
import { CONCERNS } from '../core/index.js';

const defaults = { status, rank: ranking, text };
const symbols = { PROVEN: '●', EXTRAPOLATED: '↗', NEVER_TESTED: '×' };
const meanings = { PROVEN: 'Within matching rules', EXTRAPOLATED: 'Different or incomplete support', NEVER_TESTED: 'In this collection' };
const node = (tag, value, cls) => {
  const el = document.createElement(tag);
  if (value != null) el.textContent = value;
  if (cls) el.className = cls;
  return el;
};

export function coverage(q, db, core = defaults) {
  const cells = core.status.cells(q, db), counts = core.status.tally(cells);
  const cabin = db.presetById[q.preset]?.label || 'Custom cabin';
  return { cells, counts, total: cells.length, cabin,
    headline: `${cabin}: ${counts.PROVEN}/${cells.length} questions have nearby-condition evidence.`,
    sentence: `${counts.PROVEN} of ${cells.length} questions have nearby-condition evidence`,
    conditions: `${core.text.oxygen(q.o2)} · ${core.text.pressure(q.p)} · ${q.g_label || core.text.gravity(q.gclass)}` };
}

export function headline(q, db, core = defaults) {
  return coverage(q, db, core).headline;
}

export function question(material, concern, q, db, core = defaults) {
  const cell = core.status.cell(material, concern, q, db);
  const candidates = cell.finding_ids.map(id => db.findingById[id]).filter(Boolean);
  return { cell, nearest: core.status.nearestRow(material, concern, q, db),
    findings: core.rank.rank(candidates, { ...q, material, concern }, db).slice(0, 3) };
}

export function build(world, { onSelection } = {}) {
  const { db, core = defaults } = world;
  let q = world.q, model, selected = null, disposed = false, lastQuery = '';
  const element = node('section', null, 'coverage-wall');
  element.setAttribute('aria-label', 'Cabin evidence coverage');
  const header = node('header', null, 'coverage-header');
  const title = node('h2'), answer = node('p', null, 'coverage-answer');
  const conditions = node('p', null, 'coverage-conditions');
  const live = node('p', null, 'coverage-sr');
  live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
  header.append(title, answer, conditions, live);
  const legend = node('dl', null, 'coverage-legend');
  const totals = {};
  for (const id of Object.keys(symbols)) {
    const item = node('div'); item.dataset.coverageStatus = id;
    const count = node('dd'), label = node('dt', `${symbols[id]} ${core.text.status(id)}`);
    item.append(count, label, node('span', meanings[id])); legend.append(item); totals[id] = count;
  }
  const layout = node('div', null, 'coverage-layout');
  const overview = node('div', null, 'coverage-overview');
  const table = node('table', null, 'coverage-matrix');
  const caption = node('caption', 'Open a material question');
  const thead = node('thead'), head = node('tr');
  const materialHead = node('th', 'Material'); materialHead.scope = 'col'; head.append(materialHead);
  for (const concern of CONCERNS) {
    const th = node('th', core.text.concern(concern)); th.scope = 'col'; head.append(th);
  }
  thead.append(head); const tbody = node('tbody'); table.append(caption, thead, tbody); overview.append(table);
  const detail = node('section', null, 'coverage-detail'); detail.hidden = true;
  detail.setAttribute('aria-label', 'Question evidence');
  layout.append(overview, detail);
  const scope = node('details', null, 'coverage-scope');
  scope.append(node('summary', 'VESTA collection coverage, not safety'), node('p', core.text.legend(db).PROVEN),
    node('p', core.text.legend(db).EXTRAPOLATED), node('p', core.text.legend(db).NEVER_TESTED));
  element.append(header, legend, layout, scope);
  const buttons = new Map();
  for (const [id, material] of Object.entries(db.materials)) {
    const tr = node('tr'), th = node('th', material.label); th.scope = 'row'; tr.append(th);
    for (const concern of CONCERNS) {
      const td = node('td'), button = node('button'); button.type = 'button';
      button.dataset.coverageMaterial = id; button.dataset.coverageConcern = concern;
      button.setAttribute('aria-expanded', 'false');
      td.append(button); tr.append(td); buttons.set(`${id}:${concern}`, button);
    }
    tbody.append(tr);
  }

  function cited(parent, phrase, id) {
    parent.append(world.cite(phrase, id));
  }

  function closeDetail(focus = true) {
    const previous = selected; selected = null; detail.hidden = true;
    onSelection?.(null);
    delete element.dataset.detail;
    for (const button of buttons.values()) button.setAttribute('aria-expanded', 'false');
    if (focus && previous) buttons.get(`${previous.material}:${previous.concern}`)?.focus({ preventScroll: true });
  }

  function paintDetail(focus = false) {
    if (!selected) return;
    const { material, concern } = selected;
    const { cell, nearest, findings } = question(material, concern, q, db, core);
    const back = node('button', '← All questions', 'coverage-back'); back.type = 'button';
    back.dataset.coverageBack = ''; back.onclick = () => closeDetail();
    const heading = node('h3', `${db.materials[material].label} · ${core.text.concern(concern)}`);
    heading.tabIndex = -1;
    const state = node('p', `${symbols[cell.status]} ${core.text.status(cell.status, cell.qualifier)}`, 'coverage-state');
    state.dataset.coverageStatus = cell.status;
    detail.replaceChildren(back, heading, state);
    if (cell.status === 'NEVER_TESTED') {
      detail.append(node('p', `${core.text.status(cell.status)}. ${core.text.cellSentence(cell, db.materials[material].label, db)}`, 'coverage-empty'));
      detail.hidden = false; detail.scrollTop = 0; element.dataset.detail = 'true';
      if (focus) heading.focus({ preventScroll: true });
      return;
    }
    detail.append(node('p', core.text.cellSentence(cell, db.materials[material].label, db)));
    if (nearest) {
      const { row, fail, note, delta } = nearest;
      detail.append(node('h4', 'Nearest source-table row'));
      const rowLine = node('p');
      const pressure = core.text.pressure(row.n.p ?? row.n.p_inferred)
        + (note.includes('pressure_inferred') ? ` (${core.text.reason('pressure_inferred')})` : '');
      cited(rowLine, `${db.invById[row.psi_id]?.name || row.investigation || 'Recorded conditions'}: ${core.text.oxygen(row.n.o2)}, ${pressure}, ${core.text.gravity(row.n.gclass)}.`, row.id);
      detail.append(rowLine);
      const differences = [...fail, ...note].map(code => core.text.reasonSentence(code, { q, delta, n: db }));
      if (!fail.length) differences.unshift('Same gravity class; oxygen and pressure are within VESTA’s tolerances.');
      const explanation = node('p', null, 'coverage-differences');
      cited(explanation, `${fail.length ? 'Differences:' : 'Matched parameters:'} ${differences.join(' ')}`, row.id); detail.append(explanation);
      detail.append(node('p', 'Not matched: airflow, geometry, thickness, ignition and suppressant configuration. A match does not establish safety.', 'coverage-limit'));
    } else detail.append(node('p', 'No source-table row for this question in VESTA’s collection.', 'coverage-empty'));
    if (findings.length) {
      detail.append(node('h4', 'Best-matching findings'));
      const list = node('ul', null, 'coverage-findings');
      for (const { f, total } of findings) {
        const li = node('li'), phrase = node('p');
        cited(phrase, f.claim || f.title || f.quote, f.id);
        li.append(phrase, node('p', `${total}/100 relevance · ${core.text.level(f)}`, 'coverage-finding-meta'));
        list.append(li);
      }
      detail.append(list, node('p', core.text.SCORE_LABEL, 'coverage-limit'));
    } else detail.append(node('p', 'No verified finding in VESTA’s collection names this material and concern. The source-table row above is the available evidence.', 'coverage-empty'));
    detail.hidden = false; detail.scrollTop = 0; element.dataset.detail = 'true';
    if (focus) heading.focus({ preventScroll: true });
  }

  function selectQuestion(material, concern, focus = true) {
    const button = buttons.get(`${material}:${concern}`);
    if (disposed || !button) return false;
    selected = { material, concern };
    for (const other of buttons.values()) other.setAttribute('aria-expanded', String(other === button));
    paintDetail(focus);
    onSelection?.({ ...selected });
    return true;
  }

  function click(event) {
    const button = event.target.closest('[data-coverage-material]');
    if (!button || !element.contains(button)) return;
    selectQuestion(button.dataset.coverageMaterial, button.dataset.coverageConcern);
  }

  function keydown(event) {
    if (event.key === 'Escape' && selected) { event.preventDefault(); event.stopPropagation(); closeDetail(); return; }
    const button = event.target.closest('[data-coverage-material]');
    if (!button) return;
    const keys = [...buttons.keys()], index = keys.indexOf(`${button.dataset.coverageMaterial}:${button.dataset.coverageConcern}`);
    const shift = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: CONCERNS.length, ArrowUp: -CONCERNS.length }[event.key];
    if (shift == null) return;
    event.preventDefault(); event.stopPropagation();
    buttons.get(keys[Math.max(0, Math.min(keys.length - 1, index + shift))])?.focus();
  }

  function update(nextQ) {
    if (disposed) return;
    const key = JSON.stringify([nextQ.preset, nextQ.o2, nextQ.p, nextQ.gclass, nextQ.g_label]);
    if (key === lastQuery) return;
    lastQuery = key;
    q = { ...nextQ }; model = coverage(q, db, core);
    title.textContent = model.cabin;
    answer.replaceChildren(); cited(answer, model.sentence, 'design-coverage');
    conditions.replaceChildren();
    if (db.presetById[q.preset]) cited(conditions, model.conditions, q.preset);
    else conditions.textContent = model.conditions;
    live.textContent = `${model.headline} ${model.counts.EXTRAPOLATED} ${core.text.status('EXTRAPOLATED')}; ${model.counts.NEVER_TESTED} ${core.text.status('NEVER_TESTED')} in VESTA’s collection.`;
    for (const id of Object.keys(totals)) totals[id].textContent = model.counts[id];
    for (const cell of model.cells) {
      const button = buttons.get(`${cell.material}:${cell.concern}`);
      button.textContent = symbols[cell.status]; button.dataset.coverageStatus = cell.status;
      const label = `${db.materials[cell.material].label}, ${core.text.concern(cell.concern)}: ${core.text.status(cell.status)}. ${meanings[cell.status]}. Open evidence.`;
      button.setAttribute('aria-label', label); button.title = label;
    }
    element.dataset.coveragePreset = q.preset || 'custom';
    paintDetail();
  }

  element.addEventListener('click', click); element.addEventListener('keydown', keydown);
  update(q);
  return { element, update, selectQuestion, clearSelection: closeDetail, headline: nextQ => headline(nextQ ?? q, db, core),
    dispose() { disposed = true; element.removeEventListener('click', click); element.removeEventListener('keydown', keydown); detail.replaceChildren(); element.remove(); buttons.clear(); } };
}
