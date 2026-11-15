import { createReceipt, parseReceipt, recheckReceipt, RECEIPT_SCHEMA, MAX_RECEIPT_BYTES } from './receipt.js';

export const REPRODUCTION_SCHEMA = 'vesta.reproduction/1';
export const MAX_REPRODUCTION_BYTES = MAX_RECEIPT_BYTES;
export const CANONICALIZATION = 'vesta.sorted-json/1';
export const DIGEST_SCOPE = 'receipt';
export const DIGEST_DESCRIPTION = 'SHA-256 of the complete embedded receipt: query, method, collection basis, result and evidence. Object keys are sorted recursively in JavaScript string order; arrays keep their order; keys and primitive values use JSON.stringify encoding, with no extra whitespace, encoded as UTF-8. Collection build labels and export times are outside this digest.';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : object(value) ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  : JSON.stringify(value);
const same = (a, b) => canonical(a) === canonical(b);
const exactKeys = (value, keys) => object(value) && same(Object.keys(value).sort(), [...keys].sort());
const textOrNull = value => value === null || typeof value === 'string' && value.length > 0 && value.length <= 200;
const buildOf = db => ({ generated_at: db.meta?.generated_at ?? null, display: db.meta?.built_display ?? null });

function checkBuild(build) {
  if (!exactKeys(build, ['generated_at', 'display']) || !textOrNull(build.generated_at) || !textOrNull(build.display)) {
    throw new Error('Invalid collection build metadata.');
  }
}

// The input is first parsed as JSON by the unchanged receipt reader. This avoids
// hashing undefined values, prototypes or object-only values differently from files.
export async function resultDigest(receipt) {
  if (!globalThis.crypto?.subtle) throw new Error('Reproduction requires HTTPS or localhost.');
  const content = canonical(parseReceipt(receipt));
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function envelope(receipt, db) {
  const collection_build = buildOf(db);
  checkBuild(collection_build);
  const value = { schema: REPRODUCTION_SCHEMA, collection_build, receipt,
    integrity: { algorithm: 'SHA-256', canonicalization: CANONICALIZATION, scope: DIGEST_SCOPE, digest: await resultDigest(receipt) } };
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_REPRODUCTION_BYTES) throw new Error('The reproduction file exceeds 2 MB.');
  return value;
}

export async function createReproduction(db, query) {
  return envelope(await createReceipt(db, query), db);
}

function read(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_REPRODUCTION_BYTES) {
    throw new Error('Choose a reproduction file smaller than 2 MB.');
  }
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (value?.schema === RECEIPT_SCHEMA) return { receipt: parseReceipt(value), legacy: true };
  if (!exactKeys(value, ['schema', 'collection_build', 'receipt', 'integrity']) || value.schema !== REPRODUCTION_SCHEMA) {
    throw new Error(`Expected ${REPRODUCTION_SCHEMA} or ${RECEIPT_SCHEMA}.`);
  }
  checkBuild(value.collection_build);
  const i = value.integrity;
  if (!exactKeys(i, ['algorithm', 'canonicalization', 'scope', 'digest']) || i.algorithm !== 'SHA-256'
      || i.canonicalization !== CANONICALIZATION || i.scope !== DIGEST_SCOPE || typeof i.digest !== 'string' || !/^[a-f0-9]{64}$/.test(i.digest)) {
    throw new Error('Invalid result fingerprint or unsupported canonicalization.');
  }
  return { ...value, receipt: parseReceipt(value.receipt), legacy: false };
}

export async function recheckReproduction(input, db) {
  let saved;
  try { saved = read(input); }
  catch (error) { return { status: 'INVALID', matches: false, calculation_matches: false, message: error.message }; }
  const saved_digest = await resultDigest(saved.receipt);
  if (!saved.legacy && saved.integrity.digest !== saved_digest) {
    return { status: 'HASH_MISMATCH', matches: false, calculation_matches: false, legacy: false,
      saved_digest: saved.integrity.digest, file_digest: saved_digest,
      message: 'The saved result fingerprint does not match the file contents. No match is claimed.' };
  }
  const checked = await recheckReceipt(saved.receipt, db);
  if (!checked.current) return checked;
  const current = await envelope(checked.current, db);
  const build_matches = saved.legacy ? null : same(saved.collection_build, current.collection_build);
  const changed = [...checked.changed, ...(!saved.legacy && !build_matches ? ['collection_build'] : [])];
  const status = !checked.matches ? checked.status : build_matches === false ? 'BUILD_CHANGED' : 'MATCH';
  return { status, matches: status === 'MATCH', calculation_matches: checked.matches, legacy: saved.legacy,
    build_matches, changed, current, saved_digest, current_digest: current.integrity.digest,
    saved_build: saved.collection_build ?? null,
    message: !checked.matches ? checked.message
      : build_matches === false ? 'The calculation and result fingerprint match; the collection build metadata differs. Review the saved and current build metadata.'
      : saved.legacy ? 'Legacy receipt reproduced. Its result fingerprint was calculated here; the old file has no saved build label or result digest.'
      : 'Same inputs, method, collection and result fingerprint. Reproduced locally; this checks software consistency, not scientific validity.' };
}
