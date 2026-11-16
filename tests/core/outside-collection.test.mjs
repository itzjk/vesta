import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { outsideCollection, featured, TERMS, GROUPS } from '../../web/js/core/outside-collection.js';

const json = name => JSON.parse(fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8'));
const index = json('research/ntrs-index.json'), sources = json('web/data/sources.json'), findings = json('web/data/findings.json'), feed = json('web/feed/ntrs.json');
const out = outsideCollection({ index, sources, findings });
const counted = [...out.admitted, ...out.listed];
const indexById = new Map(index.map(r => [String(r.id), r])), sourceById = new Map();
for (const s of sources.sources) {
  const id = String(s.id), m = sourceById.get(id) ?? { ...s, finding_ids: [] };
  m.finding_ids = [...new Set([...m.finding_ids, ...s.finding_ids])];
  sourceById.set(id, m);
}
assert.ok(sourceById.size < sources.sources.length, 'some documents are stored under two keys and are merged by id');
const titleNames = (title, groups) => TERMS.some(t => groups.includes(t.group) && t.re.test(title));

test('every listed record carries its title, year, id and URL exactly as a repository file stores them', () => {
  assert.ok(counted.length > 0);
  for (const r of [...counted, ...out.not_counted]) {
    const stored = indexById.get(r.id) ?? sourceById.get(r.id);
    assert.ok(stored, `${r.id} comes from the NTRS index or the sources`);
    assert.deepEqual([r.title, r.url, r.year], [stored.title, stored.url, stored.year ?? null]);
    assert.equal(r.in_ntrs_snapshot, indexById.has(r.id));
    assert.ok(r.why.length > 0, `${r.id} says why it matched`);
  }
  assert.equal(new Set(counted.map(r => r.id)).size, counted.length, 'no record twice');
});

test('a record counts only when its own title names the Moon, Mars, partial gravity or normal gravity', () => {
  for (const r of counted) assert.ok(titleNames(r.title, ['partial', 'normal']), r.title);
  for (const r of out.not_counted) assert.ok(!titleNames(r.title, ['partial', 'normal']), r.title);
  const expected = index.filter(r => titleNames(r.title, ['partial', 'normal'])).length;
  assert.equal(out.counts.snapshot.total, expected, 'recounted straight from the index titles');
  assert.equal(out.counts.total, counted.length);
  assert.equal(out.counts.not_counted, out.not_counted.length);
  assert.deepEqual(Object.keys(GROUPS), ['partial', 'normal', 'related', 'reduced']);
  assert.ok(out.not_counted.some(r => r.why.every(w => w.group === 'reduced')), 'low-gravity and drop-tower wording is kept apart, since it often means microgravity');
});

test('admitted means the record is already a source of findings; listed means VESTA has not read it', () => {
  for (const r of out.admitted) {
    const src = sourceById.get(r.id);
    assert.ok(src && src.finding_ids.length === r.findings && r.findings > 0, r.id);
  }
  for (const r of out.listed) {
    assert.ok(!sourceById.has(r.id) && r.in_ntrs_snapshot && r.findings === 0, r.id);
    assert.ok(r.why.every(w => w.kind === 'title'), 'an unread record can only match by its title');
  }
  const s = out.counts.snapshot;
  assert.equal(s.admitted + s.listed, s.total);
  assert.equal(s.listed, out.listed.length);
  assert.equal(s.admitted, out.admitted.filter(r => indexById.has(r.id)).length);
});

test('finding-gravity reasons are recounted from the findings and never make a record count', () => {
  const byId = new Map(findings.findings.map(f => [f.id, f]));
  let seen = 0;
  for (const r of [...counted, ...out.not_counted]) for (const w of r.why.filter(x => x.kind === 'finding-gravity')) {
    const term = TERMS.find(t => t.label === w.term);
    assert.equal(w.findings, sourceById.get(r.id).finding_ids.filter(id => term.re.test(String(byId.get(id)?.conditions?.gravity ?? ''))).length);
    seen++;
  }
  assert.ok(seen > 0);
  assert.ok(out.not_counted.some(r => r.admitted && r.why.every(w => w.kind === 'finding-gravity')));
});

test('the landing examples are short NTRS citations, one read and one unread, with no claim word', () => {
  const pick = featured(out), both = [...pick.admitted, ...pick.listed];
  assert.equal(both.length, 2);
  assert.ok(pick.admitted[0].admitted && !pick.listed[0].admitted);
  for (const r of both) {
    assert.equal(r.url, `https://ntrs.nasa.gov/citations/${r.id}`);
    assert.equal(indexById.get(r.id).title, r.title);
    assert.ok(r.title.split(/\s+/).length <= 7);
    assert.doesNotMatch(r.title, /[<>&]|\bsafe|proven|validat|certif/i);
  }
  const wide = featured(out, { admitted: 3, listed: 3, maxWords: 99 }), titles = [...wide.admitted, ...wide.listed].map(r => r.title);
  assert.equal(new Set(titles).size, titles.length, 'no title twice');
  assert.deepEqual(featured(outsideCollection()), { admitted: [], listed: [] });
});

test('it also accepts the shipped feed shape and an empty collection', () => {
  const small = outsideCollection({ index: feed, sources, findings });
  const expected = feed.items.filter(r => titleNames(r.title, ['partial', 'normal']));
  assert.equal(small.counts.snapshot.total, expected.length);
  assert.equal(small.counts.snapshot.listed, expected.filter(r => !r.in_evidence_base).length, 'agrees with the feed flag');
  assert.deepEqual(outsideCollection().counts, { total: 0, admitted: 0, listed: 0, snapshot: { total: 0, admitted: 0, listed: 0 }, not_counted: 0 });
  const before = JSON.stringify([index, sources, findings]);
  outsideCollection({ index, sources, findings });
  assert.equal(JSON.stringify([index, sources, findings]), before, 'inputs are not changed');
});
