import { buildRowComparison } from '../core/row-comparison.js?v=review-workbench-20261115-1';
import { rowSourceLink } from '../core/source-locator.js?v=habitat-20261115-1';

const node = (tag, text, className = '') => {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const detail = label => { const element = node('details'); element.append(node('summary', label)); return element; };
const basis = value => ({ 'facility-inferred': 'Facility-inferred', reported: 'Reported field',
  'reported ambient value': 'Reported ambient value', 'source context': 'Source context',
  'source description': 'Source description', unknown: 'Unknown' }[value] || value);
function ensureStyles() {
  if (document.querySelector('link[data-row-comparison-style]')) return;
  const link = node('link'); link.rel = 'stylesheet'; link.href = new URL('../../css/row-comparison.css?v=review-workbench-20261115-1', import.meta.url).href;
  link.dataset.rowComparisonStyle = ''; document.head.append(link);
}
function link(label, href) {
  const element = node('a', label); element.href = href; element.target = '_blank'; element.rel = 'noopener noreferrer'; return element;
}
function renderDimension(dimension) {
  const block = node('section', null, 'row-comparison-dimension'); block.dataset.comparisonField = dimension.key;
  const title = node('h5', dimension.label), result = node('p', dimension.comparison_label, 'row-comparison-state');
  block.append(title, result);
  const values = node('dl', null, 'row-comparison-values');
  for (const value of dimension.values) {
    const group = node('div'); group.append(node('dt', value.row_id));
    const cell = node('dd'); cell.append(node('span', value.text), node('small', basis(value.basis), 'row-comparison-basis'));
    if (value.raw && value.raw.replace(/\s+/g, ' ').trim() !== String(Array.isArray(value.value) ? value.value.join('–') : value.value).replace(/\s+/g, ' ').trim()) {
      const original = detail('Original value'); original.append(node('p', value.raw)); cell.append(original);
    }
    group.append(cell); values.append(group);
  }
  block.append(values);
  for (const note of [...new Set(dimension.values.map(v => v.note).filter(Boolean))]) block.append(node('p', note, 'row-comparison-note'));
  return block;
}

/** Descriptive source selection only; never changes the saved cabin or material question. */
export function createRowComparison({ db, onOpen } = {}) {
  ensureStyles();
  const element = detail('Compare exact source rows'); element.className = 'row-comparison';
  element.setAttribute('aria-label', 'Exact source-row comparison');
  const intro = node('p', 'Compare two or three returned rows.', 'row-comparison-note');
  const choices = node('fieldset', null, 'row-comparison-choices'); choices.append(node('legend', 'Rows included'));
  const status = node('p', '', 'row-comparison-message'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const body = node('div'); element.append(intro, choices, status, body);
  let disposed = false, available = [], selected = [], query = null, lastKey = '';
  function paint() {
    if (disposed) return;
    body.replaceChildren();
    if (selected.length < 2) { status.textContent = available.length < 2 ? 'Fewer than two source rows are available for this question.' : 'Select at least two rows to compare.'; return; }
    let model;
    try { model = buildRowComparison(db, selected, query); }
    catch (error) { status.textContent = error.message; return; }
    element.style.setProperty('--row-comparison-columns', String(model.records.length));
    status.textContent = `${model.records.length} selected · Equal values do not establish experimental control.`;
    const actions = node('div', null, 'row-comparison-actions');
    actions.setAttribute('aria-label', 'Inspect selected source rows');
    const sources = node('div', null, 'row-comparison-sources');
    for (const source of model.records) {
      const open = node('button', `Inspect ${source.id}`); open.type = 'button'; open.dataset.compareOpen = source.id; open.disabled = typeof onOpen !== 'function'; actions.append(open);
      const record = node('section'); record.append(node('h4', `${source.id}${source.label ? ` · ${source.label}` : ''}`));
      record.append(node('p', `${source.investigation} · ${source.date || 'date not reported'} · ${source.row_kind?.replaceAll('_', ' ') || 'row kind not stated'}`, 'row-comparison-note'));
      const origin = rowSourceLink({ psi_url: source.source_url, table_file: source.table, row: source.row });
      record.append(origin.url ? link(`${origin.label} ↗`, origin.url) : node('p', origin.label, 'row-comparison-note'));
      record.append(node('p', origin.locator, 'row-comparison-note'));
      if (source.pressure_inference_url) record.append(link('Pressure assumption source', source.pressure_inference_url));
      sources.append(record);
    }
    body.append(actions, node('h4', 'Fields used by cabin matching'));
    for (const dimension of model.dimensions.filter(d => d.used_by_cabin_match)) body.append(renderDimension(dimension));
    const locators = detail(`Source locators · ${model.records.length} rows`); locators.className = 'row-comparison-locators'; locators.append(sources); body.append(locators);
    const context = detail('Outside matching: specimen, airflow, ignition & suppressant'); context.className = 'row-comparison-context';
    context.append(node('p', model.matching_limit, 'row-comparison-note'));
    for (const dimension of model.dimensions.filter(d => !d.used_by_cabin_match)) context.append(renderDimension(dimension));
    body.append(context);
    if (model.settings.length) {
      const settings = detail('Original apparatus settings'); settings.append(node('p', 'Settings are shown in their source units. They are not converted into airflow.', 'row-comparison-note'));
      for (const dimension of model.settings) settings.append(renderDimension(dimension)); body.append(settings);
    }
    const outcomes = detail('Recorded outcomes · not predictions'); outcomes.append(node('p', model.outcome_limit, 'row-comparison-note'));
    for (const dimension of model.outcomes) outcomes.append(renderDimension(dimension));
    if (!model.outcomes.length) outcomes.append(node('p', 'No outcome fields are available for these rows.'));
    body.append(outcomes);
    if (model.cross_investigation) body.append(node('p', 'These rows come from different investigations. Apparatus and experimental purpose may differ.', 'row-comparison-note'));
    body.append(node('p', 'These are representative nearest rows returned for this question, not the full collection or an exhaustive study comparison.', 'row-comparison-note'),
      node('p', model.scope, 'row-comparison-note'), node('p', model.unknown_limit, 'row-comparison-note'));
  }
  const onChange = event => {
    if (disposed || !event.target.matches?.('input[data-comparison-row]')) return;
    selected = [...choices.querySelectorAll('input[data-comparison-row]:checked')].map(input => input.value); paint();
  };
  const onClick = event => {
    const button = event.target.closest?.('button[data-compare-open]');
    if (!disposed && button && selected.includes(button.dataset.compareOpen)) onOpen?.(button.dataset.compareOpen);
  };
  choices.addEventListener('change', onChange); body.addEventListener('click', onClick);
  function update(rowIds, nextQuery) {
    if (disposed) return;
    const ids = [...rowIds], key = JSON.stringify([ids, nextQuery]);
    if (key === lastKey) return;
    lastKey = key; query = { ...nextQuery };
    if (JSON.stringify(ids) !== JSON.stringify(available)) {
      available = ids; selected = [...ids]; choices.replaceChildren(node('legend', 'Rows included'));
      for (const id of available) {
        const label = node('label'), input = node('input'); input.type = 'checkbox'; input.value = id; input.checked = true; input.dataset.comparisonRow = '';
        label.append(input, node('span', id)); choices.append(label);
      }
    }
    choices.hidden = available.length < 2; element.hidden = available.length === 0; paint();
  }
  return { element, update, expand() { if (!disposed && available.length) element.open = true; },
    dispose() { disposed = true; choices.removeEventListener('change', onChange); body.removeEventListener('click', onClick); element.remove(); } };
}
