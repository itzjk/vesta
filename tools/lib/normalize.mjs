// VESTA build · normalize.mjs
// Adds the one field `n` to each test row and each finding (DESIGN.md 3.1) and maps the fixed vocabulary of 3.2 rule 7.
// Nothing the data agent or research wrote is changed. Anything that cannot be mapped is counted, never guessed.

export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const key = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');             // names compared without case or punctuation
const topicId = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// --- table notes and the facility default ---------------------------------------------------------------------------------
// notes: config/table-notes.json. pass(id): did this quote row pass the gate. Returns Map psi_id -> resolved note.
export function resolveTableNotes(notes, pass) {
  const byPsi = new Map(), out = [];
  for (const note of notes) {
    const sources = (note.sources ?? []).map((s, i) => ({ ...s, gate: { pass: pass(`note:${note.id}:${i}`) } }));
    const backed = what => !sources.some(s => (s.supports ?? []).includes(what)) || sources.some(s => (s.supports ?? []).includes(what) && s.gate.pass);
    const resolved = { id: note.id, label: note.label ?? null, cabin: !!note.cabin && backed('cabin'), fuel_class: note.fuel_class ?? 'none',
                       pillars: (note.pillars ?? []).filter(backed), facility: note.facility ?? null, basis: note.basis ?? null, why: note.why ?? null, sources,
                       withheld: [...(note.cabin && !backed('cabin') ? ['cabin'] : []), ...(note.pillars ?? []).filter(p => !backed(p))] };
    out.push({ ...resolved, tables: note.tables ?? [] });
    for (const psi of note.tables ?? []) byPsi.set(psi, resolved);
  }
  return { byPsi, list: out };
}
const NO_NOTE = { id: null, cabin: false, fuel_class: 'none', pillars: [], facility: null };
const GRAVITY = { microgravity: 'micro' };                                 // exact map of row.gravity; no other value occurs today

// rows: data/tests.json tests. Returns rows with `n` (the row object is copied, never changed) and what could not be mapped.
export function normalizeRows(rows, noteByPsi, facility, facilityPass, warn) {
  const unmappedGravity = new Map();
  const out = rows.map(row => {
    const note = noteByPsi.get(row.psi_id) ?? NO_NOTE;
    if (!noteByPsi.has(row.psi_id)) warn('table_without_note', { psi_id: row.psi_id });
    let gclass = null;
    if (row.gravity != null) { gclass = GRAVITY[row.gravity] ?? null; if (gclass == null) unmappedGravity.set(row.gravity, (unmappedGravity.get(row.gravity) || 0) + 1); }
    const fac = note.facility ? facility[note.facility] : null;
    const pInferred = row.pressure_kpa == null && fac && facilityPass(note.facility) && (fac.tables ?? []).includes(row.psi_id) ? fac.pressure_kpa : null;
    const n = { material_id: row.fuel == null ? null : slug(row.fuel), fuel_class: note.fuel_class, cabin: note.cabin, pillars: [...note.pillars], gclass,
                o2: row.o2_basis === 'ambient' && typeof row.o2_percent === 'number' ? row.o2_percent : null,
                p: typeof row.pressure_kpa === 'number' ? row.pressure_kpa : null, p_inferred: pInferred,
                counts: row.row_kind === 'test' || row.row_kind === 'test_group_reference' };
    return { ...row, n };
  });
  for (const [value, count] of unmappedGravity) warn('unmapped_row_gravity', { value, rows: count });
  return out;
}

// --- vocabulary of 3.2 rule 7 -------------------------------------------------------------------------------------------
const WORK = { 'flight experiment': 'flight', 'flight': 'flight', 'ground low-gravity': 'ground_lowg', 'normal-gravity test': 'normal_g',
               'model or analysis': 'model', 'model': 'model', 'review or summary': 'summary', 'summary': 'summary', 'operations': 'operations' };
export function workOf(f, warn) {
  const raw = String(f.evidence_level ?? '').toLowerCase().split(' (')[0].trim();
  if (WORK[raw]) return WORK[raw];
  warn('unmapped_evidence_level', { id: f.id, value: f.evidence_level ?? null });
  return 'summary';
}
const isDoi = id => /^10\.\d{4,9}\/\S+$/.test(String(id ?? ''));
export function readInOf(source) {
  const s = source ?? {}, kind = String(s.kind ?? '');
  if (kind === 'psi-table') return 'psi_table';
  if (kind === 'psi') return 'psi_record';
  if (kind === 'challenge-page') return 'challenge_page';
  if (s.text_file === 'raw/nasa/researchers-guide-combustion.txt') return 'nasa_review';
  if (kind === 'ntrs' || (kind === 'pdf' && /^\d+$/.test(String(s.id ?? '')))) return 'nasa_report';
  if (isDoi(s.id)) return 'pi_paper';
  return 'nasa_page';
}
export const supportOf = f => typeof f.verified?.support === 'string' && /^partial/i.test(f.verified.support.trim()) ? 'partial' : 'direct';
const HABITAT = { spacecraft: 'spacecraft', station: 'station', lunarbase: 'lunar-base', marsbase: 'mars-base', pressurizedrover: 'rover' };
export function habitatsOf(f, warn) {
  const out = [];
  for (const tag of f.environment_relevance ?? []) {
    const k = String(tag).toLowerCase().replace(/[^a-z]+/g, '');
    if (HABITAT[k]) { if (!out.includes(HABITAT[k])) out.push(HABITAT[k]); }
    else if (k !== 'earth') warn('unmapped_environment', { id: f.id, value: tag });
  }
  return out;
}
// A finding is offered to the gate only when its reviewer confirmed the quote and did not deny the support.
export const reviewed = f => (f.verified?.quote === true || f.verified?.quote === 'exact match') && f.verified?.support !== false && f.verified?.support !== 'none' && f.verified?.support != null;

// --- investigation names -> PSI ids --------------------------------------------------------------------------------------
// names: config/families.json names. psi: the 24 kept PSI records. tables: data/tests.json tables. research: reviewed investigation records.
export function nameMap(names, psi, tables, research) {
  const m = new Map(), kept = new Set(psi.map(p => p.psi_id));
  const add = (name, id) => { const k = key(name); if (k && id && kept.has(id) && !m.has(k)) m.set(k, id); };
  for (const [name, id] of Object.entries(names ?? {})) add(name, id);
  for (const p of psi) { add(p.psi_id, p.psi_id); add(p.short_name, p.psi_id); add(p.title, p.psi_id); }
  for (const t of tables) add(t.investigation, t.psi_id);
  for (const r of research) if (r.psi_id) { add(r.name, r.psi_id); add(r.full_name, r.psi_id); }
  return { get(name) { if (name == null) return null; const k = key(name); if (m.has(k)) return m.get(k);
                       const explicit = String(name).match(/\bPSI-\d+\b/); return explicit && kept.has(explicit[0]) ? explicit[0] : null; } };
}

// Materials named in the verbatim text: the tidy names of the cabin tables, as whole words. No alias list.
export function materialsIn(text, materials) {
  const out = [];
  for (const [id, m] of Object.entries(materials)) {
    const esc = String(m.label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    if (new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, 'i').test(text)) out.push(id);
  }
  return out;
}
const single = xs => { const s = [...new Set(xs.filter(x => x != null))]; return s.length === 1 ? s[0] : null; };
const span = xs => { const v = xs.filter(x => typeof x === 'number'); if (!v.length) return null; const lo = Math.min(...v), hi = Math.max(...v); return lo === hi ? lo : [lo, hi]; };

// The conditions of a finding that names its rows (f.row_ids): read from those rows, never from prose.
export function fromRows(rows) {
  const inferred = rows.every(r => r.n.p == null && r.n.p_inferred != null);
  return { o2: span(rows.map(r => r.n.o2)), p: span(rows.map(r => r.n.p)), p_inferred: inferred ? span(rows.map(r => r.n.p_inferred)) : null,
           gclass: single(rows.map(r => r.n.gclass)), material_ids: [...new Set(rows.map(r => r.n.material_id).filter(Boolean))], fuel_class: single(rows.map(r => r.n.fuel_class)) };
}

// n of a finding. gated: the answer of the conditions gate (or of fromRows). ctx: { psi_id, work, isSeed, materials, tableClassByPsi }.
export function findingN(f, gated, ctx, warn) {
  const work = ctx.work, EXPERIMENT = ['flight', 'ground_lowg', 'normal_g'];
  let material_ids = gated.material_ids ?? ctx.material_ids ?? [];
  let fuel_class = gated.fuel_class ?? null;
  if (gated.fuel_class === undefined) {
    if (ctx.isSeed && f.fuel_class !== undefined) fuel_class = f.fuel_class ?? null;            // the seed table's own column
    else if (material_ids.length) fuel_class = single(material_ids.map(id => ctx.materials[id]?.fuel_class));
    else if (ctx.psi_id && EXPERIMENT.includes(work)) fuel_class = ctx.tableClassByPsi.get(ctx.psi_id) ?? null;   // a test result of that investigation
  }
  const n = { psi_id: ctx.psi_id ?? null, work, read_in: readInOf(f.source), support: supportOf(f),
              gclass: gated.gclass ?? null, o2: gated.o2 ?? null, p: gated.p ?? null,
              material_ids, fuel_class: fuel_class === 'none' ? null : fuel_class, habitats: habitatsOf(f, warn), topic: topicId(f.topic),
              dropped: (gated.dropped ?? []).map(d => d.field) };
  if (gated.p_inferred != null) n.p_inferred = gated.p_inferred;
  return n;
}
