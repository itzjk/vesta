import { collectionSummary, evidenceRegister, scoreFactors, nearestSourceRows } from '../core/evidence-register.js?v=sebas-20261115-3';
import * as text from '../core/text.js';
import { renderMatchPanel, renderFindingComparison } from '../ui/matchpanel.js?v=sebas-20261115-3';

const node = (tag, value, cls) => {
  const el = document.createElement(tag); if (value != null) el.textContent = value; if (cls) el.className = cls; return el;
};
function styles() {
  if (document.querySelector('link[data-evidence-register-style]')) return;
  const link = node('link'); link.rel = 'stylesheet'; link.href = new URL('../../css/evidence-register.css?v=sebas-20261115-3', import.meta.url).href;
  link.dataset.evidenceRegisterStyle = ''; document.head.append(link);
}
const detail = (label, content) => { const el = node('details'); el.append(node('summary', label), content); return el; };
const rangeText = range => range ? `${range[0]}–${range[1]}` : 'Not reported';
export function renderCollectionSummary(db) {
  styles(); const m = collectionSummary(db), el = node('section', null, 'evidence-collection');
  el.dataset.collectionSummary = ''; el.setAttribute('aria-label', 'Collection and claims we do not make');
  el.append(node('h3', 'The collection'), node('p', `${m.investigations} investigations · ${m.source_tables} tables · ${m.source_table_rows} source rows · ${m.findings} findings.`));
  el.append(node('p', `${m.material_questions} material–concern questions are derived from the cabin-material subset. Questions, findings, rows and quote checks are different units.`, 'register-note'));
  const provenance = node('div');
  provenance.append(node('p', `Loaded collection build: ${m.build || 'not reported'}.`));
  provenance.append(node('p', `Finding-source publication years: ${rangeText(m.source_year_range)}; ${m.sources_without_year} of ${m.sources} finding sources have no reported year. This is not an experiment-date range.`));
  provenance.append(node('p', `Reported row dates at or before the collection build: ${rangeText(m.row_date_range_not_after_build)}; ${m.rows_without_date} of ${m.source_table_rows} rows have no complete date.`));
  for (const anomaly of m.row_dates_after_build) provenance.append(node('p', `${anomaly.id} records ${anomaly.date}, after the collection build (source value: ${anomaly.source_date || 'not reported'}). Retained as recorded, flagged as a date anomaly and excluded from the displayed historical range.`));
  const types = node('dl', null, 'register-counts');
  for (const [kind, count] of Object.entries(m.source_types)) types.append(node('dt', kind), node('dd', `${count} sources`));
  provenance.append(node('p', 'Source types below count distinct sources cited by findings; the table inventory above counts files.'), types, node('p', 'Source rows are not independent burns. Row meanings:'));
  const kinds = node('dl', null, 'register-counts');
  for (const [kind, count] of Object.entries(m.row_kinds)) kinds.append(node('dt', kind.replaceAll('_', ' ')), node('dd', String(count)));
  provenance.append(kinds, node('p', `${m.counting_rows} rows enter counting indexes; ${m.cabin_rows} are cabin-material rows. Broader research fuels and reference/index rows remain inspectable.`));
  if (m.quote_gate.checked != null) provenance.append(node('p', `${m.quote_gate.verified} of ${m.quote_gate.checked} quote checks passed; ${m.quote_gate.rejected} rejected excerpts. The gate includes source text used beyond the ${m.findings} findings, so these totals do not count the same objects.`));
  if (m.excluded_investigations.length) {
    provenance.append(node('h4', 'Excluded investigation search hits'));
    for (const i of m.excluded_investigations) provenance.append(node('p', `${i.id}: ${i.reason}`));
  }
  el.append(detail('Source types, dates & counting rules', provenance));
  const limits = node('ul'); for (const limit of m.limits) limits.append(node('li', limit));
  el.append(detail('Collection limits', limits));
  const claims = node('ul'); for (const claim of m.claims_not_made) claims.append(node('li', claim));
  el.append(detail('Claims we do not make', claims));
  return el;
}

export function buildEvidenceRegister(world) {
  styles(); const { db } = world;
  let q = { ...world.q }, page = 0, disposed = false, lastQuery = '', model;
  const filters = { mode: 'questions', material: '', concern: '', coverage: '', sourceType: '' }, size = 12;
  const element = node('section', null, 'evidence-register'); element.dataset.evidenceRegister = '';
  element.setAttribute('aria-label', 'Complete evidence register');
  element.append(node('h3', 'Evidence register'), node('p', 'Inspect the loaded collection. Choose a counting unit, then filter; source rows and findings remain separate.', 'register-note'));
  element.append(detail('Collection & claims we do not make', renderCollectionSummary(db)));
  const condition = node('p', null, 'register-cabin'); element.append(condition);
  const controls = node('div', null, 'register-filters'), selectors = {};
  const select = (key, label, options) => {
    const field = node('label', label), control = node('select'); control.dataset.registerFilter = key; control.setAttribute('aria-label', label);
    for (const [value, caption] of options) { const o = node('option', caption); o.value = value; control.append(o); }
    field.append(control); controls.append(field); selectors[key] = control;
    control.addEventListener('change', () => { filters[key] = control.value; page = 0;
      if (key === 'mode') { filters.coverage = ''; filters.sourceType = ''; selectors.coverage.value = ''; selectors.sourceType.value = ''; }
      paint();
    });
  };
  const materialNames = new Map(Object.entries(db.materials).map(([id, m]) => [id, m.label]));
  for (const r of db.tests) if (r.n.material_id && !materialNames.has(r.n.material_id)) materialNames.set(r.n.material_id, r.fuel || r.n.material_id);
  for (const f of db.findings) for (const id of f.n.material_ids || []) if (!materialNames.has(id)) materialNames.set(id, id);
  select('mode', 'Counting unit', [['questions', 'Material questions'], ['findings', 'Findings'], ['rows', 'Source rows']]);
  select('material', 'Material named', [['', 'All materials'], ...[...materialNames].sort((a, b) => a[1].localeCompare(b[1]))]);
  select('concern', 'Concern / pillar', [['', 'All concerns'], ...[...new Set(['prevention', 'detection', 'suppression', ...db.findings.map(f => f.pillar)])].map(id => [id, text.concern(id)])]);
  select('coverage', 'Condition coverage', [['', 'All coverage'], ['PROVEN', 'Nearby / matching conditions'], ['EXTRAPOLATED', 'Other / incomplete conditions'], ['NEVER_TESTED', 'No source for question'], ['NOT_COUNTED', 'Row not counted']]);
  select('sourceType', 'Source type', [['', 'All source types'], ...[...new Set(['psi-table', ...db.findings.map(f => f.source?.kind || 'not reported')])].sort().map(s => [s, s])]);
  element.append(controls);
  const counts = node('p', null, 'register-results'); counts.setAttribute('role', 'status'); counts.setAttribute('aria-live', 'polite');
  const scope = node('p', null, 'register-note'), list = node('ol', null, 'register-list');
  const nav = node('nav', null, 'register-pages'); nav.setAttribute('aria-label', 'Evidence pages');
  const prev = node('button', 'Previous'), next = node('button', 'Next'), position = node('span'); prev.type = next.type = 'button';
  prev.onclick = () => { if (page > 0) { page--; paint(); counts.focus({ preventScroll: true }); } };
  next.onclick = () => { if ((page + 1) * size < model.count) { page++; paint(); counts.focus({ preventScroll: true }); } };
  counts.tabIndex = -1; nav.append(prev, position, next); element.append(counts, scope, list, nav);
  const cite = (parent, label, id) => parent.append(world.cite(label, id));
  function item(entry) {
    const el = node('li', null, 'register-item'); el.dataset.registerId = entry.id;
    const heading = node('h4'), compareQ = { ...q, material: filters.material || null, concern: filters.concern || q.concern };
    if (entry.kind === 'question') {
      const c = entry.cell; heading.textContent = `${db.materials[c.material].label} · ${text.concern(c.concern)}`;
      el.append(heading, node('p', `${text.status(c.status)} · ${c.rows} source rows · ${c.finding_ids.length} findings`, 'register-badge'));
      el.append(node('p', text.cellSentence(c, db.materials[c.material].label, db)));
      if (c.status === 'NEVER_TESTED') el.append(node('p', 'No row or finding for this material + concern in the loaded collection. This does not establish absence elsewhere.', 'register-note'));
      const rows = nearestSourceRows(c.material, c.concern, q, db), body = node('div');
      for (const r of rows) { const line = node('p'); cite(line, `${r.row.id} · ${r.row.investigation || 'Source row'}`, r.row.id); body.append(line, renderMatchPanel(r.row, q, db)); }
      if (rows.length) el.append(detail(`Nearest ${rows.length} source rows`, body));
      for (const [mode, label] of [['findings', 'Inspect findings'], ['rows', 'Inspect source rows']]) {
        const b = node('button', label); b.type = 'button'; b.onclick = () => {
          Object.assign(filters, { mode, material: c.material, concern: c.concern, coverage: '', sourceType: '' });
          for (const [key, value] of Object.entries(filters)) selectors[key].value = value;
          page = 0; paint(); counts.focus({ preventScroll: true });
        }; el.append(b);
      }
    } else if (entry.kind === 'finding') {
      const f = entry.record; cite(heading, f.claim || f.title || f.quote || f.id, f.id);
      const factors = scoreFactors(f, compareQ, db);
      el.append(heading, node('p', `${entry.sourceType} · ${text.level(f)} · ${text.status(entry.status)} · ${factors.total}/100 relevance`, 'register-badge'));
      el.append(renderFindingComparison(f, compareQ, db));
      const score = node('div');
      for (const factor of factors.factors) score.append(node('p', `${text.TERM_LABEL[factor.key] || factor.key}: ${Number(factor.contribution.toFixed(3))} / ${factor.maximum}`));
      score.append(node('p', `Support multiplier ×${factors.multiplier}; rounded total ${factors.total}/100.`), node('p', factors.explanation), node('p', factors.excluded));
      el.append(detail('Actual score factors', score));
    } else {
      const r = entry.record; cite(heading, `${r.id} · ${r.investigation || r.psi_id} · ${r.fuel || 'material not reported'}`, r.id);
      el.append(heading, node('p', `psi-table · ${(r.row_kind || 'unreported row kind').replaceAll('_', ' ')} · ${entry.status === 'NOT_COUNTED' ? 'Not in counting index' : entry.status === 'PROVEN' ? 'Conditions within tolerance' : 'Conditions differ or are incomplete'}`, 'register-badge'));
      const panel = renderMatchPanel(r, q, db), strip = panel.querySelector('.matchpanel-strip'); if (strip) el.append(strip);
      el.append(detail('Compared values & exclusions', panel), node('p', `${r.table_file} · record ${r.row}. These condition checks do not establish material-and-concern coverage by themselves.`, 'register-note'));
    }
    return el;
  }
  function paint() {
    if (disposed) return;
    model = evidenceRegister(db, q, filters); page = Math.min(page, Math.max(0, Math.ceil(model.count / size) - 1));
    selectors.sourceType.disabled = filters.mode === 'questions';
    selectors.coverage.querySelector('option[value="NEVER_TESTED"]').disabled = filters.mode !== 'questions';
    selectors.coverage.querySelector('option[value="NOT_COUNTED"]').disabled = filters.mode !== 'rows';
    const c = model.coverage;
    condition.textContent = `${text.oxygen(q.o2)} · ${text.pressure(q.p)} · ${text.gravity(q.gclass)}. Coverage is not safety.`;
    counts.textContent = `${model.count} of ${model.total} ${model.mode === 'rows' ? 'source rows' : model.mode} match these filters. Full cabin matrix: ${model.questions} questions = ${c.PROVEN} nearby + ${c.EXTRAPOLATED} other conditions + ${c.NEVER_TESTED} no source.`;
    scope.textContent = model.mode === 'questions' ? 'Nearby question coverage requires a source row for the same material and concern. Nearest rows: fewest failed conditions, then O₂ gap, pressure gap and row ID.'
      : model.mode === 'findings' ? 'Finding labels check evidence type and reported gravity, oxygen and pressure; material names filter relevance. A summary can match reported conditions without being an experiment.'
      : 'Row labels compare reported conditions only. They are not material safety labels; rows without the required counting role are marked separately.';
    const shown = model.entries.slice(page * size, (page + 1) * size); list.replaceChildren(...shown.map(item)); list.start = page * size + 1;
    if (!shown.length) list.append(node('li', 'No entries match these filters. Clear a filter or change counting unit; an empty filtered list is not evidence of scientific absence.', 'register-empty'));
    position.textContent = model.count ? `${page * size + 1}–${Math.min((page + 1) * size, model.count)} of ${model.count}` : '0 entries';
    prev.disabled = page === 0; next.disabled = (page + 1) * size >= model.count;
  }
  function update(nextQ) { const key = JSON.stringify(nextQ); if (disposed || key === lastQuery) return; lastQuery = key; q = { ...nextQ }; page = 0; paint(); }
  update(q);
  return { element, update, dispose() { disposed = true; element.remove(); } };
}
