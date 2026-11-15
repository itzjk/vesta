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
