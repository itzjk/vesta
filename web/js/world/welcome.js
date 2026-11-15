import { num, gravity } from '../core/text.js';
import { buildHash } from '../router.js';

const stations = [
  { id: 'flame', route: 'brief', name: 'Flame', action: 'See how fire changes' },
  { id: 'evidence', route: 'design', name: 'Evidence', action: 'Find your evidence gaps' },
  { id: 'drill', route: 'incident', name: 'Drill', action: 'Rehearse a scripted response' },
  { id: 'trust', route: 'engine', name: 'Trust', action: 'Inspect how VESTA decides' }
];
const validPoint = q => q && Number.isFinite(q.o2) && Number.isFinite(q.p) && q.gclass && (q.g_label || q.g);
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
};

export function destinations(db) {
  return (db?.presets || []).filter(p => p && p.id && p.label && (p.kind == null || p.kind === 'preset') && validPoint({ o2: p.o2, p: p.p_kpa, gclass: p.gclass, g: p.g, g_label: p.g_display }));
}

export function headline(q) {
  if (!validPoint(q)) return 'Cabin conditions unavailable.';
  return `${num(q.o2)}% O₂ · ${num(q.p)} kPa · ${q.g_label || gravity(q.g)}`;
}

export function cabinSummary(q, db, core) {
  if (!validPoint(q) || !db?.materials || !db.rowsByMaterial || !db.findings || !core?.status?.cells || !core.status.tally) return null;
  const cells = core.status.cells(q, db);
  if (!cells.length) return null;
  const counts = core.status.tally(cells);
  if (!Object.values(counts).every(Number.isInteger) || Object.values(counts).reduce((a, b) => a + b, 0) !== cells.length) return null;
  return { label: db.presetById?.[q.preset]?.label || 'Custom cabin', conditions: headline(q), counts, total: cells.length };
}

export function stationHash(id, q) {
  const station = stations.find(s => s.id === id);
  if (!station) return null;
  const params = { station: station.id };
  if (q) {
    Object.assign(params, { preset: q.preset, concern: q.concern, mat: q.material ?? '' });
    if (q.preset === 'custom') Object.assign(params, { o2: q.o2, p: q.p, g: q.g, hab: q.habitat });
  }
  return buildHash(station.route, params);
}

export function build(world) {
  if (!document.querySelector('link[data-vesta-welcome]')) {
    const sheet = node('link');
    sheet.rel = 'stylesheet';
    sheet.href = new URL('../../css/welcome.css?v=2', import.meta.url).href;
    sheet.dataset.vestaWelcome = '';
    document.head.append(sheet);
  }
  const controller = new AbortController();
  const element = node('section', 'vesta-welcome');
  element.setAttribute('aria-label', 'Welcome to VESTA');
  const brand = node('p', 'vesta-welcome-brand', 'VESTA');
  const intro = node('p', 'vesta-welcome-intro');
  intro.append(world.cite('NASA microgravity fire evidence', 'investigation-counts'), ', compared with your mission cabin.');
  const title = node('h2', 'vesta-welcome-title', 'Where are you going?');
  const label = node('label', 'vesta-welcome-destination');
  label.append(node('span', 'vesta-welcome-label', 'Your cabin for the journey'));
  const select = node('select', 'vesta-welcome-select');
  select.setAttribute('aria-label', 'Mission cabin');
  const available = destinations(world.db);
  const placeholder = node('option', '', 'Choose a cabin');
  placeholder.value = '';
  placeholder.disabled = true;
  select.append(placeholder);
  for (const preset of available) {
    const option = node('option', '', preset.label);
    option.value = preset.id;
    select.append(option);
  }
  const custom = node('option', '', 'Custom cabin');
  custom.value = 'custom';
  custom.disabled = true;
  custom.hidden = true;
  select.append(custom);
  select.disabled = !available.length || !world.core?.index?.presetPoint;
  label.append(select);
  const live = node('div', 'vesta-welcome-result');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  const conditions = node('p', 'vesta-welcome-conditions');
  const coverage = node('p', 'vesta-welcome-coverage');
  const meaning = node('p', 'vesta-welcome-meaning', "Coverage in VESTA's collection, not safety.");
  live.append(conditions, coverage, meaning);
  const nav = node('nav', 'vesta-welcome-nav');
  nav.setAttribute('aria-label', 'Explore VESTA');
  nav.append(node('p', 'vesta-welcome-label', 'Where next?'));
  for (const station of stations) {
    const link = node('a', 'vesta-welcome-link');
    link.href = stationHash(station.id);
    link.dataset.welcomeStation = station.id;
    link.append(node('span', 'vesta-welcome-station', station.name), node('span', 'vesta-welcome-action', station.action));
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (world.navigate) world.navigate(station.id);
      else world.go(link.getAttribute('href'));
    }, { signal: controller.signal });
    nav.append(link);
  }
  element.append(brand, intro, title, label, live, nav);
  let current, disposed = false;
  function update(q = world.q) {
    if (disposed) return;
    current = q;
    for (const link of nav.querySelectorAll('[data-welcome-station]')) link.href = stationHash(link.dataset.welcomeStation, q);
    const preset = available.find(p => p.id === q?.preset);
    custom.hidden = q?.preset !== 'custom';
    select.value = preset ? preset.id : q?.preset === 'custom' ? 'custom' : '';
    const summary = cabinSummary(q, world.db, world.core);
    conditions.replaceChildren();
    coverage.replaceChildren();
    if (summary) {
      conditions.append(world.cite(summary.conditions, preset?.id || 'design-coverage'));
      const { PROVEN: near, EXTRAPOLATED: extrapolated, NEVER_TESTED: absent } = summary.counts;
      coverage.append(world.cite(`${summary.total} questions: ${near} near · ${extrapolated} extrapolated · ${absent} no evidence`, 'design-coverage'));
    } else {
      conditions.textContent = available.length ? 'Coverage unavailable for this cabin.' : 'Cabin evidence unavailable.';
    }
    coverage.hidden = !summary;
    meaning.hidden = !summary;
  }
  select.addEventListener('change', () => {
    const preset = available.find(p => p.id === select.value);
    if (!preset) return;
    const next = world.core.index.presetPoint(world.db, preset.id, current?.concern, current?.material);
    if (!next) return;
    world.setQ({ preset: preset.id });
    update(next);
  }, { signal: controller.signal });
  update(world.q);
  return { element, update, headline: q => headline(q || current), dispose() { disposed = true; controller.abort(); element.remove(); } };
}
