// A view only: every sentence and number comes from core/next-experiments.js.
import { nextExperiments, separationText } from '../core/next-experiments.js';
import * as textCore from '../core/text.js';

const node = (tag, text, className = '') => {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
};
function ensureStyles() {
  if (document.querySelector('link[data-next-experiments-styles]')) return;
  const link = node('link'); link.rel = 'stylesheet'; link.href = new URL('../../css/next-experiments.css?v=1', import.meta.url).href;
  link.dataset.nextExperimentsStyles = ''; document.head.append(link);
}

/**
 * Collapsed by default; open when the cabin has zero nearby questions, until the visitor toggles it.
 * cite(label, id) returns the host's citable node for a source row; onOpen(material, concern) opens that question.
 */
export function createNextExperimentsPanel({ db, cite, onOpen, core = {} } = {}) {
  ensureStyles();
  const text = core.text ?? textCore, model = q => nextExperiments(q, db, core.status ? { status: core.status, text } : undefined);
  const element = node('details', null, 'next-experiments');
  const summary = node('summary'), body = node('div', null, 'next-experiments-body');
  element.append(summary, body);
  let touched = false, current = null;
  const onSummary = () => { touched = true; };
  const onClick = event => {
    const button = event.target.closest?.('[data-next-material]');
    if (button && element.contains(button)) onOpen?.(button.dataset.nextMaterial, button.dataset.nextConcern);
  };
  summary.addEventListener('click', onSummary); body.addEventListener('click', onClick);

  function item(entry) {
    const li = node('li'), label = `${db.materials[entry.material]?.label ?? entry.material} · ${text.concern(entry.concern)}`;
    const head = node('p', null, 'next-experiments-question');
    if (onOpen) {
      const button = node('button', label); button.type = 'button';
      button.dataset.nextMaterial = entry.material; button.dataset.nextConcern = entry.concern;
      button.title = `Open ${label}`; head.append(button);
    } else head.append(node('strong', label));
    const row = node('p', 'Nearest source row: ', 'next-experiments-row');
    row.append(cite ? cite(entry.nearest.id, entry.nearest.id) : node('span', entry.nearest.id));
    if (entry.nearest.investigation) row.append(document.createTextNode(` · ${entry.nearest.investigation}`));
    const parts = node('ul', null, 'next-experiments-differences');
    for (const part of entry.separates) parts.append(node('li', separationText(part, { text })));
    li.append(head, row, parts);
    return li;
  }

  function update(q) {
    current = model(q);
    summary.textContent = current.summary;
    const nodes = [node('p', current.sentence, 'next-experiments-lead')];
    if (current.campaign.materials.length) {
      nodes.push(node('p', current.campaign.materials.map(m => m.label).join(', '), 'next-experiments-materials'));
      if (current.after) nodes.push(node('p', current.after, 'next-experiments-note'));
    }
    if (current.total) nodes.push(node('p', current.firstSentence, 'next-experiments-note'));
    if (current.recover) nodes.push(node('p', current.recover, 'next-experiments-note'));
    if (current.conditions && current.top.length) {
      nodes.push(node('h3', `Closest ${current.top.length} of ${current.items.length}: what separates the nearest row`));
      const list = node('ol', null, 'next-experiments-list');
      for (const entry of current.top) list.append(item(entry));
      nodes.push(list);
    }
    nodes.push(node('p', current.limits, 'next-experiments-limits'));
    body.replaceChildren(...nodes);
    element.dataset.nextNearby = String(current.nearby);
    if (!touched) element.open = current.total > 0 && current.nearby === 0;
    return current;
  }

  return { element, update, get model() { return current; },
    dispose() { summary.removeEventListener('click', onSummary); body.removeEventListener('click', onClick); element.remove(); } };
}
