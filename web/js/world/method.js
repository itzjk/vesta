import { TOL } from '../core/match.js';
import { W, SPAN, PARTIAL_SUPPORT } from '../core/rank.js';
import { status, statusMeaning, TERM_LABEL, SCORE_LABEL, CHOICES } from '../core/text.js';
import { sensitivityView } from '../core/tolerance-sensitivity.js';
import { getDb } from '../store.js';

const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
};

const sourceLink = (label, path) => {
  const link = node('a', label);
  link.href = new URL(path, import.meta.url).href;
  link.target = '_blank';
  link.rel = 'noopener';
  return link;
};

export function ensureStyles() {
  const existing = document.querySelector('link[data-vesta-method-styles]');
  if (existing) return existing;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../css/method.css', import.meta.url).href;
  link.dataset.vestaMethodStyles = '';
  document.head.append(link);
  return link;
}

// Recount of nearby evidence under other tolerances. Display only: no label, receipt or export reads it.
export function renderSensitivity(db) {
  if (!db?.presets?.length) return null;
  const view = sensitivityView(db), details = node('details', null, 'method-detail');
  const scroll = node('div'), table = node('table', null, 'method-weights'), head = node('thead'), header = node('tr'), body = node('tbody');
  scroll.style.overflowX = 'auto'; table.style.maxWidth = 'none'; table.style.minWidth = '620px'; table.style.tableLayout = 'auto';
  table.append(node('caption', view.caption));
  for (const label of view.columns) { const th = node('th', label); th.scope = 'col'; header.append(th); }
  for (const item of view.rows) {
    const row = node('tr'), name = node('th', item.label); name.scope = 'row'; row.append(name);
    for (const value of item.cells) { const td = node('td', value); td.style.textAlign = 'right'; row.append(td); }
    body.append(row);
  }
  head.append(header); table.append(head, body); scroll.append(table);
  details.append(node('summary', view.summary), scroll, ...view.notes.map((text, i) => node('p', text, i ? 'method-limit' : null)));
  return details;
}

export function renderMethod({ action, onTopic, db = getDb() }) {
  ensureStyles();
  const section = node('section', null, 'vesta-method');
  section.setAttribute('aria-label', 'Matching method and limits');
  section.append(node('p', 'VESTA compares a material-and-concern question with the loaded evidence collection. Coverage describes matching conditions; relevance orders findings for inspection.', 'method-lead'));

  section.append(
    node('h3', 'Matching conditions'),
    node('p', `For a material-and-concern coverage cell, nearby evidence requires a source-table row in the same gravity class, with oxygen within ${TOL.o2} percentage point and pressure within ${TOL.p} kPa of the cabin. Both conditions must match on the same row. Recorded ranges are preserved; facility-inferred pressure is identified separately.`),
    node('p', 'Airflow, sample geometry, thickness, ignition and suppressant configuration are not matched. A nearby match does not establish experimental equivalence or cabin safety.', 'method-limit')
  );

  const coverage = node('details', null, 'method-detail');
  coverage.append(node('summary', 'Coverage labels and collection scope'));
  const labels = node('dl', null, 'method-labels');
  for (const id of ['PROVEN', 'EXTRAPOLATED', 'NEVER_TESTED']) {
    labels.append(node('dt', status(id)), node('dd', statusMeaning(id)));
  }
  coverage.append(labels, node('p', 'An absent source means VESTA found no row or verified finding for that material and concern in this collection. It does not establish that the question has never been tested elsewhere.'), node('p', 'Finding labels check experimental evidence type and reported conditions; material relevance is shown separately.'));
  section.append(coverage);
  const sensitivity = renderSensitivity(db);
  if (sensitivity) section.append(sensitivity);

  const ranking = node('details', null, 'method-detail');
  ranking.open = true; // the weights are what a technical reader looks for first: shown without a click
  ranking.append(node('summary', 'Relevance weights and scoring limits'), node('p', SCORE_LABEL, 'method-limit'));
  const table = node('table', null, 'method-weights');
  table.append(node('caption', 'Maximum contribution to the finding relevance score'));
  const head = node('thead'), header = node('tr');
  for (const label of ['Factor', 'Maximum points']) {
    const th = node('th', label); th.scope = 'col'; header.append(th);
  }
  head.append(header);
  const body = node('tbody');
  for (const [key, weight] of Object.entries(W)) {
    const row = node('tr'), name = node('th', TERM_LABEL[key] || key);
    name.scope = 'row'; row.append(name, node('td', String(weight))); body.append(row);
  }
  table.append(head, body);
  ranking.append(
    table,
    node('p', 'Within the atmosphere factor, oxygen closeness contributes 70% and pressure closeness 30%. Gravity is a separate factor. These are VESTA’s ranking choices, not validated physical-risk weights.'),
    node('p', `Atmosphere closeness uses spans of ${SPAN.o2} oxygen percentage points and ${SPAN.p} kPa. These ranking spans are separate from the nearby-match tolerances above. The total is multiplied by ${PARTIAL_SUPPORT} when support is not marked direct, then rounded.`),
    node('p', 'A high relevance score does not change the evidence-coverage label or validate an operational decision.'),
    node('p', CHOICES)
  );
  const methodLinks = node('div', null, 'method-links');
  methodLinks.append(sourceLink('Published method constants', '../../api/v1/index.json'), sourceLink('Inspect the ranking formula', '../core/rank.js'));
  ranking.append(methodLinks);
  section.append(ranking);

  const provenance = node('details', null, 'method-detail');
  provenance.append(
    node('summary', 'Provenance and validation limits'),
    node('p', 'Source-table totals include individual tests, test days, series, group references, sessions and dataset-index entries. Their total is not a count of independent burns.'),
    node('p', 'SI assisted evidence preparation. Matching, ranking and playbook rules run deterministically without a model call. Quote gates check source-text correspondence, not scientific correctness. Attributed NASA quotations and original table cells remain distinct from VESTA’s interpretations.'),
    node('p', 'Rechecking an evidence receipt tests reproducibility against the loaded collection. The reviewed cases check expected software behavior. Neither independently validates the science.'),
    node('p', 'Try the reviewed Kapton prevention case: no row or verified finding answers that question in this collection. Compare it with lunar PMMA: relevant evidence exists, but its conditions do not match the cabin.'),
    sourceLink('Read the evidence provenance', '../../data/si-provenance.json')
  );
  section.append(provenance);

  const actions = node('div', null, 'method-actions');
  actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', 'Inspect and reproduce evidence');
  actions.append(
    action('Inspect evidence', 'evidence', 'overview'),
    action('Export or recheck JSON', 'evidence', 'receipt'),
    action('Review cases', 'trust', 'checks')
  );
  section.append(actions);

  if (typeof onTopic === 'function') {
    const related = node('nav', null, 'method-related');
    related.setAttribute('aria-label', 'Related mission topics');
    for (const [id, label] of [['agents', 'Software roles'], ['robotics', 'Robotics concept']]) {
      const button = node('button', label); button.type = 'button'; button.onclick = () => onTopic(id); related.append(button);
    }
    section.append(related);
  }
  return section;
}
