import { GRAVITY_CONTRAST, gravityContrast, summaryText } from '../core/gravity-contrast.js?v=gravity-contrast-20261115-1';

const make = (tag, text, cls) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (cls) node.className = cls; return node; };
const shown = reading => reading.raw === null || reading.raw.trim() === '' ? 'not recorded' : reading.raw.trim();

/** One bar: the recorded burn length against the recorded sample length. Nothing is drawn when the row holds no single number. */
function bar(label, reading, lengthRaw) {
  const line = make('div', null, 'gc-bar'), track = make('span', null, 'gc-track'), value = make('span', null, 'gc-value');
  track.setAttribute('aria-hidden', 'true');
  if (reading.fraction === null) track.classList.add('gc-track-empty');
  else {
    const fill = make('span', null, reading.kind === 'complete' ? 'gc-fill gc-fill-word' : 'gc-fill');
    fill.style.setProperty('width', `${Math.round(reading.fraction * 1000) / 10}%`); track.append(fill);
  }
  const recorded = shown(reading);
  value.textContent = reading.kind === 'number' ? `${recorded} of ${lengthRaw}${reading.approx ? ' (approximate in the table)' : ''}`
    : reading.kind === 'complete' ? `“${recorded}” (no number recorded; drawn as the full ${lengthRaw})`
      : reading.kind === 'missing' ? 'not recorded' : `“${recorded}” (not drawn: not one number)`;
  line.append(make('span', label, 'gc-level'), track, value);
  return line;
}

function sampleItem(sample, onSource) {
  const item = make('li', null, 'gc-sample'), head = make('p', null, 'gc-head');
  item.dataset.comparison = sample.comparison.id;
  const name = sample.material ?? 'material not stated in the row';
  head.append(make('b', `Sample ${sample.sample ?? '?'} · ${name}`), document.createTextNode(` · thickness ${sample.size.thickness_raw ?? 'not recorded'} · ${sample.flow_direction ?? 'flow direction not recorded'} flow · `));
  const cite = make('button', sample.id, 'gc-source'); cite.type = 'button'; cite.setAttribute('aria-label', `Open source row ${sample.id}`);
  cite.onclick = () => onSource?.(sample.id, cite); head.append(cite);
  const lengthRaw = sample.size.length_raw ?? 'an unrecorded sample length';
  const verdict = make('p', null, 'gc-verdict');
  verdict.append(make('b', sample.comparison.label[0].toUpperCase() + sample.comparison.label.slice(1)),
    document.createTextNode(sample.comparison.reason ? `: ${sample.comparison.reason}.` : sample.comparison.basis === 'complete_word' ? ' (reading “Complete” as the full sample length).' : ' (a number at both levels).'));
  item.append(head, bar('Microgravity', sample.micro, lengthRaw), bar('Normal gravity', sample.normal, lengthRaw), verdict);
  const remarks = [...new Set([sample.micro, sample.normal].map(reading => reading.note_text).filter(Boolean)), ...sample.flags.map(flag => flag.text)];
  if (remarks.length) { const list = make('ul', null, 'gc-remarks'); for (const remark of remarks) list.append(make('li', remark)); item.append(list); }
  return item;
}

/** Saffire-II burn length in microgravity and in normal gravity, row by row. onSource receives the source-row ID. */
export function createGravityContrastPanel({ db, onSource } = {}) {
  if (!db || !Array.isArray(db.tests)) throw new TypeError('The gravity view requires loaded source rows.');
  if (!document.querySelector('link[data-vesta-gravity-contrast]')) {
    const sheet = make('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('../../css/gravity-contrast.css?v=gravity-contrast-20261115-1', import.meta.url).href;
    sheet.dataset.vestaGravityContrast = ''; document.head.append(sheet);
  }
  const view = gravityContrast({ tests: db.tests, investigations: db.investigations, tables: db.tables });
  const element = make('section', null, 'gravity-contrast'); element.setAttribute('aria-label', 'Saffire-II burn length in microgravity and in normal gravity');
  element.append(make('h3', 'What NASA’s Saffire-II rows say about gravity'), make('p', view.scope, 'gc-scope'));
  if (!view.samples.length) { element.append(make('p', `No ${GRAVITY_CONTRAST.investigation} rows are loaded, so there is nothing to compare.`, 'gc-limit')); return { element, dispose() {} }; }
  element.append(make('p', summaryText(view.summary), 'gc-summary'));
  const list = make('ol', null, 'gc-samples'); for (const sample of view.samples) list.append(sampleItem(sample, onSource)); element.append(list);
  element.append(make('p', 'Each track is the sample length recorded in the row. Solid fill: a recorded burn length. Hatched fill: the table says “Complete”. Empty dashed track: the entry is not one number, so nothing is drawn.', 'gc-legend'));
  const limit = make('p', `${view.limits} `, 'gc-limit');
  if (view.source_url) { const link = make('a', `${view.name ?? GRAVITY_CONTRAST.investigation} on NASA PSI (${GRAVITY_CONTRAST.investigation})`); link.href = view.source_url; link.rel = 'noopener'; link.target = '_blank'; limit.append(link, document.createTextNode('.')); }
  element.append(limit);
  return { element, dispose() { element.remove(); } };
}
