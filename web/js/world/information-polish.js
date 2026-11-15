const rationalePreferences = new WeakMap();

export function polishDecisionContent(content, { entry, done = false, outside = false } = {}) {
  if (!content) return null;
  let preference = rationalePreferences.get(content);
  if (!preference) {
    preference = { open: false, details: null };
    rationalePreferences.set(content, preference);
  }
  // A rebuild can precede the queued toggle event. Read the last disclosure now.
  if (preference.details) preference.open = preference.details.open;
  preference.details = null;
  const panel = content.closest('.world-drill');
  const heading = panel?.querySelector('.drill-heading');
  const controls = panel?.querySelector('.drill-controls');
  if (heading && controls && !heading.querySelector('.drill-heading-copy')) {
    const title = heading.querySelector('h2');
    const time = controls.querySelector('.drill-time');
    if (title && time) {
      const copy = content.ownerDocument.createElement('div');
      copy.className = 'drill-heading-copy';
      heading.insertBefore(copy, title);
      copy.append(title, time);
      controls.classList.add('drill-controls-condensed');
    }
  }
  if (!entry || done || outside) return null;
  const children = [...content.children];
  const existing = children.find(node => node.classList.contains('drill-rationale'));
  if (existing) { preference.details = existing; return existing; }

  const triad = children.find(node => node.classList.contains('drill-triad'));
  const beats = triad ? [...triad.children] : children;
  const quote = beats.filter(node => node.classList.contains('drill-quote'));
  const instinct = beats.filter(node => node.classList.contains('drill-instinct'));
  if (!quote.length && !instinct.length) return null;
  if (triad) {
    const action = beats.find(node => node.classList.contains('drill-decision'));
    if (action) content.insertBefore(action, triad);
  }

  const details = content.ownerDocument.createElement('details');
  details.className = 'drill-rationale';
  details.open = preference.open;
  preference.details = details;
  details.addEventListener('toggle', () => {
    // Ignore queued events from a disclosure replaced by a later decision.
    if (preference.details === details && details.parentElement === content) preference.open = details.open;
  });
  const summary = content.ownerDocument.createElement('summary');
  summary.textContent = 'Why this decision? Evidence & limits';
  details.append(summary);
  if (triad && entry.state !== 'NO_SOURCE' && entry.coverage) {
    const fullStatus = children.find(node => node.classList.contains('drill-limit'));
    const delimiter = fullStatus?.textContent.indexOf(' · ') ?? -1;
    const labelText = delimiter > 0 ? fullStatus.textContent.slice(0, delimiter).trim() : '';
    if (labelText) {
      const label = content.ownerDocument.createElement('p');
      label.className = 'drill-coverage-label';
      label.textContent = labelText;
      content.insertBefore(label, fullStatus);
      details.append(fullStatus);
    }
  }
  details.append(...quote, ...instinct);
  if (triad && !triad.children.length) triad.remove();
  content.append(details);
  return details;
}


export function ensureInformationPolishStyles(doc = document) {
  const id = 'vesta-information-polish-style';
  if (doc.getElementById(id)) return;
  const link = doc.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/information-polish.css?v=sebas-20261115-2', import.meta.url).href;
  doc.head.append(link);
}
