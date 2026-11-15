// Scheduling policy only. Frame intervals include CPU/GPU/scheduling effects;
// they do not identify a cause or measure GPU time. No timers, DOM or rendering.
export const FRAME_BUDGET = Object.freeze({
  settleMs: 2000, minSamples: 90, minDurationMs: 2000,
  medianMs: 30, slowFrameMs: 33, slowFraction: .5,
  maxGapMs: 250, evaluateEvery: 15
});

export function evaluateFrameWindow(intervals) {
  if (!Array.isArray(intervals) || !intervals.every(ms => Number.isFinite(ms) && ms > 0 && ms <= FRAME_BUDGET.maxGapMs)) {
    throw new TypeError('Frame intervals must be finite, positive and continuous.');
  }
  const count = intervals.length, durationMs = intervals.reduce((sum, ms) => sum + ms, 0);
  const sorted = [...intervals].sort((a, b) => a - b), middle = Math.floor(count / 2);
  const medianMs = count ? count % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 : null;
  const slowFraction = count ? intervals.filter(ms => ms > FRAME_BUDGET.slowFrameMs).length / count : 0;
  const ready = count >= FRAME_BUDGET.minSamples && durationMs >= FRAME_BUDGET.minDurationMs;
  return { ready, count, durationMs, medianMs, slowFraction,
    shouldLower: ready && medianMs > FRAME_BUDGET.medianMs && slowFraction > FRAME_BUDGET.slowFraction };
}

/**
 * Default-quality, one-shot observer. The caller supplies monotonically increasing
 * frame-start timestamps and explicitly confirms a settled scene. Call sample()
 * for excluded states too, or reset() when holding/loading/hiding the renderer.
 * Call manual() BEFORE every user-selected quality change, including High→High.
 * A returned decision must be applied by the owner; this module changes no mode.
 */
export function createFrameBudget({ explicitQuality = false, capture = false, still = false } = {}) {
  let locked = explicitQuality ? 'explicit-quality' : capture ? 'capture' : still ? 'still' : null;
  let fired = false, previous = null, settlingAt = null, collecting = false, contextKey, contextSet = false;
  let intervals = [], samplesSeen = 0, evaluatedAt = 0, lastAssessment = null;
  function reset() {
    previous = settlingAt = null; collecting = false; intervals = [];
    samplesSeen = evaluatedAt = 0; lastAssessment = null;
    // A reset can never undo an explicit preference or arm a second fallback.
  }
  function manual() { locked = 'manual-quality'; reset(); }
  function sample({ at, mode, settled = false, visible = true, hidden = false,
    loading = false, flying = false, warming = false, capture: capturing = false,
    still: staticScene = false, context = null } = {}) {
    if (locked || fired) return null;
    if (mode !== 'high' || settled !== true || !visible || hidden || loading || flying || warming || capturing || staticScene || !Number.isFinite(at)) {
      reset(); return null;
    }
    if (!contextSet || contextKey !== context) { reset(); contextKey = context; contextSet = true; }
    if (previous == null) { previous = settlingAt = at; return null; }
    const interval = at - previous;
    if (interval <= 0 || interval > FRAME_BUDGET.maxGapMs) { reset(); previous = settlingAt = at; return null; }
    previous = at;
    if (!collecting) {
      if (at - settlingAt >= FRAME_BUDGET.settleMs) collecting = true;
      return null; // The interval crossing the settling boundary is excluded too.
    }
    intervals.push(interval); samplesSeen++;
    if (intervals.length > FRAME_BUDGET.minSamples) intervals.shift();
    if (intervals.length < FRAME_BUDGET.minSamples || evaluatedAt && samplesSeen - evaluatedAt < FRAME_BUDGET.evaluateEvery) return null;
    evaluatedAt = samplesSeen; lastAssessment = evaluateFrameWindow(intervals);
    if (!lastAssessment.shouldLower) return null;
    fired = true;
    return { mode: 'low', reason: 'sustained-frame-budget', stats: { ...lastAssessment } };
  }
  function snapshot() {
    return { locked, fired, collecting, context: contextKey ?? null, sampleCount: intervals.length,
      assessment: lastAssessment ? { ...lastAssessment } : null };
  }
  return { sample, manual, reset, snapshot };
}
