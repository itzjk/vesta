/** "Ask the data": recorded answers written by AI agents and audited, read from data/agent-answers.json. Nothing is generated here and no model is called. */
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
export function createAskDataPanel({ onSource, url = 'data/agent-answers.json' } = {}) {
  if (!document.querySelector('link[data-vesta-ask-data]')) {
    const sheet = make('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('../../css/ask-data.css?v=ask-20261115-1', import.meta.url).href;
    sheet.dataset.vestaAskData = ''; document.head.append(sheet);
  }
  const element = make('section', null, 'ask-data'); element.hidden = true; element.setAttribute('aria-label', 'Ask the data: recorded answers');
  let disposed = false, chosen = null;

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
    element.append(make('h3', 'Ask the data'), make('p', ASK_DATA_LABEL, 'ad-label'));
    if (doc.note) element.append(make('p', doc.note, 'ad-note'));
    element.append(filter, count, list, out); element.hidden = false;
  }

  if (typeof fetch === 'function') fetch(url).then(r => (r.ok ? r.json() : null)).then(doc => { if (!disposed && doc && Array.isArray(doc.answers)) render(doc); }).catch(() => {});
  return { element, dispose() { disposed = true; element.remove(); } };
}
