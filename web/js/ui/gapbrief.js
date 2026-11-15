import { createGapBrief, gapBriefJson, gapBriefMarkdown, gapComparisonText, gapQuestionText, GAP_LABELS } from '../core/gapbrief.js';
import { G } from '../core/index.js';
import { download } from './download.js';

const make = (tag, text, name) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (name) node.className = name;
  return node;
};
const STYLES = `
.vesta-gapbrief{font:400 18px/1.45 var(--font,system-ui,sans-serif);color:var(--ivory);width:100%;min-width:0;max-height:80dvh;overflow:auto;overscroll-behavior:contain;box-sizing:border-box;overflow-wrap:anywhere;scrollbar-gutter:stable;text-align:left}
.vesta-gapbrief *{box-sizing:border-box}
.vesta-gapbrief h2{font:600 32px/1.1 var(--display);margin:0 0 12px}
.vesta-gapbrief h3{font:600 25px/1.15 var(--display);margin:24px 0 12px}
.vesta-gapbrief p{margin:0 0 12px}
.vesta-gapbrief small{display:block;font:400 14px/1.4 var(--font);color:var(--ivory-dim);margin:8px 0}
.vesta-gapbrief ul{list-style:none;margin:0;padding:0}
.vesta-gapbrief li{padding:14px 0;border-bottom:1px solid var(--line)}
.vesta-gapbrief button,.vesta-gapbrief summary{font:inherit;color:inherit;cursor:pointer;min-height:44px}
.vesta-gapbrief .wg-actions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.vesta-gapbrief .wg-actions button{border:1px solid var(--line-strong);background:var(--bg-1);padding:8px 14px;border-radius:var(--r-panel)}
.vesta-gapbrief button:disabled{opacity:.5;cursor:wait}
.vesta-gapbrief button:focus-visible,.vesta-gapbrief summary:focus-visible{outline:2px solid var(--amber);outline-offset:3px}
.vesta-gapbrief .wg-phrase{border:0;border-bottom:1px dotted var(--amber);border-radius:0;padding:0;background:transparent;text-align:left;white-space:normal;height:auto}
.vesta-gapbrief details{border-top:1px solid var(--line);padding:12px 0}
.vesta-gapbrief summary{padding:8px 0;color:var(--amber)}
.vesta-gapbrief .wg-finding{margin-top:12px}
.vesta-gapbrief .wg-caption{color:var(--ivory-dim)}
`;

export function build(world) {
  const { db } = world, controller = new AbortController();
  const element = make('section', null, 'vesta-gapbrief');
  element.setAttribute('aria-label', 'Cabin research gaps');
  element.dataset.gapbrief = 'loading';
  const style = make('style', STYLES);
  const title = make('h2', 'Research gaps');
  const actions = make('div', null, 'wg-actions');
  const markdown = make('button', 'Save Markdown'), json = make('button', 'Save gap JSON');
  markdown.type = json.type = 'button';
  markdown.dataset.gapExport = 'markdown'; json.dataset.gapExport = 'json';
  actions.append(markdown, json);
  const status = make('p', 'Reading the current collection…');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const content = make('div');
  const disclosure = make('small');
  element.append(style, title, disclosure, actions, status, content);
  let documentValue = null, generation = 0, disposed = false;
  const cite = (text, id) => {
    const node = world.cite(text, id);
    node.classList.add('wg-phrase');
    return node;
  };
  const question = c => {
    const line = make('li');
    line.dataset.gapQuestion = c.id;
    const source = c.comparison?.id ?? c.lead_finding?.id ?? c.coverage_source;
    const heading = make('p'); heading.append(cite(gapQuestionText(c), c.status === 'NEVER_TESTED' ? c.coverage_source : source));
    line.append(heading);
    if (c.comparison) {
      const conditions = make('p'); conditions.append(cite(gapComparisonText(c.comparison), c.comparison.id));
      line.append(conditions);
    }
    if (c.lead_finding) {
      const f = make('p', null, 'wg-finding');
      f.append(make('small', c.lead_finding.related_only ? 'Related only, does not answer this question' : `Relevant finding, relevance ${c.lead_finding.relevance}`), cite(c.lead_finding.related_only ? 'Related evidence does not answer this question.' : 'Read the highest-ranked finding for this question.', c.lead_finding.id));
      line.append(f);
    }
    const row = c.sources.find(s => s.row_id);
    if (!c.comparison && row) {
      const p = make('p'); p.append(cite('Related material row, a different question.', row.row_id)); line.append(p);
    }
    return line;
  };
  const render = brief => {
    content.replaceChildren();
    const q = brief.query;
    content.append(make('p', `Oxygen ${q.oxygen_percent ?? 'unknown'}% · ${q.pressure_kpa ?? 'unknown'} kPa · ${G[q.gravity]?.label ?? q.gravity_class ?? 'unknown'}`, 'wg-caption'));
    const summary = make('p'); summary.append(cite(`${brief.coverage.NEVER_TESTED} without evidence · ${brief.coverage.EXTRAPOLATED} extrapolated · ${brief.coverage.PROVEN} nearby`, 'design-coverage'));
    content.append(summary, make('h3', 'Questions to test first'));
    const agenda = make('ul'); agenda.dataset.gapAgenda = '';
    for (const a of brief.agenda) {
      const c = brief.questions.find(c => c.id === a.question_id), li = make('li');
      li.append(cite(`${c.material}: ${c.concern}`, c.coverage_source), make('p', `${GAP_LABELS[c.status]}. Related context: ${a.related_findings} findings, ${a.related_rows} source-table rows.`));
      agenda.append(li);
    }
    if (!brief.agenda.length) agenda.append(make('li', 'No unanswered or extrapolated questions in the indexed material set.'));
    content.append(agenda);
    const method = make('details'); method.dataset.gapRule = '';
    method.append(make('summary', 'Why these questions?'), make('p', brief.method.priority_rule), make('p', brief.method.priority_limit), make('p', brief.method.universe));
    content.append(method);
    for (const state of ['NEVER_TESTED', 'EXTRAPOLATED', 'PROVEN']) {
      const list = brief.questions.filter(c => c.status === state), section = make('details');
      section.dataset.gapGroup = state;
      section.append(make('summary', `${GAP_LABELS[state]} (${list.length})`));
      const questions = make('ul');
      for (const c of list) questions.append(question(c));
      if (!list.length) questions.append(make('li', 'None.'));
      section.append(questions); content.append(section);
    }
    const limits = make('details');
    limits.append(make('summary', 'Matching and limits'), make('p', `Nearby means oxygen within ${brief.method.tolerances.oxygen_percentage_points} percentage points and pressure within ${brief.method.tolerances.pressure_kpa} kPa on the same row at the same gravity class.`));
    for (const text of brief.method.limits) limits.append(make('p', text));
    limits.append(make('p', 'Keep the evidence receipt to recheck the underlying coverage. This brief does not replace it.'));
    content.append(limits);
    disclosure.textContent = `${brief.scope} ${brief.disclosure}`;
  };
  async function update(q) {
    if (disposed) return;
    const ticket = ++generation;
    documentValue = null;
    markdown.disabled = json.disabled = true;
    element.setAttribute('aria-busy', 'true'); element.dataset.gapbrief = 'loading';
    content.replaceChildren(); disclosure.textContent = '';
    status.textContent = 'Reading the current collection…';
    try {
      const brief = await createGapBrief(db, q);
      if (disposed || ticket !== generation) return;
      render(brief);
      documentValue = brief;
      markdown.disabled = json.disabled = false;
      status.textContent = '';
      element.dataset.gapbrief = 'ready';
      return brief;
    } catch (error) {
      if (disposed || ticket !== generation) return;
      status.textContent = `The gap brief could not be built. ${error.message}`;
      element.dataset.gapbrief = 'error';
    } finally {
      if (!disposed && ticket === generation) element.setAttribute('aria-busy', 'false');
    }
  }
  const save = format => {
    if (!documentValue) return;
    try {
      const isJson = format === 'json';
      download(`vesta-gap-brief.${isJson ? 'json' : 'md'}`, isJson ? gapBriefJson(documentValue) : gapBriefMarkdown(documentValue), isJson ? 'application/json' : 'text/markdown;charset=utf-8');
      status.textContent = `${isJson ? 'JSON' : 'Markdown'} download prepared.`;
    } catch (error) { status.textContent = `Download failed. ${error.message}`; }
  };
  markdown.addEventListener('click', () => save('markdown'), { signal: controller.signal });
  json.addEventListener('click', () => save('json'), { signal: controller.signal });
  for (const event of ['pointerdown', 'wheel', 'click']) element.addEventListener(event, e => e.stopPropagation(), { signal: controller.signal });
  update(world.q);
  return { element, update, getDocument: () => documentValue,
    dispose() { disposed = true; generation++; documentValue = null; controller.abort(); element.remove(); } };
}
