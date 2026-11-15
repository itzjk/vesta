import { matchPanel } from '../core/matchpanel.js?v=16';

const states = { matched: ['✓', 'Matched'], different: ['≠', 'Not matched'], 'not-compared': ['∅', 'Not compared'] };
// One-word names for the summary strip; the full names stay in the rows below it.
const short = { gravity: 'Gravity', oxygen: 'Oxygen', pressure: 'Pressure', airflow: 'Airflow', geometry: 'Geometry', thickness: 'Thickness', ignition: 'Ignition', suppressant: 'Suppressant' };
const node = (tag, cls, value) => {
  const element = document.createElement(tag);
  element.className = cls;
  if (value != null) element.textContent = value;
  return element;
};

function ensureStyle() {
  if (!document.querySelector('link[data-matchpanel-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'css/matchpanel.css?v=16'; link.dataset.matchpanelStyle = '';
    document.head.append(link);
  }
}

if (typeof document !== 'undefined') ensureStyle();

export function renderMatchPanel(row, cabin, db) {
  ensureStyle();
  const model = matchPanel(row, cabin, db), panel = node('section', 'matchpanel');
  panel.setAttribute('aria-label', 'Source row comparison and limits');
  if (model.rowId) panel.dataset.matchpanelRow = model.rowId;
  if (model.empty) panel.append(node('p', 'matchpanel-title', 'Compared with your cabin'), node('p', 'matchpanel-warning', model.warning), node('p', 'matchpanel-empty', model.empty));
  else {
    // The whole comparison at a glance, before any sentence: one mark per condition, then the limit that goes with it.
    const strip = node('ul', 'matchpanel-strip'); strip.setAttribute('aria-label', 'Comparison at a glance');
    for (const item of [...model.compared, ...model.notCompared]) {
      const [symbol, word] = states[item.state], chip = node('li', 'matchpanel-chip', `${symbol} ${short[item.key] || item.label}`);
      chip.dataset.matchpanelState = item.state; chip.title = `${item.label}: ${word.toLowerCase()}`; strip.append(chip);
    }
    panel.append(strip, node('p', 'matchpanel-warning', model.warning),
      node('p', 'matchpanel-strip-key', `${states.matched[0]} matched · ${states.different[0]} not matched · ${states['not-compared'][0]} never compared by VESTA`),
      node('p', 'matchpanel-title', 'Compared with your cabin'));
    const compared = node('dl', 'matchpanel-compared');
    for (const item of model.compared) {
      const line = node('div', 'matchpanel-line'), term = node('dt', 'matchpanel-parameter', item.label);
      const [symbol, word] = states[item.state];
      const status = node('span', 'matchpanel-state', `${symbol} ${word}`);
      line.dataset.matchpanelState = item.state;
      term.append(status);
      line.append(term, node('dd', 'matchpanel-value', item.detail)); compared.append(line);
    }
    const outside = node('div', 'matchpanel-outside'), list = node('ul', 'matchpanel-exclusions');
    outside.append(node('p', 'matchpanel-title', 'Not compared by VESTA'));
    for (const item of model.notCompared) {
      const line = node('li', 'matchpanel-excluded', item.label);
      const [symbol, word] = states[item.state];
      line.append(node('span', 'matchpanel-state', `${symbol} ${word}`));
      line.dataset.matchpanelState = item.state; list.append(line);
    }
    outside.append(list); panel.append(compared, node('p', 'matchpanel-key', model.deltaLegend), outside);
  }
  return panel;
}

// Compact reported-condition comparison for finding cards. It deliberately does
// not turn a summary or model into an experiment, or compare material geometry.
export function renderFindingComparison(finding, cabin, db) {
  ensureStyle();
  const model = matchPanel(finding, cabin, db), wrap = node('section', 'matchpanel finding-comparison');
  wrap.dataset.findingComparison = finding.id;
  wrap.setAttribute('aria-label', 'Finding conditions and unmatched variables');
  const strip = node('ul', 'matchpanel-strip');
  for (const item of model.compared) {
    const missingCode = { gravity: 'gravity_not_reported', oxygen: 'o2_not_reported', pressure: 'pressure_not_reported' }[item.key];
    const unavailable = model.comparison.fail.includes(missingCode);
    const state = unavailable ? 'not-compared' : item.state;
    const [symbol, label] = states[state];
    const chip = node('li', 'matchpanel-chip', `${symbol} ${short[item.key]}`);
    chip.dataset.matchpanelState = state;
    chip.title = `${label}: ${item.detail.replace('Row:', 'Finding:')}`;
    chip.setAttribute('aria-label', `${item.label}: ${unavailable ? 'not reported; comparison unavailable' : label.toLowerCase()}. ${item.detail.replace('Row:', 'Finding:')}`);
    strip.append(chip);
  }
  wrap.append(strip, node('p', 'matchpanel-strip-key', '✓ within tolerance · ≠ different · ∅ condition not reported'));
  const details = node('details', 'finding-comparison-details'), summary = node('summary', '', 'Compared values & exclusions');
  details.append(summary);
  for (const item of model.compared) details.append(node('p', 'matchpanel-value', `${item.label}: ${item.detail.replace('Row:', 'Finding:')}`));
  details.append(node('p', 'matchpanel-key', model.deltaLegend), node('p', 'matchpanel-excluded', 'Not compared: airflow, geometry, thickness, ignition and suppressant configuration.'));
  const experimental = ['flight', 'ground_lowg', 'normal_g'].includes(finding.n.work);
  const material = cabin.material ? (finding.n.material_ids || []).includes(cabin.material) ? 'Selected material is named.' : 'Selected material is not named; no material equivalence is established.' : 'No material selected.';
  details.append(node('p', 'matchpanel-key', `${experimental ? 'Experimental evidence type' : 'Summary, model or operational evidence; not an experimental row'} · ${material} ${model.warning}`));
  wrap.append(details);
  return wrap;
}
