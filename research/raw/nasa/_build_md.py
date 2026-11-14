#!/usr/bin/env python3
"""Build ../../nasa-pages.md from the cached texts and _facts.py. Every quote is checked verbatim first
(same normalisation as tools/quotecheck.py); a quote that is not in its cached text is dropped and reported."""
import json, pathlib, re, sys, unicodedata, time
D = pathlib.Path(__file__).resolve().parent; R = D.parent.parent
FOLD = {'‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '−': '-', '‐': '-', '‑': '-', '­': ''}
def norm(s):
    s = unicodedata.normalize('NFKC', s or '')
    for k, v in FOLD.items(): s = s.replace(k, v)
    return re.sub(r'\s+', ' ', s).strip()
ns = {}; exec((D / '_facts.py').read_text(), ns); F = ns['F']
GOOD = json.loads((D / '_goodfor.json').read_text())
texts, meta = {}, {}
TITLES = {'researchers-guide-combustion': "A Researcher's Guide to: Combustion Science (NP-2015-10-034-JSC, PDF)"}
for t in sorted(D.glob('*.txt')):
    raw = t.read_text(errors='replace'); head, _, body = raw.partition('\n\n')
    h = head.split('\n'); title = next((x[7:] for x in h if x.startswith('TITLE: ')), '')
    if not title:
        title = next((l.strip() for l in body.split('\n') if l.strip()), '')[:90]
    texts[t.stem] = norm(raw); meta[t.stem] = dict(url=h[0], title=TITLES.get(t.stem, title).replace(' - NASA Science', '').replace(' - NASA', '').replace('|', '/'), chars=len(body))
bad = []
for f in F:
    f['ok'] = len(norm(f['quote'])) >= 25 and f['slug'] in texts and norm(f['quote']) in texts[f['slug']]
    if not f['ok']: bad.append(f)
good = [f for f in F if f['ok']]
(D / '_facts.verified.json').write_text(json.dumps({'findings': [
    {'id': f'NP{i+1:03d}', 'investigation': f['inv'], 'field': f['field'], 'fact': f['fact'], 'quote': f['quote'],
     'source': {'kind': 'ntrs' if f['slug'].startswith('ntrs-') else ('pdf' if (D / (f['slug'] + '.pdf')).exists() else 'nasa-page'),
                'id': f['slug'], 'url': meta[f['slug']]['url'], 'text_file': f'raw/nasa/{f["slug"]}.txt'}} for i, f in enumerate(good)]}, indent=1))
missing = [s for s in meta if s not in GOOD]
o = []
o.append('# NASA reference pages cached for VESTA\n')
o.append(f'Built {time.strftime("%Y-%m-%d %H:%M")} by `raw/nasa/_build_md.py`. Text files are in `raw/nasa/<slug>.txt` (line 1 is the URL). '
         f'{len(meta)} pages cached, {len(good)} facts, each with the exact sentence it comes from. '
         'Every quote below was checked verbatim against its cached text (Unicode NFKC, curly quotes and dashes folded, whitespace collapsed: the same rule as `tools/quotecheck.py`). '
         'The same facts are in `raw/nasa/_facts.verified.json` in the quotecheck format.\n')
o.append(ns_notes := (D / '_notes.md').read_text())
o.append('\n## Table of cached pages\n\n| slug | URL | title | good for | chars |\n|---|---|---|---|---|')
order = json.loads((D / '_order.json').read_text())
seen = []
for grp, slugs in order:
    o.append(f'| **{grp}** | | | | |')
    for s in slugs:
        if s in meta:
            m = meta[s]; seen.append(s); o.append(f"| {s} | {m['url']} | {m['title']} | {GOOD.get(s, '')} | {m['chars']} |")
rest = [s for s in meta if s not in seen]
if rest:
    o.append('| **Other** | | | | |')
    for s in rest: m = meta[s]; o.append(f"| {s} | {m['url']} | {m['title']} | {GOOD.get(s, '')} | {m['chars']} |")
o.append('\n## Facts per investigation\n\nFormat: **field**: fact. Then the exact sentence and the slug of the page it comes from.\n')
invs = []
for f in good:
    if f['inv'] not in invs: invs.append(f['inv'])
for inv in invs:
    o.append(f'\n### {inv}\n')
    for f in good:
        if f['inv'] == inv:
            o.append(f"- **{f['field']}**: {f['fact']}\n  > \"{f['quote']}\" (`{f['slug']}`)")
(R / 'nasa-pages.md').write_text('\n'.join(o) + '\n')
print('pages', len(meta), 'facts ok', len(good), 'bad', len(bad), 'no goodfor', missing, 'unlisted', rest)
for f in bad: print('BAD', f['slug'], '|', f['quote'][:110])
