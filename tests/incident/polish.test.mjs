import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { norm, Texts, sentenceContext } from '../../tools/lib/gate.mjs';

const protocol = JSON.parse(readFileSync(new URL('../../config/protocol.json', import.meta.url)));
const byId = Object.fromEntries(protocol.lines.map(p => [p.id, p]));
const source = new URL('../../research/raw/nasa/ntrs-iss-emergency-response-evolution.txt', import.meta.url);
const cached = existsSync(source);
const raw = cached ? readFileSync(source, 'utf8') : '';
const needsSource = { skip: cached ? false : 'Cached NASA text is excluded from the Lenovo browser mirror; run this check on the Mac' };
const texts = new Texts(new URL('../../', import.meta.url).pathname);

test('the isolation fallback retains the crew condition and vehicle capability', needsSource, () => {
  const p = byId['PROT-09'];
  assert.ok(norm(raw).includes(norm(p.source.quote)));
  assert.match(p.source.quote, /if at any point crew does not feel comfortable proceeding/);
  assert.match(p.action, /may choose/);
  assert.match(p.limit, /requires an isolatable module/);
  assert.match(p.limit, /gap alone is not an instruction/);
  const c = sentenceContext(texts, p.source.text_file, p.source.quote);
  assert.equal(c.found, true);
  assert.equal(c.after, '');
});

test('investigation procedure preserves masks before analyzer and unpowering', needsSource, () => {
  const p = byId['PROT-05'];
  assert.ok(norm(raw).includes(norm(p.source.quote)));
  assert.ok(p.source.quote.indexOf('don breathing masks') < p.source.quote.indexOf('combustion product analyzer'));
  assert.ok(p.source.quote.indexOf('combustion product analyzer') < p.source.quote.indexOf('unpower'));
  assert.match(p.limit, /not validated for this vehicle/);
  assert.equal(sentenceContext(texts, p.source.text_file, p.source.quote).found, true);
});
