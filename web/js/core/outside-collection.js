// NASA documents on partial or normal gravity that sit outside the PSI source tables.
// Pure: the caller passes the NTRS index (research/ntrs-index.json, or the items of web/feed/ntrs.json),
// the sources and the findings. Nothing here reads a file, calls a network or changes a status.
//
// A record is "admitted" when its id is already the source of a finding in VESTA, and "listed" when the
// NTRS snapshot names it but VESTA has not read it into the evidence. A record counts only when its own
// title names the Moon, Mars, partial gravity or normal gravity. Looser wording ("low gravity", "drop tower",
// "extraterrestrial") and sources matched only by the gravity recorded on their findings are returned
// separately and never counted. Matching says a document exists and how it was found, not what it shows.

export const GROUPS = {
  partial: 'Moon, Mars or partial gravity',
  normal: 'normal gravity',
  related: 'related wording, not counted',
  reduced: 'reduced or low gravity, which often means microgravity; not counted',
};
const COUNTED = ['partial', 'normal'];

export const TERMS = [
  { group: 'partial', label: 'partial gravity', re: /partial[- ]gravity|\bpartial-g\b/i },
  { group: 'partial', label: 'lunar', re: /\blunar|\bmoon\b|\bgmoon\b/i },
  { group: 'partial', label: 'Martian', re: /\bmartian\b|\bmars\b/i },
  { group: 'normal', label: 'normal gravity', re: /normal[- ]gravity|normal earth gravity|\bearth gravity\b/i },
  { group: 'normal', label: '1 g', re: /\b1[- ]?g\b/i },
  { group: 'related', label: 'variable gravity', re: /variable gravit/i },
  { group: 'related', label: 'extraterrestrial', re: /extra[- ]?terrestrial/i },
  { group: 'related', label: 'centrifuge', re: /centrifug/i },
  { group: 'reduced', label: 'reduced gravity', re: /reduced[- ]gravity/i },
  { group: 'reduced', label: 'low gravity', re: /low[- ]gravity|\blow-g\b/i },
  { group: 'reduced', label: 'drop tower', re: /drop[- ]tower/i },
];

const termsIn = text => TERMS.filter(t => t.re.test(String(text ?? '')));
const list = x => Array.isArray(x) ? x : (x?.items ?? x?.sources ?? x?.findings ?? []);
const byNewest = (a, b) => (b.year ?? 0) - (a.year ?? 0) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

export function outsideCollection({ index = [], sources = [], findings = [] } = {}) {
  const findingById = new Map(list(findings).map(f => [f.id, f]));
  const records = new Map();
  const open = (id, base) => {
    if (!records.has(id)) records.set(id, { id, title: base.title, year: base.year ?? null, url: base.url, in_ntrs_snapshot: false, why: [], finding_ids: [] });
    return records.get(id);
  };
  const reason = (rec, kind, t, extra = {}) => {
    if (!rec.why.some(w => w.kind === kind && w.term === t.label)) rec.why.push({ kind, term: t.label, group: t.group, ...extra });
  };

  const indexed = new Map();
  for (const row of list(index)) {
    if (row?.id == null || !row.title || !row.url) continue;
    indexed.set(String(row.id), row);
    const terms = termsIn(row.title);
    if (!terms.length) continue;
    const rec = open(String(row.id), row);
    for (const t of terms) reason(rec, 'title', t);
  }

  // sources.json can hold one document under two keys (for example as a PDF and as an NTRS citation):
  // merge by id, keep the first stored title and URL, and count each finding once.
  const merged = new Map();
  for (const src of list(sources)) {
    if (src?.id == null) continue;
    const id = String(src.id), m = merged.get(id) ?? { id, title: src.title, year: src.year, url: src.url, finding_ids: [] };
    for (const fid of src.finding_ids ?? []) if (!m.finding_ids.includes(fid)) m.finding_ids.push(fid);
    merged.set(id, m);
  }
  for (const [id, src] of merged) {
    const titleTerms = termsIn((indexed.get(id) ?? src).title), byGravity = new Map();
    for (const fid of src.finding_ids) for (const t of termsIn(findingById.get(fid)?.conditions?.gravity)) byGravity.set(t, (byGravity.get(t) ?? 0) + 1);
    const known = records.get(id);
    if (!known && (!src.url || !src.title || (!titleTerms.length && !byGravity.size))) continue;
    const rec = known ?? open(id, indexed.get(id) ?? src);
    for (const t of titleTerms) reason(rec, 'title', t);
    for (const [t, n] of byGravity) reason(rec, 'finding-gravity', t, { findings: n });
    rec.finding_ids = src.finding_ids;
  }

  for (const rec of records.values()) rec.in_ntrs_snapshot = indexed.has(rec.id);
  const all = [...records.values()].map(r => {
    const titled = new Set(r.why.filter(w => w.kind === 'title').map(w => w.group));
    return {
      id: r.id, title: r.title, year: r.year, url: r.url,
      in_ntrs_snapshot: r.in_ntrs_snapshot,
      admitted: r.finding_ids.length > 0, findings: r.finding_ids.length,
      groups: Object.keys(GROUPS).filter(g => r.why.some(w => w.group === g)),
      counted: COUNTED.some(g => titled.has(g)),
      why: r.why,
    };
  }).sort(byNewest);

  const counted = all.filter(r => r.counted);
  const admitted = counted.filter(r => r.admitted), listed = counted.filter(r => !r.admitted);
  const snap = rows => rows.filter(r => r.in_ntrs_snapshot).length;
  return {
    groups: GROUPS,
    admitted, listed,
    not_counted: all.filter(r => !r.counted),
    counts: {
      total: counted.length, admitted: admitted.length, listed: listed.length,
      snapshot: { total: snap(counted), admitted: snap(admitted), listed: snap(listed) },
      not_counted: all.length - counted.length,
    },
    note: 'Counted by title wording only. Listing a record says it exists in the snapshot, not what it shows.',
  };
}

// Records short enough to name on the landing: in the NTRS snapshot, a plain-text title of at most maxWords
// words that names partial gravity, the Moon or Mars and a fire word, no claim word, no title twice, newest first.
export function featured(result, { admitted = 1, listed = 1, maxWords = 7 } = {}) {
  const seen = new Set();
  const ok = r => r.in_ntrs_snapshot
    && r.why.some(w => w.kind === 'title' && w.group === 'partial')
    && /flammab|flame|fire|combust|ignit/i.test(r.title)
    && !/[<>&]|\bsafe|proven|validat|certif/i.test(r.title)
    && r.title.trim().split(/\s+/).length <= maxWords;
  const take = (rows, n) => rows.filter(r => ok(r) && !seen.has(r.title) && seen.add(r.title)).slice(0, n);
  return { admitted: take(result.admitted, admitted), listed: take(result.listed, listed) };
}
