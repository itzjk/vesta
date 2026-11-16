import { num, gravity, oxygen, pressure } from '../core/text.js';
import { buildHash } from '../router.js';
import { CONCERNS } from '../core/index.js';

const stations = [
  { id: 'flame', route: 'brief', name: 'Flame', action: 'See how fire changes' },
  { id: 'evidence', route: 'design', name: 'Evidence', action: 'Find your evidence gaps' },
  { id: 'drill', route: 'incident', name: 'Drill', action: 'Rehearse a scripted response' },
  { id: 'trust', route: 'engine', name: 'Trust', action: 'Inspect how VESTA decides' },
  { id: 'robotics', route: 'engine', name: 'Space lab', action: 'Review evidence with the robot' }
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

// The lead sentence of the panel, built only from the tally the coverage functions return.
export function finding(summary) {
  if (!summary?.counts || !Number.isInteger(summary.total)) return null;
  const { PROVEN: near, EXTRAPOLATED: other, NEVER_TESTED: absent } = summary.counts;
  return { lead: `${near} of ${summary.total} questions have nearby NASA evidence`,
    rest: `${other} other conditions · ${absent} no source in this collection` };
}

// One source-table row for the selected question: the row the core ordering puts first for this cabin.
export function nearestSource(q, db, core) {
  const choice = reviewQuestion(q, db);
  if (!choice || !validPoint(q) || !db?.rowsByMaterial || !core?.status?.nearestRow) return null;
  const found = core.status.nearestRow(choice.material, choice.concern, q, db), row = found?.row;
  if (!row?.id) return null;
  return { id: row.id, nearby: found.fail.length === 0,
    name: `${row.investigation || 'Investigation not in the table'} · row ${row.id}`,
    conditions: [oxygen(row.o2_percent, 'oxygen not in the table').replace(' % O2', '% O₂'),
      pressure(row.pressure_kpa, 'pressure not in the table'), row.gravity || 'gravity not in the table'].join(' · ') };
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

export function reviewQuestion(q, db) {
  if (db?.materials?.[q?.material] && CONCERNS.includes(q?.concern)) return { material: q.material, concern: q.concern };
  return db?.materials?.pmma ? { material: 'pmma', concern: CONCERNS.includes(q?.concern) ? q.concern : 'prevention' } : null;
}

export function reviewQuestionText(q, db) {
  const choice = reviewQuestion(q, db);
  if (!choice) return 'A material question is unavailable in this collection.';
  const label = `${db.materials[choice.material].label} · ${choice.concern}`;
  return choice.material === q?.material && choice.concern === q?.concern
    ? `${label} · this cabin` : `Suggested starting question: ${label}`;
}

export function build(world) {
  if (!document.querySelector('link[data-vesta-welcome]')) {
    const sheet = node('link');
    sheet.rel = 'stylesheet';
    sheet.href = new URL('../../css/welcome.css?v=welcome-finding-20261115-1', import.meta.url).href;
    sheet.dataset.vestaWelcome = '';
    document.head.append(sheet);
  }
  const controller = new AbortController();
  const element = node('section', 'vesta-welcome');
  element.setAttribute('aria-label', 'Welcome to VESTA');
  const brand = node('p', 'vesta-welcome-brand', 'VESTA');
  const intro = node('p', 'vesta-welcome-intro');
  intro.append(world.cite('NASA microgravity fire evidence', 'investigation-counts'), ' vs. your mission cabin');
  const title = node('h2', 'vesta-welcome-title');
  const label = node('label', 'vesta-welcome-destination');
  label.append(node('span', 'vesta-welcome-label', 'Mission cabin'));
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
  const meaning = node('p', 'vesta-welcome-meaning', 'Coverage in this collection, not a safety rating.');
  live.append(title, coverage, meaning);
  const source = node('div', 'vesta-welcome-source');
  const sourceLabel = node('p', 'vesta-welcome-label'), sourceRow = node('p', 'vesta-welcome-source-row'), sourceConditions = node('p', 'vesta-welcome-source-conditions');
  const questionControls = node('div', 'vesta-welcome-question-controls');
  const materialSelect = node('select', 'vesta-welcome-select'), concernSelect = node('select', 'vesta-welcome-select');
  for (const [control, text] of [[materialSelect, 'Material'], [concernSelect, 'Question']]) {
    const wrapper = node('label'); wrapper.append(node('span', 'vesta-welcome-label', text), control);
    control.setAttribute('aria-label', text); questionControls.append(wrapper);
  }
  for (const [id, m] of Object.entries(world.db.materials)) { const option = node('option', '', m.label); option.value = id; materialSelect.append(option); }
  for (const concern of CONCERNS) { const option = node('option', '', concern[0].toUpperCase() + concern.slice(1)); option.value = concern; concernSelect.append(option); }
  const selectedQuestion = node('p', 'vesta-welcome-question');
  const questionEdit = node('details', 'vesta-welcome-edit'); questionEdit.append(node('summary', '', 'Change material or question'), questionControls);
  const review = node('button', 'vesta-welcome-review', 'Review this question'); review.type = 'button';
  review.dataset.welcomeReview = '';
  source.append(selectedQuestion, sourceLabel, sourceRow, sourceConditions);
  // Keep this a direct child: the existing gravity walkthrough inserts its launcher before it.
  const nav = node('details', 'vesta-welcome-nav');
  nav.setAttribute('aria-label', 'Explore VESTA stations');
  nav.append(node('summary', '', 'Explore all stations'));
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
  element.append(brand, intro, live, label, conditions, source, review, questionEdit, nav);
  let current, disposed = false;
  function update(q = world.q) {
    if (disposed) return;
    current = q;
    const choice = reviewQuestion(q, world.db);
    review.disabled = !choice || !validPoint(q);
    materialSelect.value = choice?.material || ''; concernSelect.value = choice?.concern || '';
    selectedQuestion.textContent = reviewQuestionText(q, world.db);
    for (const link of nav.querySelectorAll('[data-welcome-station]')) link.href = stationHash(link.dataset.welcomeStation, q);
    const preset = available.find(p => p.id === q?.preset);
    custom.hidden = q?.preset !== 'custom';
    select.value = preset ? preset.id : q?.preset === 'custom' ? 'custom' : '';
    const summary = cabinSummary(q, world.db, world.core);
    conditions.replaceChildren();
    coverage.replaceChildren();
    const lead = finding(summary);
    if (lead) {
      conditions.append(world.cite(summary.conditions, preset?.id || 'design-coverage'));
      title.textContent = lead.lead;
      coverage.append(world.cite(lead.rest, 'design-coverage'));
    } else {
      title.textContent = available.length ? 'Coverage unavailable for this cabin.' : 'Cabin evidence unavailable.';
    }
    conditions.hidden = coverage.hidden = meaning.hidden = !lead;
    const row = nearestSource(q, world.db, world.core);
    sourceRow.replaceChildren();
    sourceLabel.textContent = row ? (row.nearby ? 'Nearest NASA source row · nearby conditions' : 'Nearest NASA source row · other conditions') : 'No source row for this question in this collection.';
    if (row) sourceRow.append(world.cite(row.name, row.id));
    sourceConditions.textContent = row ? row.conditions : '';
    sourceRow.hidden = sourceConditions.hidden = !row;
  }
  const changeQuestion = () => {
    const patch = { material: materialSelect.value, concern: concernSelect.value };
    world.setQ(patch, { render: false }); update({ ...current, ...patch });
  };
  materialSelect.addEventListener('change', changeQuestion, { signal: controller.signal });
  concernSelect.addEventListener('change', changeQuestion, { signal: controller.signal });
  review.addEventListener('click', () => {
    const question = reviewQuestion(current, world.db);
    if (!question || !validPoint(current)) return;
    world.setQ(question, { render: false });
    if (world.navigate) world.navigate('evidence', { evidenceQuestion: question });
    else world.go(stationHash('evidence', { ...current, ...question }));
  }, { signal: controller.signal });
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
