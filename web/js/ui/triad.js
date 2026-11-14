// Earth instinct / NASA showed / VESTA decides (DESIGN.md 2.4, 3.6, 6.3).
// x is a Rule (rules.json) or a StepResult (core/officer.js). A NO SOURCE step has one red-framed column and the protocol card.
import { el, still } from './el.js';
import { chip, reason, tag, getText } from './chip.js';
import { cite } from './cite.js';

const NO_SOURCE_LINE = 'NO SOURCE. No verified finding in VESTA’s evidence base for this. I will not guess.';

function quoteBlock(f, opts) {
  if (!f) return null;
  if (f.quote) return el('p', { class: 'triad-quote quote' + (f.quote.length > 190 ? ' is-long' : ''), style: opts.clamp ? { '--clamp': String(opts.clamp) } : null, data: { clamp: opts.clamp ? 'true' : null } }, f.quote);
  if (Array.isArray(f.cells) && f.cells.length)                      // a table finding has no quote: it shows its PSI cells
    return el('ul.triad-cells', f.cells.slice(0, 4).map(c => el('li', el('span.t-dim', `${c.column}: `), el('span.t-white', String(c.raw)))));
  return null;
}

function colEarth(earth, db, opts) {
  if (!earth || !earth.text) return null;
  const sourced = earth.finding_id && db && db.findingById && db.findingById[earth.finding_id];
  const text = el('span.triad-strike', earth.text);
  const col = el('article.triad-col.triad-earth', { data: { claim: sourced ? earth.finding_id : null, col: 'earth' } },
    el('header.triad-head', el('h3.triad-title', sourced ? 'EARTH PRACTICE' : 'EARTH INSTINCT'), el('span.triad-sub', sourced ? 'documented practice on Earth' : 'common assumption')),
    el('p.triad-text', text),
    sourced ? el('footer.triad-foot', cite(earth.finding_id)) : null);
  const strike = () => col.classList.add('is-struck');
  const ms = opts.strikeAfter;
  if (ms === 0 || (ms != null && still())) strike(); else if (ms != null) setTimeout(strike, ms);
  if (opts.struck) strike();
  return col;
}

function colNasa(ids, rowIds, db, opts) {
  const F = (ids || []).map(id => db && db.findingById ? db.findingById[id] : null).filter(Boolean);
  const best = F[0];
  if (!best && !(rowIds && rowIds.length)) return null;
  return el('article.triad-col.triad-nasa', { data: { claim: best ? best.id : rowIds[0], col: 'nasa' } },
    el('header.triad-head', el('h3.triad-title', 'NASA SHOWED'), el('span.triad-sub', best ? (best.quote ? 'verbatim' : 'PSI table cells') : 'PSI test rows')),
    best ? quoteBlock(best, opts) : el('p.triad-text', `${rowIds.length} test row${rowIds.length === 1 ? '' : 's'} of the PSI table at this question.`),
    el('footer.triad-foot', F.slice(0, 3).map(f => cite(f.id)), (rowIds || []).slice(0, best ? 1 : 3).map(id => cite(id))));
}

function colVesta(action, limits, opts) {
  return el('article.triad-col.triad-vesta', { data: { col: 'vesta' } },
    el('header.triad-head', el('h3.triad-title', 'VESTA DECIDES'), chip('INTERPRETATION', { small: true })),
    el('p.triad-decision', action || ''),
    opts.limits && limits ? el('p.triad-limits', el('span.t-label', 'limits '), limits) : null,
    opts.actions ? el('footer.triad-foot', opts.actions) : null);
}

function noSource(step, db, opts) {
  const p = step.protocol, f = p && db && db.findingById ? db.findingById[p.finding_id] : null;
  const card = p && f
    ? el('div.protocol-card', { data: { claim: f.id, protocol: p.id } },
        el('header.protocol-head', el('span.t-label', 'ISS procedure · conservative default'), el('span.triad-code', tag(p.id, { tone: 'dim' }))),
        el('p.protocol-action', p.action),
        el('p.protocol-quote.quote', f.quote),
        el('footer.triad-foot', cite(f.id)),
        el('p.protocol-limit', p.limit || ''))
    : el('div.protocol-card.protocol-none', el('p.protocol-action', step.action || 'Hand the decision to the crew. No verified protocol line for this step.'));
  return el('article.triad-col.triad-nosource', { data: { col: 'nosource' } },
    el('header.triad-head', chip('NO_SOURCE'), step.gap ? reason(step.gap) : null),
    el('p.triad-decision', opts.noSourceLine || (getText() && getText().NO_SOURCE_LINE) || NO_SOURCE_LINE),
    card);
}

/**
 * triad(ruleOrStep, db, { strikeAfter: ms, struck, clamp: lines, limits: true, actions: [nodes] }) -> element
 * Rule: { earth_instinct, earth_instinct_finding_id?, vesta_decides, finding_ids, limits }
 * StepResult: { state, earth?, nasa: [{ finding_id }], row_ids?, action, limits?, protocol?, gap? }
 */
export function triad(x, db, opts = {}) {
  if (!x) return el('div.triad.triad-empty');
  const isStep = 'state' in x || 'step' in x;
  if (isStep && x.state === 'NO_SOURCE')
    return el('div.triad.triad-1', { data: { state: 'NO_SOURCE', step: x.step } }, noSource(x, db, opts));
  const earth = isStep ? x.earth : { text: x.earth_instinct, finding_id: x.earth_instinct_finding_id || null };
  const ids = isStep ? (x.nasa || []).map(n => n.finding_id) : (x.finding_ids || []);
  const cols = [colEarth(earth, db, opts), colNasa(ids, isStep ? x.row_ids : null, db, opts), colVesta(isStep ? x.action : x.vesta_decides, x.limits, opts)].filter(Boolean);
  return el('div', { class: 'triad triad-' + cols.length + (opts.compact ? ' triad-compact' : ''), data: { state: isStep ? x.state : 'RULE', step: isStep ? x.step : null, rule: isStep ? x.rule_id : x.id } }, cols);
}
