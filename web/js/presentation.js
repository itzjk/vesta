import { buildQuestionModel } from './world/question-model.js?v=expert-20261115-1';
import { createReproduction, recheckReproduction } from './core/reproduction.js?v=expert-20261115-1';

const WIDTH = 1280, HEIGHT = 720, FPS = 30, BITRATE = 6_000_000;
const SUBMISSION_SECONDS = 28, RECORDING_LIMIT_MS = 29_000;
const TAIL = { source: 5, recheck: 4.5, refusal: 4.5, robotics: 7, end: 2.5 };
const $ = id => document.getElementById(id);
const canvas = $('presentation'), ctx = canvas.getContext('2d', { alpha: false });
const iframe = $('source'), preview = $('preview'), record = $('record'), stop = $('stop');
const download = $('download'), frame = $('frame'), status = $('status'), summary = $('record-summary');
const format = $('story-format'), quality = $('quality');
const scene = document.createElement('canvas'); scene.width = WIDTH; scene.height = HEIGHT;
const sceneContext = scene.getContext('2d', { alpha: false });
let generation = 0, run = null, unsubscribe = null, recorder = null, stream = null;
let chunks = [], videoURL = null, videoBlob = null, completed = false, videoComplete = false, lastFrame = 0, drawing = false;
let prepared = null, savedFrames = 0, recordedStart = 0, recordedStop = 0, recordingDeadline = null, videoMode = 'submission';
const mime = typeof MediaRecorder === 'undefined' ? null
  : ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
const canRecord = Boolean(mime && canvas.captureStream);
record.disabled = !canRecord;
if (!canRecord) status.textContent = 'WebM recording is unavailable in this browser. Preview and PNG frames may still work.';

function fit() { document.querySelector('.stage').style.transform = `scale(${document.querySelector('.preview').clientWidth / WIDTH})`; }
const observer = new ResizeObserver(fit); observer.observe(document.querySelector('.preview')); fit();
const font = (size, weight = 400) => `${weight} ${size}px "Source Sans 3", sans-serif`;
function line(text, x, y, size = 28, color = '#ede4d4', weight = 400) {
  ctx.font = font(size, weight); ctx.fillStyle = color; ctx.fillText(String(text), x, y);
}
function wrap(text, x, y, width, size = 30, maxLines = 3, color = '#ede4d4') {
  ctx.font = font(size); ctx.fillStyle = color;
  const words = String(text || '').split(/\s+/); let row = '', count = 0;
  while (words.length && count < maxLines) {
    const word = words.shift(), trial = row ? `${row} ${word}` : word;
    if (ctx.measureText(trial).width > width && row) { ctx.fillText(row, x, y + count++ * size * 1.25); row = word; }
    else row = trial;
  }
  if (row && count < maxLines) {
    if (words.length) row += '…';
    while (ctx.measureText(row).width > width && row.length > 1) row = row.slice(0, -2) + '…';
    ctx.fillText(row, x, y + count++ * size * 1.25);
  }
  return y + count * size * 1.25;
}
function backdrop(dim = 0) {
  ctx.fillStyle = '#0c1012'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.drawImage(scene, 0, 0);
  if (dim) { ctx.fillStyle = `rgba(9,13,15,${dim})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
  const top = ctx.createLinearGradient(0, 0, 0, 220); top.addColorStop(0, '#080c10e8'); top.addColorStop(1, '#080c1000');
  ctx.fillStyle = top; ctx.fillRect(0, 0, WIDTH, 220);
  const bottom = ctx.createLinearGradient(0, 475, 0, HEIGHT); bottom.addColorStop(0, '#080c1000'); bottom.addColorStop(1, '#080c10f5');
  ctx.fillStyle = bottom; ctx.fillRect(0, 475, WIDTH, HEIGHT - 475);
}
function heading(title, context = '') {
  line('VESTA', 48, 42, 22, '#c9ad7a', 500);
  wrap(title, 48, 106, 1180, 55, 2);
  if (context) wrap(context, 48, 160, 1160, 27, 2, '#c6c4bd');
}
function footer(note = 'Prototype · evidence coverage, not safety') {
  line('SI-assisted visuals', 48, 680, 22, '#c6c4bd');
  ctx.font = font(22); const width = ctx.measureText(note).width;
  line(note, WIDTH - 48 - width, 680, 22, '#c6c4bd');
}
function idle() {
  backdrop(); heading('Follow the evidence.');
  line('Choose Start preview or Record WebM.', 48, 585, 30, '#c6c4bd'); footer();
}
idle(); document.fonts.ready.then(() => { if (!run && !savedFrames) idle(); });

function queryFrom(snapshot) {
  const q = snapshot.query;
  return [q?.oxygen_percent, q?.pressure_kpa, q?.gravity, q?.gravity_class, q?.material, q?.concern];
}
function drawTour(snapshot) {
  const captions = {
    question: ['Start with one question.', 'PMMA · fire prevention'],
    cabin: ['Change gravity only.', `O₂ ${snapshot.query.oxygen_percent}% · ${snapshot.query.pressure_kpa} kPa stay fixed.`],
    comparison: ['Watch the evidence change.', 'The same material–concern questions, under different gravity.'],
    gap: ['What is not compared?', 'A nearby atmosphere does not reproduce an entire experiment.'],
    close: ['Coverage is not safety.', 'A missing match is a gap in this collection.']
  };
  const [title, context] = captions[snapshot.phase] || ['Follow the evidence.', 'VESTA collection'];
  backdrop(); heading(title, context);
  if (['question', 'cabin', 'comparison'].includes(snapshot.phase)) {
    line(`${snapshot.coverage.PROVEN} nearby questions`, 48, 565, 46, '#ede4d4', 500);
    line(`of ${snapshot.total} material–concern questions · VESTA collection`, 48, 606, 26, '#c6c4bd');
  } else if (snapshot.phase === 'gap') {
    const labels = (snapshot.notCompared || []).map(value => typeof value === 'string' ? value : value.label || value.key).filter(Boolean);
    wrap(labels.join(' · '), 48, 565, 1140, 30, 2, '#c9ad7a');
  } else {
    line(`${snapshot.coverage.PROVEN} nearby questions in this collection`, 48, 585, 32, '#c9ad7a');
  }
  footer();
}
function samePreparedQuery(snapshot) {
  const expected = prepared.bundle.receipt.query;
  return JSON.stringify(queryFrom(snapshot)) === JSON.stringify([expected.oxygen_percent, expected.pressure_kpa, expected.gravity, expected.gravity_class, expected.material_id, expected.concern]);
}
function drawSubmission(seconds, snapshot) {
  let phase;
  if (seconds < 12) {
    if (!snapshot || snapshot.state !== 'running') throw new Error('The actual evidence walkthrough is unavailable.');
    const changed = snapshot.query.gravity_class === prepared.model.after.gclass;
    phase = changed ? 'contrast' : 'question';
    backdrop();
    heading(changed ? 'Change gravity only.' : 'Can this evidence transfer?', changed ? `O₂ ${snapshot.query.oxygen_percent}% · ${snapshot.query.pressure_kpa} kPa stay fixed` : 'PMMA · fire prevention');
    const value = changed ? `${prepared.model.counts.before.PROVEN} → ${snapshot.coverage.PROVEN}` : String(snapshot.coverage.PROVEN);
    line(value, 48, 535, 74, '#ede4d4', 500);
    line(`of ${snapshot.total} questions have nearby evidence`, 48, 580, 34, '#ede4d4');
    line(changed ? 'Microgravity → lunar gravity · VESTA collection' : 'Microgravity · VESTA collection', 48, 625, 30, '#c9ad7a');
  } else if (seconds < 18) {
    phase = 'source';
    if (!samePreparedQuery(snapshot)) throw new Error('The displayed cabin does not match the prepared source and recheck.');
    backdrop(.62); heading('Trace the source.');
    wrap(prepared.source.title, 48, 315, 1120, 40, 3);
    line(`Source row ${prepared.source.id}`, 48, 475, 30, '#c9ad7a');
    line('A source is not a matching lunar test.', 48, 605, 34, '#ede4d4');
  } else if (seconds < 24) {
    if (!samePreparedQuery(snapshot)) throw new Error('The displayed cabin changed during the actual recheck proof.');
    const altered = seconds >= 21;
    phase = altered ? 'refusal' : 'recheck';
    backdrop(.68); heading(altered ? 'Edited record? Refused.' : 'Recheck the saved result.');
    line(altered ? prepared.refused.status : prepared.checked.status, 48, 355, 62, altered ? '#e8b080' : '#ede4d4', 500);
    line(altered ? 'Oxygen edited · saved fingerprint unchanged' : 'Exported JSON · recomputed locally', 48, 420, 32, '#c6c4bd');
    line('Software consistency, not scientific validation.', 48, 605, 30, '#c9ad7a');
  } else {
    phase = 'end';
    backdrop(.48); line('VESTA', 48, 195, 94, '#ede4d4', 500);
    line('Explore the evidence.', 48, 263, 46, '#ede4d4');
    line('itzjk.github.io/vesta', 48, 335, 38, '#c9ad7a');
    line('Team Zerack · prototype', 48, 570, 30, '#c6c4bd');
    line('Evidence coverage is not safety.', 48, 618, 32, '#ede4d4');
  }
  footer('VESTA collection · editorial presentation');
  return phase;
}
function drawTail(phase) {
  backdrop(['source', 'recheck', 'refusal'].includes(phase) ? .62 : phase === 'end' ? .25 : 0);
  if (phase === 'source') {
    heading('Trace the source.', 'Nearest source row for the selected PMMA question.');
    line('SOURCE TABLE', 48, 280, 23, '#c9ad7a', 500);
    const y = wrap(prepared.source.title, 48, 330, 1060, 36, 2);
    line(prepared.source.id, 48, y + 14, 27, '#c6c4bd');
    wrap(prepared.source.url || 'Original source URL is not recorded for this row.', 48, y + 58, 1100, 24, 2, '#c6c4bd');
    line('Source identity is not proof of matching lunar conditions.', 48, 605, 25, '#c9ad7a');
  } else if (phase === 'recheck') {
    heading('Recheck the record.', 'The exported JSON is loaded and recomputed locally.');
    line('Same result fingerprint.', 48, 330, 48);
    line(`Local result: ${prepared.checked.status}`, 48, 389, 30, '#c9ad7a');
    line(`SHA-256 ${prepared.bundle.integrity.digest.slice(0, 20)}…`, 48, 438, 26, '#c6c4bd');
    line('Software consistency · not scientific validation.', 48, 605, 27, '#c6c4bd');
  } else if (phase === 'refusal') {
    heading('Edited JSON is refused.', 'Oxygen changed; the saved fingerprint did not.');
    line('Fingerprint mismatch.', 48, 330, 48, '#e8b080');
    line(`Local result: ${prepared.refused.status}`, 48, 389, 30, '#c6c4bd');
    line('No reproduced match is claimed.', 48, 605, 28, '#c6c4bd');
  } else if (phase === 'robotics') {
    heading('Humanoid inspection.', 'Scripted concept · human approval required');
    line('No connected robot or live camera.', 48, 605, 28, '#c6c4bd');
  } else {
    line('VESTA', 48, 160, 84, '#ede4d4', 500);
    line('Explore the evidence.', 48, 218, 38, '#c6c4bd');
    line('itzjk.github.io/vesta', 48, 280, 30, '#c9ad7a');
    line('Team Zerack', 48, 605, 26, '#c6c4bd');
  }
  footer(phase === 'robotics' ? 'Digital concept · no hardware connected' : 'Prototype · evidence coverage, not safety');
}
function phaseAt(seconds) {
  let edge = 0;
  for (const [phase, duration] of Object.entries(TAIL)) { edge += duration; if (seconds < edge) return phase; }
  return 'complete';
}
function copyScene(source) {
  const scale = Math.min(WIDTH / source.width, HEIGHT / source.height);
  const width = source.width * scale, height = source.height * scale;
  sceneContext.fillStyle = '#0c1012'; sceneContext.fillRect(0, 0, WIDTH, HEIGHT);
  sceneContext.drawImage(source, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
}
function onFrame(event) {
  if (!run || drawing) return;
  const now = performance.now(); lastFrame = now;
  if (now - run.drawAt < 1000 / FPS - 1) return;
  drawing = true;
  try {
    run.drawAt = now; copyScene(event.canvas);
    const snapshot = run.app.world.questionPresentation;
    if (run.storyStartedAt == null) {
      // Preparing the tour can synchronously render before its snapshot exists.
      // Capture starts only on a fresh, actual opening-question frame.
      if (snapshot?.state !== 'running' || snapshot.phase !== 'question') throw new Error('The opening question frame was missed. Retry the story in Light 3D.');
      run.storyStartedAt = now;
      if (!run.withRecording) status.textContent = 'Preview running. Record restarts the story from the beginning.';
    }
    if (run.mode === 'submission') {
      const seconds = (now - run.storyStartedAt) / 1000;
      if (snapshot && ['stopped', 'error', 'unavailable'].includes(snapshot.state)) throw new Error('The live walkthrough stopped before completion.');
      run.shown.add(drawSubmission(seconds, snapshot)); savedFrames++; frame.disabled = false;
      if (run.withRecording && !recorder) recorderStart(run.mode);
      if (seconds >= SUBMISSION_SECONDS) {
        const full = ['question', 'contrast', 'source', 'recheck', 'refusal', 'end'].every(phase => run.shown.has(phase));
        finish(full ? '28-second story complete. Verify encoded duration and playback before submission.' : 'Capture skipped a story beat. This file is partial; retry in Light 3D.', full);
      }
      return;
    }
    if (snapshot?.state === 'done' && run.tailAt == null) {
      if (!samePreparedQuery(snapshot)) throw new Error('The walkthrough query changed. This prepared recheck cannot be presented as its result.');
      run.tailAt = now;
    }
    if (run.tailAt == null) {
      if (snapshot?.state === 'running') drawTour(snapshot);
      else if (snapshot && ['stopped', 'error', 'unavailable'].includes(snapshot.state)) throw new Error('The live walkthrough stopped before completion.');
    } else {
      const phase = phaseAt((now - run.tailAt) / 1000);
      if (phase === 'complete') { drawTail('end'); savedFrames++; finish('Complete. Review the video before sharing it.', true); return; }
      if (phase === 'robotics' && !run.robotics) { run.robotics = true; run.app.world.navigate('robotics', { cut: false }); }
      drawTail(phase);
    }
    savedFrames++; frame.disabled = false;
    if (run.withRecording && !recorder) recorderStart(run.mode);
  } catch (error) { finish(`Stopped: ${error.message} A partial recording may be available.`, false); }
  finally { drawing = false; }
}
async function waitFor(predicate, token, timeout = 45000) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    if (generation !== token) throw new Error('Cancelled.');
    const value = predicate(); if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('The 3D scene did not become ready. Open VESTA directly to check WebGL support, then retry.');
}
async function prepare(token, selectedQuality) {
  const url = new URL(`index.html#/design?preset=station&view=simple&quality=${selectedQuality}`, location.href);
  url.searchParams.set('presentation', String(token));
  iframe.src = url.href;
  const app = await waitFor(() => {
    if (iframe.contentWindow?.location.search !== url.search) return null;
    const candidate = iframe.contentWindow?.vesta;
    const host = iframe.contentDocument?.querySelector('.world-host');
    return candidate?.world?.stage?.on && typeof candidate.world.startQuestion === 'function' && host?.dataset.worldAllBuilt === 'true' ? candidate : null;
  }, token);
  if (app.world.stage.mode === 'still') throw new Error('Live WebGL is unavailable; a still image cannot be recorded as this animated review.');
  await document.fonts.ready;
  const model = buildQuestionModel(app.db), bundle = await createReproduction(app.db, model.after);
  const checked = await recheckReproduction(JSON.stringify(bundle), app.db);
  const changed = JSON.parse(JSON.stringify(bundle)); changed.receipt.query.oxygen_percent += 1;
  const refused = await recheckReproduction(JSON.stringify(changed), app.db);
  if (checked.status !== 'MATCH' || refused.status !== 'HASH_MISMATCH') throw new Error('The actual local reproduction/refusal checks did not produce the expected outcomes. No proof sequence will be invented.');
  const row = app.db.testById[model.nearestId], investigation = row && app.db.invById[row.psi_id];
  if (!row) throw new Error('The actual source row is unavailable.');
  prepared = { model, bundle, checked, refused, source: { id: row.id, title: investigation?.name || row.investigation || row.psi_id, url: row.psi_url || investigation?.psi_url || null } };
  return app;
}
function recorderStart(mode) {
  videoMode = mode; recordedStop = 0;
  chunks = []; download.disabled = true; stream = canvas.captureStream(FPS);
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: BITRATE });
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.onerror = event => finish(`Recording stopped: ${event.error?.message || 'encoder error'}`, false);
  recorder.onstop = () => {
    clearTimeout(recordingDeadline); recordingDeadline = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    if (videoURL) URL.revokeObjectURL(videoURL);
    videoBlob = new Blob(chunks, { type: recorder.mimeType || mime }); chunks = [];
    const elapsed = (recordedStop - recordedStart) / 1000;
    videoComplete = completed && (videoMode !== 'submission' || elapsed < 30);
    videoURL = videoBlob.size ? URL.createObjectURL(videoBlob) : null;
    download.disabled = !videoURL;
    summary.textContent = videoURL ? `${videoComplete ? 'Complete story' : 'Partial recording'} · ${videoMode} · ${(videoBlob.size / 1_000_000).toFixed(1)} MB · ${elapsed.toFixed(1)}s capture elapsed · requested ${FPS} fps · ${savedFrames} composed frames. Verify the encoded file is no longer than 30s before using it as the submission demo.` : 'No video data was produced.';
    recorder = null; preview.disabled = false; record.disabled = !canRecord; format.disabled = quality.disabled = false;
  };
  recordedStart = performance.now(); recorder.start(1000);
  status.textContent = 'Recording the actual scene. Keep this page visible.';
  // Independent wall-clock budget also stops a stalled scene; this is not an encoded-duration claim.
  if (mode === 'submission') recordingDeadline = setTimeout(() => finish('Recording stopped at the 29-second budget. Review this partial file before use.', false), RECORDING_LIMIT_MS);
}
async function begin(withRecording) {
  if (recorder) return;
  finish('', false); const token = ++generation;
  const mode = format.value, selectedQuality = quality.value === 'high' ? 'high' : 'low';
  preview.disabled = record.disabled = true; stop.disabled = false;
  format.disabled = quality.disabled = true;
  status.textContent = 'Preparing the live scene and checking the real JSON round trip…';
  savedFrames = 0; completed = false;
  try {
    const app = await prepare(token, selectedQuality);
    if (generation !== token) return;
    run = { app, mode, withRecording, shown: new Set(), storyStartedAt: null, drawAt: -Infinity, tailAt: null, robotics: false };
    if (!app.world.startQuestion()) throw new Error('The live walkthrough could not start.');
    // startQuestion may invalidate/render synchronously while initializing.
    // Subscribe afterward, and never overwrite a cancellation/error state.
    if (generation !== token || !run) return;
    unsubscribe = app.world.stage.on('frame', onFrame); lastFrame = performance.now();
    stop.focus({ preventScroll: true });
    status.textContent = 'Waiting for the first live question frame…';
    record.disabled = withRecording || !canRecord;
  } catch (error) { if (generation === token) finish(error.message, false); }
}
function finish(message, full) {
  generation++; completed = full;
  clearTimeout(recordingDeadline); recordingDeadline = null;
  const prior = run; run = null;
  unsubscribe?.(); unsubscribe = null;
  prior?.app.world?.stopQuestion?.();
  iframe.src = 'about:blank';
  if (recorder?.state === 'recording') { recordedStop = performance.now(); recorder.stop(); }
  else { stream?.getTracks().forEach(track => track.stop()); stream = null; preview.disabled = false; record.disabled = !canRecord; format.disabled = quality.disabled = false; }
  stop.disabled = true;
  if (message) status.textContent = message;
}
function save(url, name) { const link = document.createElement('a'); link.href = url; link.download = name; link.click(); }
preview.addEventListener('click', () => begin(false));
record.addEventListener('click', () => begin(true));
stop.addEventListener('click', () => finish('Stopped. Any recorded portion is available as a partial review file.', false));
download.addEventListener('click', () => { if (videoURL) save(videoURL, `vesta-presentation-${videoMode}-${videoComplete ? 'complete' : 'partial'}.webm`); });
frame.addEventListener('click', () => canvas.toBlob(blob => {
  if (!blob) { status.textContent = 'PNG export failed.'; return; }
  const url = URL.createObjectURL(blob); save(url, 'vesta-presentation-frame.png'); setTimeout(() => URL.revokeObjectURL(url), 1000);
}, 'image/png'));
const watchdog = setInterval(() => { if (run && performance.now() - lastFrame > 5000) finish('Stopped: no fresh scene frame for five seconds. Any video is partial.', false); }, 1000);
document.addEventListener('visibilitychange', () => { if (document.hidden && (run || !stop.disabled)) finish('Stopped because this page became hidden. Keep it visible for a continuous recording.', false); });
addEventListener('pagehide', () => { finish('', false); clearInterval(watchdog); observer.disconnect(); if (videoURL) URL.revokeObjectURL(videoURL); });
