#!/usr/bin/env python3
"""Deterministic gate for the VESTA evidence base: a quote counts only if it appears verbatim in its cached source text.

usage: python3 quotecheck.py <findings.json> [--refetch] [--report out.json]

findings.json  {"findings": [ {"id":..., "quote":..., "source": {"kind": "ntrs|psi|nasa-page|pdf", "id":..., "url":..., "text_file": "raw/..."}} ]}
               text_file is relative to the research/ folder (the parent of tools/).
Normalisation applied to both sides, and nothing else: Unicode NFKC, curly quotes and long dashes folded to ASCII,
soft hyphens removed, runs of whitespace collapsed to one space.
--refetch      for kind == "ntrs": download https://ntrs.nasa.gov/api/citations/<id> again and require the quote
               to be present in the live title + abstract as well (proves the cached text is the real record).
Exit code 0 only when every finding passes.
"""
import json, sys, time, unicodedata, re, pathlib, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
FOLD = {'‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '−': '-', '‐': '-', '‑': '-', '­': ''}

def norm(s):
    s = unicodedata.normalize('NFKC', s or '')
    for k, v in FOLD.items():
        s = s.replace(k, v)
    return re.sub(r'\s+', ' ', s).strip()

def live_ntrs(cid):
    req = urllib.request.Request(f'https://ntrs.nasa.gov/api/citations/{cid}', headers={'User-Agent': 'evidence-check/1.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    return norm((d.get('title') or '') + ' ' + (d.get('abstract') or ''))

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        print(__doc__); sys.exit(2)
    refetch = '--refetch' in sys.argv
    report_path = None
    if '--report' in sys.argv:
        report_path = sys.argv[sys.argv.index('--report') + 1]
        args = [a for a in args if a != report_path]
    data = json.load(open(args[0]))
    findings = data['findings'] if isinstance(data, dict) else data
    rows, bad = [], 0
    live_cache = {}
    for f in findings:
        fid, quote, src = f.get('id'), f.get('quote') or '', f.get('source') or {}
        row = {'id': fid, 'cached': False, 'live': None, 'why': ''}
        q = norm(quote)
        tf = src.get('text_file')
        if len(q) < 25:
            row['why'] = 'quote shorter than 25 characters'
        elif not tf or not (ROOT / tf).is_file():
            row['why'] = f'missing text_file {tf!r}'
        else:
            row['cached'] = q in norm((ROOT / tf).read_text(errors='replace'))
            if not row['cached']:
                row['why'] = 'quote not found verbatim in cached text'
        if refetch and src.get('kind') == 'ntrs' and row['cached']:
            cid = str(src.get('id'))
            try:
                if cid not in live_cache:
                    live_cache[cid] = live_ntrs(cid); time.sleep(1.0)
                row['live'] = q in live_cache[cid]
                if not row['live']:
                    row['why'] = 'quote is in the cached file but not in the live NTRS title+abstract (full-text quotes need kind "pdf")'
            except Exception as e:
                row['live'] = None; row['why'] = f'refetch failed: {e}'
        ok = row['cached'] and (row['live'] is not False)
        row['pass'] = ok
        bad += 0 if ok else 1
        rows.append(row)
        print(('PASS ' if ok else 'FAIL ') + str(fid) + ('' if ok else '  <- ' + row['why']))
    input_path = pathlib.Path(args[0]).resolve()
    try:
        input_name = input_path.relative_to(ROOT.parent).as_posix()
    except ValueError:
        input_name = input_path.name
    summary = {'file': input_name, 'total': len(rows), 'passed': len(rows) - bad, 'failed': bad}
    print(json.dumps(summary))
    if report_path:
        json.dump({'summary': summary, 'rows': rows}, open(report_path, 'w'), indent=1)
    sys.exit(0 if bad == 0 else 1)

if __name__ == '__main__':
    main()
