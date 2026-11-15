import { evidenceRegister } from './evidence-register.js?v=expert-20261115-1';
import { isMeasure } from './match.js';

// Completeness of normalized comparison fields, not experimental quality.
export function conditionAvailability(record) {
  const n = record?.n || {};
  const oxygen = isMeasure(n.o2), gravity = n.gclass != null;
  const pressure = isMeasure(n.p), inferred = n.p == null && isMeasure(n.p_inferred);
  return { oxygen, gravity, pressure, inferred,
    state: !oxygen || !gravity || !(pressure || inferred) ? 'missing' : inferred ? 'inferred' : 'reported' };
}

export function collectionAvailability(db) {
  const counts = { gravity: 0, oxygen: 0, pressure: 0, pressure_inferred: 0, complete_reported: 0, complete_inferred: 0, incomplete: 0 };
  for (const row of db.tests) {
    const a = conditionAvailability(row);
    counts.gravity += Number(a.gravity); counts.oxygen += Number(a.oxygen); counts.pressure += Number(a.pressure); counts.pressure_inferred += Number(a.inferred);
    counts[a.state === 'reported' ? 'complete_reported' : a.state === 'inferred' ? 'complete_inferred' : 'incomplete']++;
  }
  return { total: db.tests.length, ...counts };
}

const words = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('en').replace(/[_–—-]/g, ' ').replace(/\s+/g, ' ').trim();
export function browseEvidence(db, q, filters = {}) {
  const model = evidenceRegister(db, q, filters);
  const terms = words(filters.search).split(' ').filter(Boolean);
  const entries = model.entries.filter(entry => {
    const r = entry.record;
    if (r) {
      if (filters.investigation && (r.psi_id || r.n?.psi_id || '') !== filters.investigation) return false;
      if (filters.level && r.n?.work !== filters.level) return false;
      if (filters.conditions && conditionAvailability(r).state !== filters.conditions) return false;
    }
    const label = entry.materials.map(id => db.materials[id]?.label || id).join(' ');
    const searchable = words([entry.id, label, ...entry.concerns, r?.claim, r?.quote, r?.title, r?.source?.title, r?.source?.id,
      r?.investigation, r?.psi_id, r?.n?.psi_id, r?.fuel, r?.table_file, r?.test_label].filter(Boolean).join(' '));
    return terms.every(term => searchable.includes(term));
  });
  const filteredCoverage = {};
  for (const entry of entries) filteredCoverage[entry.status] = (filteredCoverage[entry.status] || 0) + 1;
  return { ...model, count: entries.length, entries, filteredCoverage };
}

// One query for the register score, comparison strip and source dialog. Never mutates the cabin.
export function registerQuery(q, filters = {}) {
  return { ...q, material: filters.material || null, concern: filters.concern || q.concern };
}
