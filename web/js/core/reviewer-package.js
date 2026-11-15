import { createReproduction, recheckReproduction, MAX_REPRODUCTION_BYTES } from './reproduction.js?v=sebas-20261115-2';
import { collectionSummary } from './evidence-register.js?v=sebas-20261115-2';

export const REVIEWER_SCHEMA = 'vesta.reviewer-package/1';
export const REVIEWER_DIGEST_SCOPE = 'reproduction-and-review-context';
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}` : JSON.stringify(value);
const same = (a, b) => canonical(a) === canonical(b);
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exactKeys = (x, keys) => isObject(x) && same(Object.keys(x).sort(), [...keys].sort());
function parse(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_REPRODUCTION_BYTES) throw new Error('Choose a review package smaller than 2 MB.');
  try { return JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
}
function rejectedContext(db, document) {
  const expected = db.engine?.verifier?.rejected;
  if (!Array.isArray(expected) || document?.schema !== 'vesta.rejected-excerpts/1' || !Array.isArray(document.records)
      || !/^[a-f0-9]{40}$/.test(document.source_commit || '') || document.records.length !== expected.length) {
    throw new Error('Rejected-source details do not match the loaded review record.');
  }
  const ids = new Set();
  for (const r of document.records) {
    const e = expected.find(x => x.id === r.id), after = db.engine.verifier.cut_before_qualifier?.find(x => x.id === r.id)?.after;
    if (ids.has(r.id) || !e || r.quote !== e.quote || r.why !== e.why || r.context_after !== after
      || !r.source?.title || !r.source?.id || typeof r.source.text_file !== 'string' || !/^https:\/\//.test(r.source.url || '')) {
      throw new Error('Rejected-source details do not match the loaded review record.');
    }
    ids.add(r.id);
  }
  // Snapshot only JSON data. Rejected excerpts stay separate from accepted findings.
  return JSON.parse(JSON.stringify(document));
}
function reviewContext(db, rejected) {
  return { collection: collectionSummary(db), rejected_excerpts: rejectedContext(db, rejected),
    verification_scope: 'The package digest covers the full reproduction envelope and this review context. Recheck also compares collection/limits and rejected excerpts with the loaded collection and published rejected-source file. It checks consistency, not authorship, scientific validity or safety.' };
}
export async function reviewerDigest(payload) {
  if (!globalThis.crypto?.subtle) throw new Error('Review packages require HTTPS or localhost.');
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(parse(payload))));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export async function createReviewerPackage(db, query, rejected) {
  const payload = { schema: REVIEWER_SCHEMA, reproduction: await createReproduction(db, query), review_context: reviewContext(db, rejected) };
  const value = { ...payload, integrity: { algorithm: 'SHA-256', canonicalization: 'vesta.sorted-json/1', scope: REVIEWER_DIGEST_SCOPE, digest: await reviewerDigest(payload) } };
  parse(value); return value;
}
export async function recheckReviewerPackage(input, db, rejected) {
  let value, expected;
  try {
    value = parse(input);
    if (!exactKeys(value, ['schema', 'reproduction', 'review_context', 'integrity']) || value.schema !== REVIEWER_SCHEMA
        || !exactKeys(value.integrity, ['algorithm', 'canonicalization', 'scope', 'digest']) || value.integrity.algorithm !== 'SHA-256'
        || value.integrity.canonicalization !== 'vesta.sorted-json/1' || value.integrity.scope !== REVIEWER_DIGEST_SCOPE
        || !/^[a-f0-9]{64}$/.test(value.integrity.digest || '')) throw new Error('Invalid review package or unsupported fingerprint.');
    const payload = { schema: value.schema, reproduction: value.reproduction, review_context: value.review_context };
    if (await reviewerDigest(payload) !== value.integrity.digest) return { status: 'HASH_MISMATCH', matches: false, calculation_matches: false, message: 'The review-package fingerprint does not match its contents. No match is claimed.' };
    expected = reviewContext(db, rejected);
  } catch (error) { return { status: 'INVALID', matches: false, calculation_matches: false, message: error.message }; }
  const result = await recheckReproduction(value.reproduction, db);
  const context_matches = same(value.review_context, expected);
  if (!result.matches) return { ...result, context_matches, reviewer_package: true, review_digest: value.integrity.digest };
  if (!context_matches) return { ...result, status: 'REVIEW_CONTEXT_CHANGED', matches: false, context_matches: false, reviewer_package: true,
    review_digest: value.integrity.digest, message: 'The receipt reproduces, but the collection summary, limits or rejected-source details differ from the loaded review context. The complete package is not verified.' };
  return { ...result, context_matches: true, reviewer_package: true, review_digest: value.integrity.digest,
    message: 'Receipt reproduced; collection summary, limits and all rejected excerpts match the loaded review context. Both fingerprints match. This checks consistency, not scientific validity or safety.' };
}
