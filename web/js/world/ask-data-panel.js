/** "Ask the data": a typed question answered by fixed rules from the loaded rows (core/ask-parse.js), then the recorded answers written by AI agents and audited, read from data/agent-answers.json. No model is called. */
import { answerTyped, TYPED_LABEL } from '../core/ask-parse.js?v=ask-20261115-2';
const make = (tag, text, cls) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (cls) node.className = cls; return node; };

export const ASK_DATA_LABEL = 'Recorded answers · written by AI agents, audited · not a live model';
const OPENABLE = new Set(['source_row', 'finding']);
const KIND = { source_row: 'Source row', finding: 'Finding', computed: 'Computed in VESTA', nasa_document: 'NASA document' };

function citation(entry, onSource) {
  const item = make('li', null, 'ad-cite');
  if (OPENABLE.has(entry.kind)) {
    const chip = make('button', entry.id, 'ad-chip ad-chip-open'); chip.type = 'button';
    chip.setAttribute('aria-label', `Open ${entry.kind === 'finding' ? 'finding' : 'source row'} ${entry.id}`);
    chip.onclick = () => onSource?.(entry.id, chip); item.append(chip);
  } else item.append(make('span', entry.id, 'ad-chip'));
  item.append(make('span', `${KIND[entry.kind] || 'Reference'}: ${entry.supports}`, 'ad-supports'));
  return item;
}

/** onSource receives a source-row or finding ID and the chip that asked for it. The section stays hidden until the recorded file has loaded. */
export function createAskDataPanel({ onSource, onOpenQuestion, db, getQuery, url = 'data/agent-answers.json' } = {}) {
  if (!document.querySelector('link[data-vesta-ask-data]')) {
    const sheet = make('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('../../css/ask-data.css?v=ask-20261115-2', import.meta.url).href;
    sheet.dataset.vestaAskData = ''; document.head.append(sheet);
  }
  const element = make('section', null, 'ask-data'); element.hidden = true; element.setAttribute('aria-label', 'Ask the data: recorded answers');
  let disposed = false, chosen = null;
  const heading = make('h3', 'Ask the data'); element.append(heading);
  if (db?.materials && typeof getQuery === 'function') { element.append(typedBlock()); element.hidden = false; }

  /** The typed question. It is shown only when the panel was given the loaded data and the current cabin. */
  function typedBlock() {
    const form = make('form', null, 'ad-typed'), field = make('label', 'Type a question about one material', 'ad-typed-label');
    const input = make('input', null, 'ad-filter ad-typed-input'); input.type = 'text'; input.maxLength = 160; input.autocomplete = 'off';
    input.placeholder = 'For example: can Nomex ignite on the Moon?';
    const ask = make('button', 'Answer from the rows', 'ad-ask'); ask.type = 'submit';
    const row = make('div', null, 'ad-typed-row'); row.append(input, ask); field.append(row);
    const out = make('div', null, 'ad-answer ad-typed-answer'); out.setAttribute('aria-live', 'polite');
    form.onsubmit = event => {
      event.preventDefault();
      const result = answerTyped(input.value, db, getQuery());
      if (result.kind === 'empty') { out.replaceChildren(); return; }
      const label = make('p', TYPED_LABEL, 'ad-label');
      if (result.kind !== 'answer') {
        const nodes = [label, make('p', result.message, 'ad-text')];
        if (result.materials) nodes.push(make('p', `Materials in this collection: ${result.materials.join(', ')}.`, 'ad-note'));
        out.replaceChildren(...nodes); return;
      }
      const s = result.summary, nodes = [label, make('h4', `${s.title} · ${result.cabin}`), make('p', s.answer, 'ad-text')];
      for (const line of s.lines) nodes.push(make('p', line));
      for (const line of result.assumed) nodes.push(make('p', line, 'ad-limits'));
      const next = make('p', null, 'ad-limits'); next.append(make('b', 'Next: '), document.createTextNode(s.next)); nodes.push(next);
      if (result.rowId) {
        const cites = make('ul', null, 'ad-cites'); cites.setAttribute('aria-label', 'Source row for this answer');
        cites.append(citation({ kind: 'source_row', id: result.rowId, supports: result.rowIsMatch ? 'first of the nearby rows counted above' : 'nearest row; it is not a nearby match' }, onSource));
        nodes.push(make('p', 'Citation', 'ad-cites-head'), cites);
      }
      if (typeof onOpenQuestion === 'function') {
        const open = make('button', 'Open this question', 'ad-ask ad-open'); open.type = 'button';
        open.onclick = () => onOpenQuestion({ material: result.material, concern: result.concern, preset: result.preset }, open); nodes.push(open);
      }
      out.replaceChildren(...nodes);
    };
    form.append(field, out);
    return form;
  }

  function render(doc) {
    const answers = doc.answers.filter(a => a && a.id && a.question && a.answer && Array.isArray(a.citations));
    if (!answers.length) return;
    const filter = make('input', null, 'ad-filter'); filter.type = 'text'; filter.placeholder = 'Filter the questions, for example: lunar, Nomex, oxygen'; filter.maxLength = 120;
    filter.setAttribute('aria-label', 'Filter the recorded questions');
    const count = make('p', null, 'ad-count'); count.setAttribute('aria-live', 'polite');
    const list = make('ul', null, 'ad-questions'), out = make('div', null, 'ad-answer'); out.setAttribute('aria-live', 'polite');
    const buttons = answers.map(entry => {
      const item = make('li'), button = make('button', entry.question, 'ad-question'); button.type = 'button'; button.setAttribute('aria-pressed', 'false');
      button.onclick = () => choose(chosen === entry.id ? null : entry.id); item.append(button); list.append(item);
      return { entry, item, button, text: `${entry.question} ${entry.answer}`.toLowerCase() };
    });
    function choose(id) {
      chosen = id;
      for (const b of buttons) b.button.setAttribute('aria-pressed', String(b.entry.id === id));
      const entry = answers.find(a => a.id === id);
      if (!entry) { out.replaceChildren(); return; }
      const limits = make('p', null, 'ad-limits'); limits.append(make('b', 'Limits: '), document.createTextNode(entry.limits || 'none recorded'));
      const cites = make('ul', null, 'ad-cites'); cites.setAttribute('aria-label', 'Citations for this answer');
      for (const c of entry.citations) cites.append(citation(c, onSource));
      out.replaceChildren(make('h4', entry.question), make('p', entry.answer, 'ad-text'), limits, make('p', 'Citations', 'ad-cites-head'), cites);
    }
    function applyFilter() {
      const words = filter.value.toLowerCase().split(/\s+/).filter(Boolean); let shown = 0;
      for (const b of buttons) { const hit = words.every(w => b.text.includes(w)); b.item.hidden = !hit; if (hit) shown += 1; }
      count.textContent = words.length ? `${shown} of ${buttons.length} recorded questions match.` : `${buttons.length} recorded questions. Choose one to read its answer.`;
    }
    filter.oninput = applyFilter; applyFilter();
    element.append(make('p', ASK_DATA_LABEL, 'ad-label ad-recorded-label'));
    if (doc.note) element.append(make('p', doc.note, 'ad-note'));
    element.append(filter, count, list, out); element.hidden = false;
  }

  if (typeof fetch === 'function') fetch(url).then(r => (r.ok ? r.json() : null)).then(doc => { if (!disposed && doc && Array.isArray(doc.answers)) render(doc); }).catch(() => {});
  return { element, dispose() { disposed = true; element.remove(); } };
}
