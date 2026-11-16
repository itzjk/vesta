import { modelRows } from '../core/outcome-model.js?v=flex-frame-20261115-1';
import { FRAME_LABEL, frameSummary, fuelBreakdown } from '../core/outcome-summary.js?v=flex-frame-20261115-1';

// One lazy worker per loaded index, shared by mounted views; no CPU model work
// runs on the animation thread. Source rows cross the boundary only once.
const workers = new WeakMap();
function acquireWorker(db) {
  let service = workers.get(db);
  if (service) { service.users++; return service; }
  if (typeof Worker !== 'function') throw new Error('This browser cannot run the background table calculation.');
  const worker = new Worker(new URL('./outcome-worker.js?v=flex-frame-20261115-1', import.meta.url), { type: 'module' });
  let serial = 0, sentRows = false, closed = false;
  const pending = new Map();
  const fail = message => {
    if (closed) return; closed = true; worker.terminate(); workers.delete(db);
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error(message)); }
    pending.clear();
  };
  service = { users: 1, run(query) {
    if (closed) return Promise.reject(new Error('The background calculation stopped. Retry to restart it.'));
    const id = ++serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => fail('The background calculation timed out. Retry to restart it.'), 45000);
      pending.set(id, { resolve, reject, timer });
      try { worker.postMessage({ id, query, ...(sentRows ? {} : { rows: db.tests }) }); sentRows = true; }
      catch (error) { fail(error.message || 'Source rows could not be sent to the background calculation.'); }
    });
  }, release() { if (--service.users <= 0) fail('The table view was closed.'); } };
  worker.onmessage = event => {
    const message = event.data, item = pending.get(message?.id); if (!item) return;
    clearTimeout(item.timer); pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error)); else item.resolve(message);
  };
  worker.onerror = event => { event.preventDefault(); fail('The background table calculation failed to load or run. Retry to restart it.'); };
  worker.onmessageerror = () => fail('The background calculation returned unreadable data. Retry to restart it.');
  workers.set(db, service); return service;
}
const percent = value => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'not available';
const fields = [
  ['oxygen_percent', 'Oxygen (% by volume)', row => row.n.o2],
  ['pressure_kpa', 'Pressure (kPa)', row => row.n.p],
  ['co2_fraction', 'Carbon dioxide (fraction, 0–1)', row => row.composition.co2],
  ['helium_fraction', 'Helium (fraction, 0–1)', row => row.composition.he],
  ['droplet_diameter_mm', 'Initial droplet diameter (mm)', row => row.conditions.droplet_diameter_mm.value]
];
const make = (tag, text, cls) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (cls) node.className = cls; return node; };
const readable = value => String(value).replaceAll('_', ' ');

/** Explicit-run, table-only model view. onSource receives the original source-row ID. */
export function createOutcomePanel({ db, onSource } = {}) {
  if (!db || !Array.isArray(db.tests)) throw new TypeError('The FLEX table view requires loaded source rows.');
  if (!document.querySelector('link[data-vesta-outcome-panel]')) {
    const sheet = make('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('../../css/outcome-panel.css?v=flex-frame-20261115-1', import.meta.url).href;
    sheet.dataset.vestaOutcomePanel = ''; document.head.append(sheet);
  }
  const element = make('section', null, 'outcome-panel'); element.setAttribute('aria-label', 'FLEX droplet table model');
  const title = make('h3', 'How did similar FLEX droplet tests end?');
  const frame = make('div', null, 'op-frame'), frameLabel = make('p', FRAME_LABEL, 'op-frame-label'), frameLine = make('p', 'Held-out results load in the background when this view opens.', 'op-frame-line');
  frameLine.setAttribute('aria-live', 'polite'); frame.append(frameLabel, frameLine);
  const fuelTable = make('div', null, 'op-fuels'); fuelTable.hidden = true;
  const scope = make('p', 'One NASA table · methanol/heptane droplets · microgravity. Not a cabin-material, lunar-gravity or safety prediction.', 'op-limit');
  const caveat = make('p', 'A same-fuel neighbour vote describes the loaded table. Vote fractions are not calibrated probabilities.', 'op-limit');
  const form = make('form', null, 'op-form'), controls = new Map();
  const fuelLabel = make('label', 'Recorded fuel'), fuel = make('select'); fuelLabel.append(fuel); form.append(fuelLabel);
  const usable = modelRows(db.tests).rows;
  const fuels = [...new Set(usable.map(row => row.fuel))].sort();
  for (const name of fuels) { const option = make('option', name); option.value = name; fuel.append(option); }
  for (const [key, label] of fields) {
    const wrapper = make('label', label), input = make('input'); input.type = 'number'; input.step = 'any'; input.required = true;
    input.min = key === 'pressure_kpa' || key === 'droplet_diameter_mm' ? '0.000001' : '0';
    if (key === 'oxygen_percent') input.max = '100';
    if (key === 'co2_fraction' || key === 'helium_fraction') input.max = '1';
    input.name = key; wrapper.append(input); form.append(wrapper); controls.set(key, input);
  }
  const example = make('p', null, 'op-example'), exampleSource = make('button'); exampleSource.type = 'button'; exampleSource.className = 'op-source';
  const exampleButton = make('button', 'Use recorded input example'); exampleButton.type = 'button';
  const run = make('button', 'Run table estimate'); run.type = 'submit'; run.className = 'op-run';
  const actions = make('div', null, 'op-actions'); actions.append(run, exampleButton); form.append(actions);
  const status = make('p', 'Choose pre-test inputs, then run the table estimate.', 'op-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const result = make('section', null, 'op-result'); result.hidden = true; result.setAttribute('aria-label', 'Same-table neighbour vote');
  const auditDownload = make('button', 'Download validation report'); auditDownload.type = 'button'; auditDownload.hidden = true;
  const evaluation = make('section', null, 'op-evaluation'); evaluation.hidden = true; evaluation.setAttribute('aria-label', 'Held-out test-day evaluation');
  const method = make('details', null, 'op-method'); method.append(make('summary', 'Method and limits'), make('p', 'Inputs are recorded pre-test oxygen, pressure, carbon dioxide, helium and initial droplet diameter. Only neighbours of the same recorded fuel vote. Post-test measurements are excluded from inputs.'), make('p', 'The separate evaluation holds out whole test days. Scaling and k are chosen from training days only. The majority baseline always answers the most common end state in those training days. This is internal validation on one table, not independent scientific validation or evidence that the model transfers to another experiment.'), make('p', 'Within each same-fuel input range does not mean a tested combination. Unrecorded configuration differences and small classes remain limitations. Do not interpret the vote as a confidence, probability, fire risk or safety verdict.'));
  element.append(title, frame, fuelTable, scope, caveat, form, example, exampleSource, status, result, evaluation, auditDownload, method);
  let disposed = false, busy = false, sequence = 0, inputExample = null, workerService = null, latestExport = null;
  const cleanups = [];
  const listen = (node, type, fn) => { node.addEventListener(type, fn); cleanups.push(() => node.removeEventListener(type, fn)); };
  function sourceButton(id) { const button = make('button', id, 'op-source'); button.type = 'button'; button.disabled = typeof onSource !== 'function'; button.onclick = event => onSource?.(id, event.currentTarget); return button; }
  function loadExample() {
    latestExport = null; auditDownload.hidden = true;
    inputExample = usable.find(row => row.fuel === fuel.value) || null;
    if (!inputExample) { example.textContent = 'No complete input example is available.'; exampleSource.hidden = true; return; }
    for (const [key, , getter] of fields) controls.get(key).value = String(getter(inputExample));
    example.textContent = `Inputs copied from ${inputExample.id}. This is a training-table example, not a held-out prediction.`;
    exampleSource.textContent = `Open input example ${inputExample.id}`; exampleSource.hidden = false; exampleSource.disabled = typeof onSource !== 'function';
    result.hidden = true;
  }
  listen(exampleSource, 'click', event => { if (inputExample) onSource?.(inputExample.id, event.currentTarget); });
  listen(exampleButton, 'click', loadExample);
  listen(fuel, 'change', loadExample);
  for (const input of controls.values()) listen(input, 'input', () => { inputExample = null; latestExport = null; auditDownload.hidden = true; example.textContent = 'Custom pre-test inputs. The estimate still uses the loaded training table.'; exampleSource.hidden = true; result.hidden = true; });
  listen(auditDownload, 'click', () => {
    if (!latestExport || disposed) return;
    const content = { schema: 'vesta.flex-table-model-audit/1', artifact_created_at: new Date().toISOString(),
      scope: 'Exploratory pattern in the FLEX droplet source table, not a cabin or safety prediction.',
      validation: latestExport.evaluation,
      same_table_vote: { query: latestExport.query, result: latestExport.estimate,
        label: 'Full-training-table neighbour vote; not a held-out prediction. The input row may vote for itself. Vote fractions are not calibrated probabilities.' },
      limits: ['Internal held-out known test dates, not independent campaigns or external validation.', 'Read the overall majority and same-fuel baselines, abstention coverage and per-class recall before interpreting the model.'] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2) + '\n'], { type: 'application/json' }));
    const anchor = make('a'); anchor.href = url; anchor.download = 'vesta-flex-validation-report.json'; anchor.hidden = true;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  function showFrame(value) {
    const summary = frameSummary(value), breakdown = fuelBreakdown(value);
    frameLabel.textContent = summary.label;
    frameLine.textContent = summary.sentence || 'No held-out rows could be evaluated in this table.';
    if (!summary.sentence || !breakdown.fuels.length) { fuelTable.hidden = true; return; }
    const table = make('table'), head = make('tr'), body = make('tbody');
    table.append(make('caption', 'Held-out rows by recorded fuel. Baseline: most common end state of the training days.'));
    ['Fuel', 'Rows', 'Answered', 'Vote right', 'Baseline right, answered rows', 'Baseline right, all rows'].forEach((text, i) => { const cell = make('th', text); cell.scope = 'col'; if (i) cell.className = 'op-num'; head.append(cell); });
    const thead = make('thead'); thead.append(head);
    for (const item of [...breakdown.fuels, breakdown.total]) {
      const row = make('tr'), name = make('th', item.fuel); name.scope = 'row'; row.append(name);
      for (const text of [item.rows, item.answered, `${item.correct}/${item.answered}`, `${item.answered_baseline_correct}/${item.answered}`, `${item.baseline_correct}/${item.rows}`]) row.append(make('td', String(text), 'op-num'));
      body.append(row);
    }
    table.append(thead, body); fuelTable.replaceChildren(table); fuelTable.hidden = false;
  }
  // The held-out evaluation is the same for every query, so it is fetched once, in the worker, when the view is first shown.
  let framed = false, watcher = null;
  async function loadFrame() {
    if (disposed || framed || !usable.length) return; framed = true;
    try {
      if (!workerService) workerService = acquireWorker(db);
      const response = await workerService.run(null);
      if (!disposed && response.evaluation) showFrame(response.evaluation);
    } catch { if (!disposed) { framed = false; workerService?.release(); workerService = null; frameLine.textContent = 'Held-out results could not be loaded. Run the table estimate to retry.'; } }
  }
  function showEvaluation(value) {
    evaluation.replaceChildren(make('h4', 'Separate held-out test-day evaluation'));
    evaluation.append(make('p', `All held-out rows: model ${value.correct}/${value.rows} correct (${percent(value.accuracy)}), majority baseline ${value.baseline_correct}/${value.rows} (${percent(value.baseline_accuracy)}). ${value.beats_baseline ? 'A descriptive result on this table only.' : 'The model does NOT beat the overall majority baseline.'}`, 'op-weakness'),
      make('p', `Answered ${value.answered}/${value.rows} (${percent(value.coverage)}); abstained on ${value.abstained}. Abstentions count as incorrect in the all-row comparison.`),
      make('p', `On the answered subset only: model ${value.correct}/${value.answered} (${percent(value.accepted_accuracy)}); majority baseline ${value.accepted_baseline_correct}/${value.answered} (${percent(value.accepted_baseline_accuracy)}); same-fuel baseline ${percent(value.accepted_fuel_baseline_accuracy)}. This selected-subset result does not establish overall superiority.`),
      make('p', `All-row same-fuel majority baseline: ${value.fuel_baseline_correct}/${value.rows} (${percent(value.fuel_baseline_accuracy)}).`),
      make('p', `${value.test_days} held-out known test dates · ${value.rows} usable rows of ${value.rows_in_table} outcome-labelled rows · ${value.rows_excluded} excluded: ${value.exclusions?.missing_input ?? 0} missing pre-test input, ${value.exclusions?.unavailable_test_date ?? 0} unavailable normalized test date, ${value.exclusions?.unsupported_record ?? 0} unsupported record. Excluded normalized dates are not necessarily absent from the raw source. Dates are not independent campaigns; this is not external validation.`));
    const recalls = make('ul');
    for (const label of value.classes) {
      const total = value.class_recall?.[label]?.total ?? Object.entries(value.confusion).filter(([key]) => key.startsWith(`${label}>`)).reduce((sum, [, count]) => sum + count, 0);
      const correct = value.class_recall?.[label]?.correct ?? value.confusion[`${label}>${label}`] ?? 0;
      const item = make('li', `${readable(label)} recall: ${correct}/${total} (${total ? percent(correct / total) : 'not available'}).`);
      if (label === 'completion') { item.className = 'op-weakness'; item.append(document.createTextNode(' Weak performance: do not rely on this model to identify completion.')); }
      recalls.append(item);
    }
    evaluation.append(recalls, make('p', 'These held-out results are not the accuracy of the example vote shown above.')); evaluation.hidden = false;
  }
  function showVote(value, checked) {
    const heading = make('h4', 'Same-table neighbour vote'); heading.tabIndex = -1;
    result.replaceChildren(heading);
    const completion = checked.class_recall?.completion;
    result.append(make('p', `Held-out all-row accuracy: ${percent(checked.accuracy)} vs ${percent(checked.baseline_accuracy)} majority baseline. ${checked.beats_baseline ? 'Table-only result.' : 'Does NOT beat the overall baseline.'} Answered ${checked.answered}/${checked.rows}.${completion ? ` Completion recall: ${completion.correct}/${completion.total}; weak performance.` : ''}`, 'op-weakness'));
    if (!value.outcome) {
      const reasons = { outside_table_range: 'No estimate: these inputs lie outside the recorded same-fuel table range.', fuel_not_in_table: 'No estimate: this fuel is absent from the usable table.', missing_input: 'No estimate: all five pre-test inputs must be finite numbers.', invalid_input: 'No estimate: the inputs are physically inconsistent or invalid. Check the gas fractions and positive dimensions.', outside_joint_support: 'No estimate: the joint input combination is too far from the recorded same-fuel examples, even if individual values fall inside their ranges.' };
      result.append(make('p', reasons[value.reason] || `No estimate: ${readable(value.reason || 'unavailable')}.`, 'op-limit'));
      if (value.outside?.length) result.append(make('p', `Outside range: ${value.outside.map(readable).join(', ')}.`));
      if (value.reason === 'outside_joint_support' && Number.isFinite(value.nearest_distance)) result.append(make('p', `Nearest standardized distance: ${value.nearest_distance.toFixed(2)}; table support threshold: ${Number.isFinite(value.support_threshold) ? value.support_threshold.toFixed(2) : 'unavailable'}. These are support checks, not physical confidence.`));
    } else {
      result.append(make('p', `Most-voted end state: ${readable(value.outcome)}.`));
      const votes = make('p'); const total = Object.values(value.votes).reduce((sum, count) => sum + count, 0);
      votes.textContent = Object.entries(value.votes).map(([label, count]) => `${readable(label)} ${count}/${total}`).join(' · ') + '. Vote fractions, not probabilities.';
      const rowLinks = make('div', null, 'op-rows'); for (const id of value.neighbour_row_ids) rowLinks.append(sourceButton(id));
      result.append(votes, make('p', `${total} same-fuel neighbours from the full training table (requested k=${value.k}). The input example itself may be a voting row; this is not held-out evaluation.`), make('p', 'Original voting rows'), rowLinks);
    }
    result.hidden = false; heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  listen(form, 'submit', async event => {
    event.preventDefault(); if (disposed || busy || !form.reportValidity()) return;
    const query = { fuel: fuel.value }; for (const [key, input] of controls) query[key] = input.value === '' ? NaN : input.valueAsNumber;
    if (!Object.values(query).slice(1).every(Number.isFinite)) { status.textContent = 'Enter all five numeric pre-test inputs.'; return; }
    const id = ++sequence; busy = true; run.disabled = true; fuel.disabled = true; exampleButton.disabled = true; for (const input of controls.values()) input.disabled = true; form.setAttribute('aria-busy', 'true'); status.setAttribute('role', 'status'); result.hidden = true; latestExport = null; auditDownload.hidden = true;
    status.textContent = 'Calculating in the background: held-out evaluation (cached after first run) and same-table neighbour vote…';
    try {
      if (!workerService) workerService = acquireWorker(db);
      const response = await workerService.run(query);
      if (disposed || id !== sequence) return;
      latestExport = { query, evaluation: response.evaluation, estimate: response.estimate }; auditDownload.hidden = false;
      framed = true; showFrame(response.evaluation); showEvaluation(response.evaluation); const answer = response.estimate; showVote(answer, response.evaluation); status.textContent = answer.outcome ? 'Table vote complete. Read the separate held-out results and limits.' : 'No table estimate returned. See the input/domain limit below.';
    } catch (error) { if (!disposed && id === sequence) { workerService?.release(); workerService = null; status.textContent = `The table estimate could not be completed: ${error.message}. You can retry.`; status.setAttribute('role', 'alert'); } }
    finally { if (!disposed && id === sequence) { busy = false; run.disabled = !usable.length; fuel.disabled = false; exampleButton.disabled = !usable.length; for (const input of controls.values()) input.disabled = false; form.setAttribute('aria-busy', 'false'); } }
  });
  run.disabled = !usable.length; exampleButton.disabled = !usable.length; if (usable.length) loadExample();
  if (!usable.length) frameLine.textContent = 'No usable rows are loaded for this table.';
  else if (typeof IntersectionObserver === 'function') {
    watcher = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { watcher?.disconnect(); watcher = null; loadFrame(); } });
    watcher.observe(element);
  } else frameLine.textContent = 'Held-out results appear after the first run.';
  return { element, dispose() { if (disposed) return; disposed = true; sequence++; watcher?.disconnect(); watcher = null; workerService?.release(); workerService = null; cleanups.splice(0).forEach(remove => remove()); element.remove(); } };
}
