import { createReceipt, recheckReceipt, receiptQuery, MAX_RECEIPT_BYTES } from '../core/receipt.js';
import { downloadJson } from './download.js';

export function receiptControls({ db, getQuery, onReplay } = {}) {
  const wrap = document.createElement('section');
  wrap.className = 'receipt-controls';
  wrap.dataset.receipt = '';
  wrap.setAttribute('aria-label', 'Save and recheck evidence');
  const line = document.createElement('p');
  line.textContent = 'Keep this cabin and its source rows. Recheck the JSON here later.';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const button = (label, action) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-small'; b.textContent = label; b.dataset.action = action;
    actions.append(b); return b;
  };
  const save = button('Save evidence JSON', 'receipt-save');
  const load = button('Recheck JSON', 'receipt-load');
  const apply = button('Apply checked cabin', 'receipt-apply');
  apply.hidden = true;
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true; input.dataset.receiptInput = '';
  const status = document.createElement('p');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const note = document.createElement('small');
  note.textContent = 'Files stay in this browser. Rechecking is not scientific validation.';
  wrap.append(line, actions, input, status, note);
  let checked = null;
  const busy = value => { save.disabled = load.disabled = apply.disabled = value; wrap.setAttribute('aria-busy', String(value)); };
  const error = e => { status.textContent = e.message || 'The evidence receipt could not be processed.'; wrap.dataset.receiptStatus = 'ERROR'; };
  save.addEventListener('click', async () => {
    busy(true); status.textContent = 'Preparing source rows…';
    try {
      const receipt = await createReceipt(db, getQuery());
      downloadJson('vesta-evidence-receipt.json', receipt);
      status.textContent = `Saved ${receipt.evidence.rows.length} referenced rows and the calculated coverage.`;
      wrap.dataset.receiptStatus = 'SAVED';
    } catch (e) { error(e); } finally { busy(false); }
  });
  load.addEventListener('click', () => { input.value = ''; input.click(); });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    checked = null; apply.hidden = true; busy(true); status.textContent = 'Rechecking against the loaded collection…';
    try {
      if (file.size > MAX_RECEIPT_BYTES) throw new Error('Choose an evidence receipt smaller than 2 MB.');
      const result = await recheckReceipt(await file.text(), db);
      wrap.dataset.receiptStatus = result.status; status.textContent = result.message;
      if (result.matches) {
        checked = receiptQuery(result.current.query);
        apply.hidden = typeof onReplay !== 'function' || checked.o2 == null || checked.p == null || checked.g == null;
      }
    } catch (e) { error(e); } finally { busy(false); }
  });
  apply.addEventListener('click', () => {
    if (!checked || typeof onReplay !== 'function') return;
    try { onReplay({ ...checked }); status.textContent = 'Checked cabin applied. Evidence coverage is not a safety certification.'; }
    catch (e) { error(e); }
  });
  for (const event of ['pointerdown', 'wheel']) wrap.addEventListener(event, e => e.stopPropagation());
  return wrap;
}
