import path from 'node:path';
import { findingTitle } from './lib/titles.mjs';
import { fileURLToPath } from 'node:url';
import { Inputs, ROOT, loadDelivered, loadEvidence, loadOwn, loadAuthored, loadCore } from './lib/load.mjs';
import { runQuoteGate, Texts, sentenceContext, gateSentences, conditionsGate, rowGate, ruleGate, checkReferences, norm } from './lib/gate.mjs';
import { resolveTableNotes, normalizeRows, nameMap, materialsIn, findingN, workOf, fromRows, reviewed } from './lib/normalize.mjs';
import { buildInvestigations } from './lib/investigations.mjs';
import { Writer, stamp, testsCsv, findingsCsv, coverageFile, rankFile, telemetrySchema } from './lib/api.mjs';

export async function build(root = ROOT) {
  const io = new Inputs(root), warn = (kind, extra) => io.warn(kind, extra);
  const delivered = loadDelivered(io), research = loadEvidence(io), own = loadOwn(io), authored = loadAuthored(io), core = await loadCore(io);
  const proofCases = io.exists('config/proof-cases.json') ? io.bytes('config/proof-cases.json') : null;
  if (proofCases) {
    const reviewed = JSON.parse(proofCases.toString('utf8'));
    if (reviewed.schema !== 'vesta.proof-cases/1' || !Array.isArray(reviewed.cases)) throw new Error('Invalid reviewed proof cases');
  }
  for (const rel of ['tools/build.mjs', ...io.list('tools/lib', /\.mjs$/), 'research/tools/quotecheck.py']) io.touch(rel);
  const eligible = research.families.filter(f => f.verified && (!['acme', 'droplets', 'others'].includes(f.family) || f.verification));
  for (const f of research.families.filter(f => f.verified && !eligible.includes(f))) warn('research_review_pending', { family: f.family });
  const researchInv = research.merged.investigations ?? eligible.flatMap(f => f.verified_investigations.map(i => ({ ...i, _file: f.verified_file })));
  const names = nameMap(own.families.names, delivered.psi.filter(p => p.in_combustion_science_area), delivered.tests.tables, researchInv);
  const offered = [], duplicates = [], ineligible = [], seenIds = new Set(), seenQuotes = new Map();
  for (const [f, isSeed] of [...own.seedFindings.map(f => [f, true]), ...(research.merged.evidence ?? eligible.flatMap(f => f.verified)).map(f => [f, false])]) {
    if (!isSeed && !reviewed(f)) { ineligible.push(f.id); continue; }
    const q = f.quote ? norm(f.quote) : null;
    if (seenIds.has(f.id) || (q && seenQuotes.has(q))) { duplicates.push({ id: f.id, kept: q ? seenQuotes.get(q) : f.id }); continue; }
    seenIds.add(f.id); if (q) seenQuotes.set(q, f.id);
    offered.push({ f, isSeed });
  }
  for (const line of authored.protocol?.lines ?? []) offered.push({ isSeed: true, f: {
    id: line.finding_id ?? line.id, investigation: null, pillar: 'response', topic: 'iss_fire_response', claim: line.action,
    quote: line.source?.quote, source: line.source, conditions: {}, evidence_level: 'operations', environment_relevance: [],
    verified: { quote: true, support: 'direct' }, si_written: ['claim']
  } });
  const quoteRows = [], addQuote = (id, quote, source) => quoteRows.push({ id, quote, source });
  for (const { f } of offered) {
    if (f.source?.kind !== 'psi-table') addQuote(f.id, f.quote, f.source);
    if (f.conditions_quote) addQuote(`conditions:${f.id}`, f.conditions_quote, f.conditions_source ?? f.source);
  }
  for (const f of delivered.facts) addQuote(`fact:${f.id}`, f.quote, f.source);
  for (const n of own.tableNotes) for (const [i, s] of (n.sources ?? []).entries()) addQuote(`note:${n.id}:${i}`, s.quote, s);
  for (const [id, f] of Object.entries(own.facility)) addQuote(`facility:${id}`, f.source.quote, f.source);
  for (const f of own.families.families ?? []) if (f.source?.quote) addQuote(`family:${f.id}`, f.source.quote, f.source);
  for (const p of authored.presets) for (const [i, s] of (p.sources ?? []).entries()) addQuote(`preset:${p.id}:${i}`, s.quote, s);
  for (const r of quoteRows) if (r.source?.text_file) io.touch(path.posix.join('research', r.source.text_file));
  const gates = runQuoteGate(quoteRows, root), pass = id => gates.get(id)?.pass === true, texts = new Texts(root);
  const { rejected, cut_before_qualifier: cuts } = gateSentences(quoteRows, gates, texts);
  const notes = resolveTableNotes(own.tableNotes, pass);
  const rows = normalizeRows(delivered.tests.tests, notes.byPsi, own.facility, id => pass(`facility:${id}`), warn);
  const rowById = new Map(rows.map(r => [r.id, r])), materials = {};
  for (const r of rows) if (r.n.cabin && r.n.material_id) materials[r.n.material_id] ??= { label: r.fuel, fuel_class: r.n.fuel_class };
  const tableClassByPsi = new Map([...notes.byPsi].map(([id, n]) => [id, n.fuel_class]));
  const findings = [], dropped = [], rowFailed = [];
  for (const { f, isSeed } of offered) {
    const table = f.source?.kind === 'psi-table';
    if (table) { const g = rowGate(f, rowById); if (!g.pass) { rowFailed.push({ id: f.id, ...g }); rejected.push({ id: f.id, why: g.why }); continue; } }
    else if (!pass(f.id)) continue;
    const psi_id = names.get(f.investigation) ?? (table ? names.get(f.source.id) : null), work = workOf(f, warn);
    const linked = (f.row_ids ?? (table ? [...new Set((f.cells ?? []).map(c => c.row_id))] : [])).map(id => rowById.get(id));
    if (linked.some(r => !r)) { rejected.push({ id: f.id, why: 'unknown row_id' }); continue; }
    const cq = f.conditions_quote && pass(`conditions:${f.id}`) ? f.conditions_quote : '';
    const text = `${f.quote ?? ''} ${cq}`;
    const gated = linked.length ? fromRows(linked) : conditionsGate(f, text, { work, psi_gclass: delivered.psi.find(p => p.psi_id === psi_id)?.project_type === 'Microgravity Investigation' ? 'micro' : null });
    for (const d of gated.dropped ?? []) dropped.push({ id: f.id, ...d });
    const n = findingN(f, gated, { psi_id, work, isSeed, materials, material_ids: materialsIn(text, materials), tableClassByPsi }, warn);
    const ctx = table || f.source.kind === 'challenge-page' ? null : sentenceContext(texts, f.source.text_file, f.quote);
    const title = findingTitle(f);
    const shipped = { ...f, title, kind: table ? 'table' : 'quote', n, context: ctx ? { before: ctx.before, after: ctx.after } : null, gate: { pass: true } };
    if (f.conditions_quote && !cq) { delete shipped.conditions_quote; delete shipped.conditions_source; }
    findings.push(shipped);
  }
  const findingById = new Map(findings.map(f => [f.id, f]));
  const rulesInput = [...own.seedRules, ...(research.merged.rules ?? [])];
  const rules = ruleGate(rulesInput, findingById);
  rules.shipped = rules.shipped.map(r => {
    const cited = r.finding_ids.map(id => findingById.get(id));
    const best = core.rank ? [...cited].sort((a, b) => core.rank.LEVEL[b.n.work] - core.rank.LEVEL[a.n.work])[0] : cited[0];
    return { ...r, nasa_showed: cited[0].quote ?? cited[0].claim, confidence: best.n.work };
  });
  const presetRejected = [], presets = { presets: [], markers: [], bands: [] };
  for (const p of authored.presets) {
    const sources = (p.sources ?? []).map((s, i) => ({ ...s, gate: { pass: pass(`preset:${p.id}:${i}`) } }));
    if (!sources.length || sources.some(s => !s.gate.pass)) { presetRejected.push({ id: p.id, why: 'preset source failed the quote gate' }); continue; }
    presets[p.kind === 'marker' ? 'markers' : p.kind === 'band' ? 'bands' : 'presets'].push({ ...p, sources, gate: { pass: true } });
  }
  const protocol = { ...(authored.protocol ?? {}), lines: (authored.protocol?.lines ?? []).map(p => ({ ...p, gate: { pass: findingById.has(p.finding_id ?? p.id) } })) };
  const known = {
    finding: new Set([...own.seedFindings, ...research.families.flatMap(f => [...f.candidates, ...(f.verified ?? [])]), ...(research.merged.evidence ?? []), ...offered.map(x => x.f)].map(f => f.id)),
    rule: new Set(rulesInput.map(r => r.id)), protocol: new Set(protocol.lines.map(p => p.id)), step: new Set((authored.playbook?.steps ?? []).map(s => s.id)), preset: new Set(authored.presets.map(p => p.id))
  };
  const shippedSets = { finding: new Set(findingById.keys()), rule: new Set(rules.shipped.map(r => r.id)), protocol: new Set(protocol.lines.filter(p => p.gate.pass).map(p => p.id)), step: known.step, preset: new Set(presets.presets.map(p => p.id)) };
  const refs = [], ref = (file, where, id, space) => refs.push({ file, where, id, space });
  for (const s of authored.playbook?.steps ?? []) {
    for (const id of s.rule_ids ?? []) ref('config/playbook.json', s.id, id, 'rule');
    for (const id of s.finding_ids ?? []) ref('config/playbook.json', s.id, id, 'finding');
    for (const id of s.after ?? []) ref('config/playbook.json', s.id, id, 'step');
    ref('config/playbook.json', s.id, s.fallback, 'protocol');
  }
  for (const p of protocol.lines) ref('config/protocol.json', p.id, p.finding_id, 'finding');
  for (const s of authored.scenarios) {
    ref(s.metaRel, 'preset', s.meta.preset, 'preset');
    for (const k of ['one_way_finding', 'round_trip_finding']) ref(s.metaRel, k, s.meta.comm?.[k], 'finding');
  }
  for (const p of authored.presets) for (const s of p.sources ?? []) if (s.finding_id) ref('config/presets.json', p.id, s.finding_id, 'finding');
  const references = checkReferences(refs, known, shippedSets, { protocol: !authored.protocol, preset: !authored.presetsFile });
  io.warnings.push(...references.warnings);
  if (references.dangling.length) throw new Error(`Dangling authored references: ${JSON.stringify(references.dangling)}`);
  if (io.warnings.some(w => w.kind === 'unreadable_input')) throw new Error(`Unreadable inputs: ${JSON.stringify(io.warnings.filter(w => w.kind === 'unreadable_input'))}`);
  const inv = buildInvestigations({ psi: delivered.psi, tests: delivered.tests, rows, facts: delivered.facts, factPass: id => pass(`fact:${id}`), families: own.families, names, findings, research: researchInv, tableNotes: notes.byPsi });
  if (research.merged.investigations) inv.investigations = inv.investigations.map(i => ({ ...i, ...(research.merged.investigations.find(r => r.psi_id === i.psi_id) ?? {}) }));
  const sourcesMap = new Map();
  for (const f of findings) {
    const s = f.source, key = `${s.kind}:${s.id ?? s.url}`;
    if (!sourcesMap.has(key)) sourcesMap.set(key, { ...(research.merged.sources?.find(x => x.key === key) ?? {}), ...s, key, finding_ids: [] });
    sourcesMap.get(key).finding_ids.push(f.id);
  }
  const time = stamp(io.newest()), generated_at = time.iso;
  const raw = {
    investigations: { generated_at, investigations: inv.investigations, excluded: inv.excluded, related: inv.related, families: inv.families },
    tests: { ...delivered.tests, tests: rows.map(({ raw, ...r }) => r), tables: undefined },
    'tests-raw': Object.fromEntries(rows.map(r => [r.id, r.raw])),
    tables: { facilities: Object.fromEntries(Object.entries(own.facility).filter(([id]) => pass(`facility:${id}`)).map(([id, f]) => [id, { ...f, source: { ...f.source, gate: { pass: true } } }])), tables: delivered.tests.tables.map(t => ({ ...t, note: notes.byPsi.get(t.psi_id) ?? null })), notes: notes.list },
    findings: { generated_at, findings }, rules: { rules: rules.shipped }, sources: { sources: [...sourcesMap.values()] }, presets, protocol,
    playbook: authored.playbook ?? { steps: [] }, scenario: authored.scenarios[0] ? { meta: authored.scenarios[0].meta, frames: authored.scenarios[0].frames } : { meta: null, frames: [] },
    lines: authored.lines ?? {}, tour: authored.tour ?? {}
  };
  const db = core.index ? core.index.buildIndex(raw) : null;
  const coverage = [], ranks = [], logs = [];
  if (db && core.status && core.match) for (const p of db.presets) coverage.push({ id: p.id, ...coverageFile(core, db, p.id, generated_at) });
  if (db && core.rank && core.status) for (const p of db.presets) for (const concern of core.index.CONCERNS) ranks.push({ path: `rank/${p.id}.${concern}.json`, file: rankFile(core, db, p.id, concern, generated_at) });
  if (db && core.officer) for (const s of authored.scenarios) if (s.frames.length) {
    for (const [i, f] of s.frames.entries()) { const bad = core.officer.checkFrame(f); if (bad) throw new Error(`${s.framesRel}:${i + 1}: ${bad}`); }
    logs.push({ id: s.meta.id, file: core.officer.decisionLog(s.frames, db, s.meta) });
  }
  const review = { input: 0, kept_unchanged: 0, kept_with_changes: 0, rejected: 0, pending: 0 };
  const review_coverage = {
    total_families: research.families.length,
    reporting_families: research.families.filter(f => f.verified && f.verification).map(f => f.family),
    unreported_families: research.families.filter(f => f.verified && !f.verification).map(f => f.family),
    missing_verified_families: research.families.filter(f => !f.verified).map(f => f.family),
    withheld_families: research.families.filter(f => !eligible.includes(f)).map(f => f.family),
    scope: 'Review subtotals cover reporting families only. Quote matching is not independent scientific approval.'
  };
  for (const f of eligible) {
    const v = f.verification; if (!v) { warn('review_totals_not_reported', { family: f.family }); continue; }
    review.input += v.input ?? v.input_findings ?? 0; review.kept_unchanged += v.kept_unchanged ?? 0;
    review.kept_with_changes += v.kept_with_changes ?? v.kept_changed ?? 0; review.rejected += v.rejected ?? 0; review.pending += v.pending ?? v.pending_not_reviewed ?? 0;
  }
  const historicalRejects = research.families.flatMap(f => (f.quotecheck ?? []).filter(r => r.pass === false).map(r => ({ id: r.id, why: r.why, origin: f.quotecheck_file })));
  const allRejected = [...new Map([...historicalRejects, ...rejected].map(r => [r.id, r])).values()];
  const rowKinds = {}; for (const r of rows) rowKinds[r.row_kind] = (rowKinds[r.row_kind] ?? 0) + 1;
  const officerCounts = Object.fromEntries(logs.map(l => [l.id, { steps: l.file.steps.length, ...Object.fromEntries(['experiment', 'summary', 'operations'].map(b => [b, l.file.steps.filter(s => s.basis === b).length])), no_source: l.file.steps.filter(s => s.state === 'NO_SOURCE').length }]));
  raw.engine = { generated_at, gate: 'research/tools/quotecheck.py',
    extractor: { psi_records_read: delivered.psi.length, psi_kept: inv.investigations.length, psi_excluded: inv.excluded, tables: delivered.tests.tables.length, test_rows: rows.length, row_kinds: rowKinds, records_without_table: delivered.tests.records_without_table.length, source_texts: delivered.source_texts, ntrs_records: delivered.ntrs_records, facts: delivered.facts.length, candidate_findings: own.seedFindings.length + research.families.reduce((n, f) => n + f.candidates.length, 0), candidate_rules: rulesInput.length },
    verifier: { quotes_checked: quoteRows.length, quotes_verified: [...gates.values()].filter(g => g.pass).length, review, review_coverage, rejected: allRejected, cut_before_qualifier: cuts, conditions_dropped: dropped, row_gate_failed: rowFailed, config_quotes_verified: quoteRows.filter(r => /^(note|facility|preset|family):/.test(r.id) && pass(r.id)).length, duplicates, ineligible, unverified: references.warnings.filter(w => w.space === 'finding').map(w => ({ id: w.id, why: w.kind })), presets_rejected: presetRejected },
    ranker: { findings: findings.length, table_findings: findings.filter(f => f.kind === 'table').length, rules_shipped: rules.shipped.length, rules_dropped: rules.dropped, references_removed: rules.removed, rows_indexed: rows.length, cabin_rows: db?.cabinRows.length ?? null, model_rows: db?.modelRows.length ?? null, burner_stream_rows: rows.filter(r => r.o2_basis === 'burner_stream').length, multi_value_rows: rows.filter(r => Object.keys(r.multi ?? {}).length).length, cells: Object.fromEntries(coverage.map(c => [c.id, c.counts])), rank_files: ranks.length },
    officer: { ...officerCounts, protocol_lines: protocol.lines.filter(p => p.gate.pass).length },
    si_use: { extractor: 'SI agents read cached NASA text and propose findings and rules', verifier: 'deterministic code (quote gate, sentence rule, conditions gate, row gate)', ranker: 'deterministic formula', officer: 'deterministic playbook over verified findings and test rows' }, warnings: io.warnings };
  raw.meta = { schema: 'vesta.meta/1', generated_at, built_display: time.display, scope: 'decision-support prototype, not certified flight software', license_note: 'NASA PSI records and table data: CC0-1.0. Quotes remain attributed to their sources. VESTA interpretations are marked.', counts: { investigations: inv.investigations.length, excluded: inv.excluded.length, tests: rows.length, tables: delivered.tests.tables.length, findings: findings.length, rules: rules.shipped.length, sources: sourcesMap.size, presets: presets.presets.length, protocol_lines: protocol.lines.filter(p => p.gate.pass).length, steps: authored.playbook?.steps.length ?? 0, frames: raw.scenario.frames.length } };
  const writer = new Writer(path.join(root, 'web'));
  for (const [name, value] of Object.entries(raw)) writer.json(`data/${name}.json`, value);
  if (proofCases) writer.write('data/proof-cases.json', proofCases);
  const api = new Map(), jsonApi = (rel, value, count) => { writer.json(`api/v1/${rel}`, value); api.set(rel, { path: rel, count }); };
  for (const name of ['investigations', 'findings', 'tests', 'rules', 'sources', 'presets', 'protocol', 'engine']) jsonApi(`${name}.json`, raw[name], name === 'engine' ? null : name === 'investigations' ? inv.investigations.length : name === 'protocol' ? protocol.lines.length : name === 'presets' ? presets.presets.length : raw[name][name]?.length ?? null);
  if (delivered.testsCsv) { writer.write('api/v1/tests.csv', delivered.testsCsv); api.set('tests.csv', { path: 'tests.csv', count: rows.length }); }
  if (core.csv) {
    writer.write('api/v1/findings.csv', findingsCsv(core.csv, findings)); api.set('findings.csv', { path: 'findings.csv', count: findings.length });
    for (const i of inv.investigations) { const rs = rows.filter(r => r.psi_id === i.psi_id); if (!rs.length) continue; const rel = `tests/${i.psi_id}.csv`; writer.write(`api/v1/${rel}`, testsCsv(core.csv, rs, i)); api.set(rel, { path: rel, count: rs.length }); }
  }
  for (const c of coverage) jsonApi(`coverage/${c.id}.json`, c.file, c.file.cells.length);
  for (const r of ranks) jsonApi(r.path, r.file, r.file.results.length);
  for (const l of logs) jsonApi(`officer/${l.id}.json`, l.file, l.file.steps.length);
  for (const s of authored.scenarios) {
    jsonApi(`scenarios/${s.meta.id}.meta.json`, s.meta, null);
    if (s.framesBytes) { const rel = `scenarios/${s.meta.id}.jsonl`; writer.write(`api/v1/${rel}`, s.framesBytes); api.set(rel, { path: rel, count: s.frames.length }); }
  }
  if (core.officer) jsonApi('telemetry.schema.json', telemetrySchema(core.officer), null);
  jsonApi('index.json', { schema: 'vesta.api/1', generated_at, scope: raw.meta.scope, license_note: raw.meta.license_note, weights: core.rank?.W ?? null, levels: core.rank?.LEVEL ?? null, spans: core.rank?.SPAN ?? null, tolerances: core.match?.TOL ?? null, reasons: core.text?.reasons(inv.investigations.length) ?? {}, schemas: ['vesta.meta/1', 'vesta.telemetry/1', 'vesta.scenario/1', 'vesta.design-report/1', 'vesta.decision-log/1'], files: [...api.values(), { path: 'index.json', count: null }] }, null);
  (await import('./lib/provenance.mjs')).writeProvenance({ root, writer, generated_at });
  for (const line of io.lines) console.log(line);
  console.log(`quotes: ${quoteRows.length} checked, ${[...gates.values()].filter(g => g.pass).length} verified, ${rejected.length} rejected`);
  console.log(`sentence: ${cuts.length} cut_before_qualifier; conditions: ${dropped.length} dropped; rows: ${rowFailed.length} rejected`);
  console.log(`rules: ${rules.shipped.length} shipped, ${rules.dropped.length} rejected; references: ${references.dangling.length} dangling`);
  console.log(`presets: ${presets.presets.length} shipped, ${presetRejected.filter(p => authored.presets.find(x => x.id === p.id)?.kind === 'preset').length} rejected`);
  console.log(`markers: ${presets.markers.length} shipped; bands: ${presets.bands.length} shipped; protocol: ${protocol.lines.filter(p => p.gate.pass).length} shipped, ${protocol.lines.filter(p => !p.gate.pass).length} rejected`);
  console.log(`build: ${inv.investigations.length} investigations, ${rows.length} rows, ${findings.length} findings; ${ranks.length} rank, ${coverage.length} coverage, ${logs.length} officer files; ${writer.written} written, ${writer.unchanged} unchanged`);
  return raw;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await build(); } catch (e) { console.error(`Build failed: ${e.message}`); process.exitCode = 1; }
}
