import * as status from '../core/status.js';
import * as ranking from '../core/rank.js';
import * as text from '../core/text.js';
import { CONCERNS } from '../core/index.js';
import { TOL } from '../core/match.js';
import { renderMatchPanel, renderFindingComparison } from '../ui/matchpanel.js?v=habitat-20261115-1';
import { nearestSourceRows, scoreFactors } from '../core/evidence-register.js?v=habitat-20261115-1';
import { scorebar } from '../ui/scorebar.js';
import { pressureDependence, pressureDependenceText, pressureAudit, pressureAuditText, PRESSURE_DEPENDENCE_SCOPE } from '../core/assumption-audit.js';
import { createQuestionNote } from '../core/question-note.js?v=question-lab-20261115-3';
import { questionSummary } from '../core/question-summary.js?v=flex-review-20261115-1';

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
  return { cells, counts, total: cells.length, cabin, pressureAudit: pressureAudit(cells, db),
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
  return { cell, pressureDependence: pressureDependence(cell, db), nearest: core.status.nearestRow(material, concern, q, db), nearestRows: nearestSourceRows(material, concern, q, db),
    summary: questionSummary(cell, db, { material: db.materials[material]?.label || material, concern: core.text.concern(concern), cabin: db.presetById[q.preset]?.label || 'this cabin' }),
    findings: core.rank.rank(candidates, { ...q, material, concern }, db).slice(0, 3) };
}

export function scoreExplanation(entry, rank = ranking) {
  const sum = Object.values(entry.parts).reduce((value, part) => value + part, 0);
  return { sum, multiplier: entry.f.n.support === 'direct' ? 1 : rank.PARTIAL_SUPPORT, total: entry.total };
}

export function build(world, { onSelection, onInspectAll, onSaveReview, onPrepareCrew } = {}) {
  const { db, core = defaults } = world;
  let q = world.q, model, selected = null, disposed = false, lastQuery = '';
  const element = node('section', null, 'coverage-wall');
  element.setAttribute('aria-label', 'Cabin evidence coverage');
  const header = node('header', null, 'coverage-header');
  const title = node('h2'), answer = node('p', null, 'coverage-answer');
  const definition = node('p', `Nearby: same gravity class, O₂ ±${TOL.o2} percentage point and pressure ±${TOL.p} kPa, all on one source row for that material-and-concern question.`, 'coverage-definition');
  const conditions = node('p', null, 'coverage-conditions');
  const live = node('p', null, 'coverage-sr');
  live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
  const pressureBasisLine = node('p', null, 'coverage-conditions coverage-pressure-basis'); pressureBasisLine.hidden = true;
  pressureBasisLine.title = PRESSURE_DEPENDENCE_SCOPE;
  header.append(title, answer, definition, conditions, pressureBasisLine, live);
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
    const expanded = new Set([...detail.querySelectorAll('[data-score-finding][open]')].map(el => el.dataset.scoreFinding));
    const { material, concern } = selected;
    const { cell, pressureDependence: dependence, nearest, nearestRows, findings, summary } = question(material, concern, q, db, core);
    const back = node('button', '← All questions', 'coverage-back'); back.type = 'button';
    back.dataset.coverageBack = ''; back.onclick = () => closeDetail();
    const point = { ...q, material, concern };
    const heading = node('h3', `${db.materials[material].label} · ${core.text.concern(concern)}`);
    heading.tabIndex = -1;
    const state = node('p', `${symbols[cell.status]} ${summary.answer}`, 'coverage-state coverage-summary-answer');
    state.dataset.coverageStatus = cell.status;
    const cabinLine = node('p', `${db.presetById[q.preset]?.label || 'Custom cabin'} · ${core.text.oxygen(q.o2)} · ${core.text.pressure(q.p)} · ${q.g_label || core.text.gravity(q.gclass)}`, 'coverage-question-cabin');
    const quick = node('section', null, 'coverage-question-summary');quick.setAttribute('aria-label','Question answer');
    quick.append(state);
    // Count + pressure assumption (or the actual coverage gap) remain visible.
    // The longer method text stays available below without repeating the answer.
    for(const [index,line] of summary.lines.slice(0,2).entries()){
      const text=node('p',line,'coverage-summary-line');
      if(cell.status==='PROVEN'&&index===1){text.classList.add('coverage-pressure-basis');text.dataset.pressureReported=String(dependence.reported);text.dataset.pressureInferred=String(dependence.inferred);}
      quick.append(text);
    }
    const next=node('p',null,'coverage-summary-next');next.append(node('strong','Next: '),document.createTextNode(summary.next));
    quick.append(next,node('p','Coverage, not safety.','coverage-summary-scope'));
    detail.replaceChildren(back, heading, cabinLine, quick);
    const reviewActions = node('div', null, 'coverage-review-actions'), reviewStatus = node('p', null, 'coverage-review-status');
    reviewStatus.setAttribute('role', 'status'); reviewStatus.setAttribute('aria-live', 'polite'); reviewStatus.hidden = true;
    for (const [label, action, id] of [['Save question review', onSaveReview, 'save'], ['Prepare crew review', onPrepareCrew, 'crew']]) {
      if (!action) continue;
      const button = node('button', label); button.type = 'button'; button.dataset.questionReview = id;
      button.onclick = () => { try { const message = action(point); if (message) { reviewStatus.textContent = message; reviewStatus.hidden = false; } }
        catch (error) { reviewStatus.textContent = error.message; reviewStatus.hidden = false; } };
      reviewActions.append(button);
    }
    detail.append(reviewActions, reviewStatus);
    const limits = node('details', null, 'coverage-question-limits');
    limits.append(node('summary', 'Method & limits'));
    for(const line of summary.lines.slice(2))limits.append(node('p',line));
    try { const note = createQuestionNote(db, point); if(summary.lines.length<3)limits.append(node('p', note.limits[1])); limits.append(node('p', 'The saved note is derived text. Keep the evidence JSON separately for replay.')); }
    catch { limits.append(node('p', 'Complete the cabin conditions before preparing a review note.')); }
    detail.append(limits);
    if (dependence.nearby) {
      const basis = node('p', `${pressureDependenceText(dependence)} ${PRESSURE_DEPENDENCE_SCOPE}`, 'coverage-nearest-rule coverage-pressure-basis');
      basis.dataset.pressureReported = String(dependence.reported); basis.dataset.pressureInferred = String(dependence.inferred);
      limits.append(basis);
    }
    if (cell.status === 'NEVER_TESTED') {
      limits.append(renderMatchPanel(null, q, db), node('p', 'No finding is available for this question, so no relevance score is calculated.', 'coverage-score-note'));
      detail.hidden = false; detail.scrollTop = 0; element.dataset.detail = 'true';
      if (focus) heading.focus({ preventScroll: true });
      return;
    }
    const sentence = node('p', core.text.cellSentence(cell, db.materials[material].label, db));
    limits.append(sentence);
    if (nearest) {
      const { row, note } = nearest;
      detail.append(node('h4', 'Source & compared conditions'));
      const ordering = node('details', null, 'coverage-nearest-order');
      ordering.append(node('summary', 'Why this source row?'), node('p', 'For this material + concern: fewest failed conditions first. Ties use the smallest O₂ gap, then pressure gap, then row ID. This order does not establish experimental equivalence.', 'coverage-nearest-rule'));
      const rowLine = node('p');
      const pressure = core.text.pressure(row.n.p ?? row.n.p_inferred)
        + (note.includes('pressure_inferred') ? ` (${core.text.reason('pressure_inferred')})` : '');
      cited(rowLine, `${row.id} · ${db.invById[row.psi_id]?.name || row.investigation || 'Recorded conditions'}: ${core.text.oxygen(row.n.o2)}, ${pressure}, ${core.text.gravity(row.n.gclass)}.`, row.id);
      detail.append(rowLine);
      detail.append(renderMatchPanel(row, q, db), ordering);
      if (nearestRows.length > 1) {
        const alternatives = node('details', null, 'coverage-nearest-list');
        alternatives.append(node('summary', `Next ${nearestRows.length - 1} nearest source rows`));
        for (const next of nearestRows.slice(1)) {
          const line = node('p'); cited(line, `${next.row.id} · ${next.row.investigation || 'Source row'} · ${next.fail.length} unmatched conditions`, next.row.id);
          alternatives.append(line, renderMatchPanel(next.row, q, db));
        }
        alternatives.append(node('p', 'These are source rows, not necessarily independent tests. The order describes matching-rule differences, not physical similarity.', 'coverage-score-note'));
        detail.append(alternatives);
      }
    } else detail.append(node('p', 'No source-table row for this question in VESTA’s collection.', 'coverage-empty'), renderMatchPanel(null, q, db));
    const browse = node('div', null, 'coverage-browse-all');
    if (onInspectAll) for (const [mode, count, label] of [['findings', cell.finding_ids.length, 'findings'], ['rows', cell.rows, 'source rows']]) {
      const button = node('button', mode === 'rows' ? 'Inspect source-row register' : `Inspect all ${count} ${label}`); button.type = 'button';
      button.onclick = () => onInspectAll({ mode, material, concern }); browse.append(button);
    }
    detail.append(browse);
    if (findings.length) {
      detail.append(node('h4', `Top ${findings.length} of ${cell.finding_ids.length} relevant findings`));
      const list = node('ul', null, 'coverage-findings');
      for (const entry of findings) {
        const { f, total } = entry;
        const li = node('li'), phrase = node('p');
        cited(phrase, f.claim || f.title || f.quote, f.id);
        li.append(phrase, node('p', `${total}/100 relevance · ${core.text.level(f)}`, 'coverage-finding-meta'), renderFindingComparison(f, { ...q, material, concern }, db));
        const why = node('details', null, 'coverage-score-why'); why.dataset.scoreFinding = f.id; why.open = expanded.has(f.id);
        why.append(node('summary', 'Why this score + coverage'));
        const terms = core.text.terms(entry, { ...q, material, concern });
        const bar = scorebar(entry, { small: true, meaning: false, weights: core.rank.W, sentences: Object.fromEntries(terms.map(term => [term.key, term.sentence])) });
        for (const slot of bar.querySelectorAll('[tabindex]')) slot.removeAttribute('tabindex');
        why.append(bar);
        const values = node('dl', null, 'coverage-score-parts');
        for (const term of terms.filter(term => term.key !== 'support')) {
          const value = entry.parts[term.key], dd = node('dd', `${Number(value.toFixed(6))} / ${term.max}`); dd.title = String(value);
          values.append(node('dt', term.label), dd);
        }
        const calculation = scoreExplanation(entry, core.rank), formula = node('p', null, 'coverage-score-formula');
        formula.textContent = `round(${Number(calculation.sum.toFixed(6))} × ${calculation.multiplier}) = ${total}/100`;
        formula.title = `Unrounded component sum: ${calculation.sum}. Support multiplier: ${calculation.multiplier}.`;
        formula.dataset.scoreSum = String(calculation.sum); formula.dataset.scoreMultiplier = String(calculation.multiplier); formula.dataset.scoreTotal = String(total);
        const arithmetic = node('div', null, 'coverage-score-calculation'); arithmetic.append(values, formula);
        why.append(arithmetic, node('p', `Support: ${f.n.support === 'direct' ? 'direct' : 'partial'}. Values shown to six decimals; the total uses unrounded parts.`, 'coverage-score-note'));
        const factors = scoreFactors(f, { ...q, material, concern }, db);
        why.append(node('p', factors.explanation, 'coverage-score-note'), node('p', factors.excluded, 'coverage-score-note'));
        const explanation = node('details', null, 'coverage-score-terms'); explanation.append(node('summary', 'Component explanations'));
        for (const term of terms) explanation.append(node('p', `${term.label}: ${term.sentence}`));
        why.append(explanation, node('p', `Relevance ranks findings. Coverage checks source rows against gravity, oxygen and pressure. A higher score adds no tested conditions.`, 'coverage-score-note'));
        li.append(why); list.append(li);
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
    const key = JSON.stringify([nextQ.preset, nextQ.o2, nextQ.p, nextQ.gclass, nextQ.g_label, nextQ.habitat]);
    if (key === lastQuery) return;
    lastQuery = key;
    q = { ...nextQ }; model = coverage(q, db, core);
    title.textContent = model.cabin;
    answer.replaceChildren(); cited(answer, model.sentence, 'design-coverage');
    conditions.replaceChildren();
    if (db.presetById[q.preset]) cited(conditions, model.conditions, q.preset);
    else conditions.textContent = model.conditions;
    live.textContent = `${model.headline} ${model.counts.EXTRAPOLATED} ${core.text.status('EXTRAPOLATED')}; ${model.counts.NEVER_TESTED} ${core.text.status('NEVER_TESTED')} in VESTA’s collection.`;
    pressureBasisLine.textContent = pressureAuditText(model.pressureAudit); pressureBasisLine.hidden = !model.pressureAudit.nearby;
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
