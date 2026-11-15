import { createDecisionRecord, recheckDecisionRecord, MAX_RECORD_BYTES, REPLAY_SCOPE } from '../core/replay.js';
import { downloadJson } from './download.js';

export function replayControls({ db, getInput, exportButton = true } = {}) {
  if (!document.querySelector('link[data-replay-style]')) {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('../../css/replay.css', import.meta.url).href;
    css.dataset.replayStyle = ''; document.head.append(css);
  }
  const wrap = document.createElement('section');
  wrap.className = 'replay-controls'; wrap.dataset.replay = '';
  wrap.setAttribute('aria-label', 'Decision log reproducibility');
  const line = document.createElement('p');
  line.textContent = 'Export the full drill, then recheck the same JSON to reproduce its decisions, coverage and sources.';
  const actions = document.createElement('div'); actions.className = 'replay-actions';
  const button = (label, action, help) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-small';
    b.textContent = label; b.dataset.action = action; b.title = help; b.setAttribute('aria-label', help); actions.append(b); return b;
  };
  const save = exportButton ? button('Export decision log', 'replay-save', 'Download the full decision log, telemetry, method and source evidence as JSON') : null;
  const load = button('Recheck decision JSON', 'replay-load', 'Load an exported decision log JSON and rerun the deterministic officer locally');
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true;
  input.dataset.replayInput = ''; input.setAttribute('aria-label', 'Choose an exported decision log JSON');
  const status = document.createElement('p'); status.className = 'replay-status';
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const result = document.createElement('details'); result.hidden = true; result.className = 'replay-result';
  const summary = document.createElement('summary'); summary.textContent = 'Review recalculated decisions';
  const list = document.createElement('div'); result.append(summary, list);
  const note = document.createElement('p'); note.className = 'replay-note'; note.textContent = `Files stay in this browser. ${REPLAY_SCOPE}`;
  wrap.append(line, actions, input, status, result, note);
  const busy = value => { load.disabled = value; if (save) save.disabled = value; wrap.setAttribute('aria-busy', String(value)); };
  const error = e => { status.textContent = e.message || 'The decision log could not be processed.'; wrap.dataset.replayStatus = 'INVALID'; };
  if (save) save.addEventListener('click', async () => {
    busy(true); status.textContent = 'Preparing telemetry, method and evidence…';
    try {
      const { frames, meta } = getInput(), record = await createDecisionRecord(frames, db, meta);
      downloadJson(`${meta.id || 'vesta'}.decision-log.json`, record);
      status.textContent = `Saved ${record.steps.length} decisions with their inputs, method and source evidence.`;
      wrap.dataset.replayStatus = 'SAVED';
    } catch (e) { error(e); } finally { busy(false); }
  });
  load.addEventListener('click', () => { input.value = ''; input.click(); });
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; if (!file) return;
    busy(true); wrap.dataset.replayStatus = 'CHECKING'; result.hidden = true; result.open = false; list.replaceChildren(); status.textContent = 'Rechecking against the loaded collection…';
    try {
      if (file.size > MAX_RECORD_BYTES) throw Error('Choose a decision log smaller than 16 MB.');
      const checked = await recheckDecisionRecord(await file.text(), db);
      wrap.dataset.replayStatus = checked.status;
      status.textContent = `${checked.status}: ${checked.message}${checked.changed?.length ? ` Changed: ${checked.changed.map(k => k === 'basis' ? 'collection' : k).join(', ')}.` : ''}`;
      const record = checked.current ?? checked.saved;
      if (record) {
        summary.textContent = checked.status === 'LEGACY' ? 'Review saved legacy decisions (not rechecked)' : 'Review recalculated decisions';
        result.hidden = false;
        for (const e of record.steps) {
          const item = document.createElement('article'); item.dataset.replayDecision = e.step;
          const title = document.createElement('h3'); title.textContent = `${e.label || e.step}: ${e.state.replaceAll('_', ' ')}`;
          const action = document.createElement('p'); action.textContent = e.action;
          const coverage = document.createElement('p');
          const words = { PROVEN: 'NEARBY EVIDENCE', EXTRAPOLATED: 'OTHER CONDITIONS', NEVER_TESTED: 'NO SOURCE FOUND' };
          coverage.textContent = e.coverage ? `${words[e.coverage.status] || e.coverage.status}: ${e.coverage.reasons.join(', ') || 'same-row conditions match'}` : `NO SOURCE: ${e.gap || 'no evidence recorded'}`;
          const evidence = record.evidence?.find(x => x.step === e.step);
          const sources = document.createElement('p');
          sources.textContent = `Sources: ${[...(evidence?.findings ?? []).map(f => `${f.id} (${f.source?.title || f.source?.url || 'saved finding'})`), ...(e.row_ids ?? []), e.protocol?.finding_id].filter(Boolean).join('; ') || 'none'}`;
          item.append(title, action, coverage, sources); list.append(item);
        }
      }
    } catch (e) { error(e); } finally { busy(false); }
  });
  for (const event of ['pointerdown', 'wheel', 'keydown']) wrap.addEventListener(event, e => e.stopPropagation());
  wrap.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  wrap.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); status.textContent = 'Use Recheck decision JSON to choose an exported log.'; });
  return wrap;
}
