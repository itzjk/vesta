import { receiptQuery } from '../core/receipt.js';
import { createReproduction, recheckReproduction, MAX_REPRODUCTION_BYTES, DIGEST_DESCRIPTION } from '../core/reproduction.js?v=sebas-20261115-1';
import { downloadJson } from './download.js';

export function receiptControls({ db, getQuery, onReplay } = {}) {
  const wrap = document.createElement('section');
  wrap.className = 'receipt-controls';
  wrap.dataset.receipt = '';
  wrap.setAttribute('aria-label', 'Save and recheck evidence');
  const line = document.createElement('p');
  line.textContent = 'Run this query locally, save its evidence, then reload the JSON to compare the result.';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const button = (label, action) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-small'; b.textContent = label; b.dataset.action = action;
    b.style.minHeight = '44px';
    actions.append(b); return b;
  };
  const reproduce = button('Reproduce locally', 'receipt-reproduce');
  const save = button('Save evidence JSON', 'receipt-save');
  const load = button('Recheck JSON', 'receipt-load');
  const apply = button('Apply checked cabin', 'receipt-apply');
  apply.hidden = true;
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true; input.dataset.receiptInput = '';
  const status = document.createElement('p');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const stamp = document.createElement('div');
  stamp.dataset.reproductionStamp = ''; stamp.hidden = true;
  const note = document.createElement('small');
  note.textContent = 'No upload or remote API call. Hashes check consistency, not authorship, safety or scientific validity.';
  wrap.append(line, actions, input, status, stamp, note);
  let checked = null, serial = 0;
  const busy = value => { reproduce.disabled = save.disabled = load.disabled = apply.disabled = value; wrap.setAttribute('aria-busy', String(value)); };
  const clear = () => { checked = null; apply.hidden = true; stamp.hidden = true; };
  const error = e => { clear(); status.textContent = e.message || 'The evidence receipt could not be processed.'; wrap.dataset.receiptStatus = 'ERROR'; };
  const element = (tag, text) => { const n = document.createElement(tag); if (text != null) n.textContent = text; return n; };
  const known = (value, unit = '') => value == null ? 'unknown' : `${value}${unit}`;
  function showStamp(bundle, result = null) {
    const r = bundle.receipt, q = r.query, c = r.result.coverage;
    const snapshot = element('p', `Snapshot: oxygen ${known(q.oxygen_percent, '%')} · pressure ${known(q.pressure_kpa, ' kPa')} · gravity ${known(q.gravity)} · ${q.material_id ?? 'all materials'} / ${q.concern}.`);
    snapshot.dataset.receiptSnapshot = '';
    const counts = element('p', `${r.result.cells.length} material–concern questions: ${c.PROVEN} nearby evidence · ${c.EXTRAPOLATED} other conditions · ${c.NEVER_TESTED} no source found.`);
    const digest = element('p', `Result SHA-256: ${bundle.integrity.digest.slice(0, 16)}…`);
    digest.dataset.resultDigest = bundle.integrity.digest;
    const detail = element('details');
    const summary = element('summary', 'Snapshot: build, inputs & fingerprints');
    summary.style.cssText = 'min-height:44px;display:list-item;padding:10px 0;box-sizing:border-box;cursor:pointer';
    const values = element('dl'); values.style.margin = '0';
    const field = (label, value, code = false) => {
      const dt = element('dt', label), dd = element('dd');
      dt.style.fontWeight = '600'; dd.style.cssText = 'margin:2px 0 12px;overflow-wrap:anywhere';
      dd.append(element(code ? 'code' : 'span', value)); values.append(dt, dd);
    };
    field('Collection build (not app version)', bundle.collection_build.display || bundle.collection_build.generated_at || 'Not reported');
    if (bundle.collection_build.generated_at) field('Collection build timestamp', bundle.collection_build.generated_at);
    if (result?.build_matches === false) field('Saved build label', result.saved_build?.display || result.saved_build?.generated_at || 'Not reported');
    if (result?.build_matches === false && result.saved_build?.generated_at !== bundle.collection_build.generated_at) field('Saved collection build timestamp', result.saved_build?.generated_at || 'Not reported');
    field('Matching method', r.method.id);
    field('Exact saved inputs', `Oxygen ${known(q.oxygen_percent, '%')}; pressure ${known(q.pressure_kpa, ' kPa')}; gravity ${known(q.gravity)} / ${known(q.gravity_class)}; material ${q.material_id ?? 'all materials'}; concern ${q.concern}.`);
    field('Matching thresholds', `Oxygen ±${r.method.tolerances.oxygen_percentage_points} percentage point(s); pressure ±${r.method.tolerances.pressure_kpa} kPa; ${r.method.gravity}.`);
    field('Collection counts', `${r.basis.investigations} investigations; ${r.basis.source_table_rows} source-table rows; ${r.basis.findings} findings. Rows are not independent burns.`);
    field('Result counts', `${r.result.nearby_cabin_row_ids.length} nearby cabin rows; ${r.evidence.rows.length} referenced row snapshots; ${r.evidence.findings.length} referenced findings.`);
    field('Collection SHA-256', r.basis.digest, true);
    field('Result SHA-256 (inputs + evidence + result)', bundle.integrity.digest, true);
    if (result?.saved_digest) field(result.legacy ? 'Digest derived from legacy file' : 'Saved result SHA-256', result.saved_digest, true);
    field('Digest scope', DIGEST_DESCRIPTION);
    field('Limits', r.method.limits.join(' '));
    detail.append(summary, values);
    stamp.replaceChildren(snapshot, counts, digest, detail); stamp.hidden = false;
  }
  function showChecked(result) {
    wrap.dataset.receiptStatus = result.status; status.textContent = result.message;
    if (result.current) showStamp(result.current, result);
    if (result.matches) {
      checked = receiptQuery(result.current.receipt.query);
      apply.hidden = typeof onReplay !== 'function' || checked.o2 == null || checked.p == null || checked.g == null;
    }
  }
  async function run(action) {
    const request = ++serial;
    clear(); busy(true); status.textContent = 'Calculating from the loaded collection…';
    try {
      const bundle = await createReproduction(db, { ...getQuery() });
      if (request !== serial) return;
      if (action === 'reproduce') {
        const result = await recheckReproduction(JSON.stringify(bundle), db);
        if (request === serial) showChecked(result);
      } else {
        showStamp(bundle);
        downloadJson('vesta-reproduction.json', bundle);
        status.textContent = 'Saved inputs, matching rules, counts, source evidence and both fingerprints. Reload this JSON to recheck.';
        wrap.dataset.receiptStatus = 'SAVED';
      }
    } catch (e) { if (request === serial) error(e); }
    finally { if (request === serial) busy(false); }
  }
  reproduce.addEventListener('click', () => run('reproduce'));
  save.addEventListener('click', () => run('save'));
  load.addEventListener('click', () => { input.value = ''; input.click(); });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const request = ++serial;
    clear(); busy(true); status.textContent = 'Rechecking against the loaded collection…';
    try {
      if (file.size > MAX_REPRODUCTION_BYTES) throw new Error('Choose a reproduction file smaller than 2 MB.');
      const result = await recheckReproduction(await file.text(), db);
      if (request === serial) showChecked(result);
    } catch (e) { if (request === serial) error(e); }
    finally { if (request === serial) busy(false); }
  });
  apply.addEventListener('click', () => {
    if (!checked || typeof onReplay !== 'function') return;
    try { onReplay({ ...checked }); status.textContent = 'Checked cabin applied. Evidence coverage is not a safety certification.'; }
    catch (e) { error(e); }
  });
  for (const event of ['pointerdown', 'wheel']) wrap.addEventListener(event, e => e.stopPropagation());
  return wrap;
}
