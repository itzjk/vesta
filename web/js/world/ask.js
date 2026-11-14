import { match } from '../core/match.js';
import { rank } from '../core/rank.js';
import { summarize, axisText } from '../views/investigations.js';

export const NO_MATCH = "No verified source in VESTA's evidence base.";
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
  return db.findings.filter(f => f.gate?.pass === true && f.verified?.quote === true).flatMap(finding => {
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
