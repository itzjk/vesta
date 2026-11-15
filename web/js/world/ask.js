import { match, TOL } from '../core/match.js';
import { cell } from '../core/status.js';
import * as text from '../core/text.js';
import { rank, PARTIAL_SUPPORT } from '../core/rank.js';
import { summarize, axisText } from '../views/investigations.js';

export const NO_MATCH = "No findings match these search terms in the loaded collection.";
const ignored = new Set('a an the is are was were do does did how what which why where when can could would should about of to in on for and or with me tell happen happens'.split(' '));
const normalize = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[_-]/g, ' ');
const tokens = value => normalize(value).match(/\bo2\b|[a-z]+|\d+(?:\.\d+)?/g) || [];
const family = token => /^ventilat/.test(token) ? 'ventilat' : /^oxyg/.test(token) || token === 'o2' ? 'oxygen' : /^flames?$/.test(token) ? 'flame' : token;
const terms = value => tokens(value).map(family);
const values = value => value && typeof value === 'object' ? Object.values(value).flatMap(values) : [value];
const readable = value => String(value).replace(/_/g, ' ');
const sorted = values => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

export function searchEvidence(db, query, q) {
  const wanted = [...new Set(terms(query).filter(t => !ignored.has(t)))];
  if (!wanted.length) return [];
  const ranked = q ? new Map(rank(db.findings, q, db).map(r => [r.f.id, r.total])) : new Map();
  return db.findings.filter(f => f.gate?.pass === true && (f.verified?.quote === true || f.verified?.quote === 'exact match')).flatMap(finding => {
    const primary = terms([finding.claim, finding.quote, finding.topic, finding.source?.title].join(' '));
    const all = new Set([...primary, ...terms(values(finding.conditions).join(' ')), ...terms(values(finding.n).join(' '))]);
    if (!wanted.every(t => all.has(t))) return [];
    const hits = wanted.reduce((n, t) => n + Number(primary.includes(t)), 0);
    return [{ finding, hits, relevance: ranked.get(finding.id) ?? null, psi: finding.n?.psi_id || null }];
  }).sort((a, b) => b.hits - a.hits || (b.relevance ?? 0) - (a.relevance ?? 0) || a.finding.id.localeCompare(b.finding.id, 'en', { numeric: true }));
}

export function cabinMatches(db, q) {
  if (!Number.isFinite(q.o2) || !Number.isFinite(q.p) || q.p <= 0 || !q.gclass) return [];
  return db.tests.filter(r => r.n?.counts && match(r.n, q, db.base).fail.length === 0);
}

export function compareInvestigations(db, leftId, rightId) {
  if (!leftId || !rightId || leftId === rightId || !db.invById[leftId] || !db.invById[rightId]) return null;
  const left = summarize(db.rowsByPsi[leftId] || []), right = summarize(db.rowsByPsi[rightId] || []);
  const dimensions = [
    ['fuels', s => s.fuels.items.map(x => x.value)],
    ['gravity', s => s.gravity.items.map(x => x.value)],
    ['questions', s => s.pillars],
    ['outcomes', s => s.outcomes.map(x => readable(x.name))]
  ];
  const shared = dimensions.flatMap(([axis, get]) => {
    const a = sorted(get(left)), b = new Set(get(right));
    const common = a.filter(x => b.has(x));
    return common.length ? [{ axis, values: common }] : [];
  });
  const differences = dimensions.flatMap(([axis, get]) => {
    const a = sorted(get(left)), b = sorted(get(right));
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [{ axis, left: a, right: b }];
  });
  for (const [axis, key] of [['oxygen', 'o2'], ['pressure', 'p']]) {
    const a = axisText(left[key]), b = axisText(right[key]);
    if (a !== b) differences.push({ axis, left: a, right: b });
  }
  const common = shared[0];
  const shareLine = common ? `Shared ${common.axis}: ${common.values.join(', ')}` : 'No shared recorded fuel, gravity, question or outcome';
  const diffLine = differences.length ? `different ${differences.map(d => d.axis).join(', ')}` : 'same recorded categories';
  return { leftId, rightId, left, right, shared, differences, line: `${shareLine}; ${diffLine}.`, short: `${common ? `Shared ${common.axis}` : 'No shared recorded categories'}; ${differences.length ? `different ${differences[0].axis}` : 'same categories'}; ${left.rows}/${right.rows} rows.` };
}

export function guidedAnswer(db, q, task, { leftId = null, rightId = null } = {}) {
  const selected = q.material && db.materials[q.material];
  const cabin = db.presetById?.[q.preset];
  const context = `Cabin: ${cabin?.short || cabin?.label || 'Custom cabin'} · ${text.oxygen(q.o2)}, ${text.pressure(q.p)}, ${q.g_label || text.gravity(q.gclass)}. Question: ${selected?.label || 'No material selected'} · ${text.concern(q.concern)}.`;
  const scope = 'Coverage in the loaded collection, not a safety verdict. Flow, geometry, thickness and ignition are not matched.';
  const rules = `Same gravity class; oxygen within ±${TOL.o2} percentage point and pressure within ±${TOL.p} kPa on the same counting source row. Unknown conditions do not match. Facility-inferred pressure is included by the existing rules. Liquid model fuels do not substitute for cabin materials.`;
  const answer = { task, context, result: '', sources: [], explanation: [], trace: 'Cabin → matching rules → source record → answer', scope };
  if (task === 'compare') {
    const pair = compareInvestigations(db, leftId, rightId);
    answer.trace = 'Cabin context → recorded categories → investigation records → comparison';
    if (!pair) { answer.result = 'Choose two different investigations below.'; return answer; }
    answer.result = `${leftId} / ${rightId}: ${pair.short}`;
    answer.sources = [leftId, rightId];
    answer.explanation = [pair.line, ...pair.differences.map(d => `${readable(d.axis)}: ${Array.isArray(d.left) ? d.left.join(', ') || 'Not recorded' : d.left} / ${Array.isArray(d.right) ? d.right.join(', ') || 'Not recorded' : d.right}`), 'Recorded ranges and categories are compared without adjusting for other conditions. This is not a performance ranking or a causal comparison.'];
    return answer;
  }
  if (task === 'rank') {
    const first = rank(db.findings, q, db)[0];
    answer.trace = 'Cabin → relevance formula → finding record → answer';
    if (!first) { answer.result = 'No findings are loaded to rank.'; return answer; }
    answer.result = `${first.f.id}: ${first.total}/100, first by cabin relevance. Relevance is separate from material coverage.`;
    answer.sources = [...new Set([first.f.id, ...(first.f.row_ids || []), ...(first.f.cells || []).map(c => c.row_id)].filter(id => id === first.f.id || db.testById[id]))];
    const sum = Object.values(first.parts).reduce((a,b) => a+b, 0), multiplier = first.f.n.support === 'direct' ? 1 : PARTIAL_SUPPORT;
    answer.explanation = [first.f.claim, ...Object.entries(first.parts).map(([key, value]) => `${readable(key)}: ${Number(value.toFixed(3))}. ${text.term(key, first, q)}`), `Weighted sum ${Number(sum.toFixed(3))} × support ${multiplier}, rounded = ${first.total}. Ties use evidence level, publication year, then identifier. This is the cabin ranking, not lexical search order; it is not a fire probability.`];
    return answer;
  }
  if (!selected) { answer.trace = 'Cabin → material not selected → answer unavailable'; answer.result = 'Choose a cabin material below to answer this question.'; return answer; }
  const c = cell(q.material, q.concern, q, db);
  answer.trace = c.status === 'NEVER_TESTED' ? 'Cabin → matching rules → no supporting record → collection gap' : 'Cabin → matching rules → source records → coverage answer';
  const short = c.status === 'PROVEN' ? `${c.hit_ids.length} nearby source-table rows for this question.` : c.status === 'NEVER_TESTED' ? 'No row or verified finding for this question in the loaded collection.' : c.rows ? `${c.rows} source-table rows; different or incomplete conditions.` : 'Verified finding, but no source-table row for this question.';
  answer.result = `${text.status(c.status, c.qualifier)}. ${short}`;
  answer.sources = [...new Set([...(c.hit_ids || []).slice(0,3), ...(c.nearest ? [c.nearest.id] : []), ...c.finding_ids.slice(0,2)])];
  answer.explanation = [text.cellSentence(c, selected.label, db), rules, text.statusMeaning(c.status, c.qualifier), ...c.reasons.map(reason => text.reasonSentence(reason, { n: db, q })), c.nearest ? `${c.nearest.id} is the nearest recorded row, not a match. Open it to inspect its original conditions.` : '', c.status === 'NEVER_TESTED' ? 'No source identifier answers this material-and-concern question in the loaded collection. A word-search miss is a separate result.' : 'Source identifiers below are supporting or nearest records; inspect the status and conditions before drawing a conclusion.'].filter(Boolean);
  if (task === 'missing') answer.result = c.status === 'PROVEN' ? 'Nearby evidence exists in this collection; flow, geometry, thickness and ignition are not matched.' : `Missing in this collection: ${c.reasons.map(reason => text.reason(reason)).join('; ')}.`;
  return answer;
}
