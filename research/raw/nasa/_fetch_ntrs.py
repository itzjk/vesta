#!/usr/bin/env python3
"""Cache an NTRS record: API title + abstract, then the PDF text when a PDF under 20 MB exists.
usage: _fetch_ntrs.py <slug> <id> [...]  ->  ntrs-<slug>.txt (+ .pdf, + html/ntrs-<slug>.json)"""
import sys, json, subprocess, time, pathlib
D = pathlib.Path(__file__).resolve().parent
UA = 'research-cache/1.0'
def run(args):
    for i in range(3):
        r = subprocess.run(args, capture_output=True, text=True); time.sleep(1)
        if r.returncode == 0: return r.stdout
        time.sleep(3)
    return None
a = sys.argv[1:]
for slug, cid in zip(a[0::2], a[1::2]):
    api = f'https://ntrs.nasa.gov/api/citations/{cid}'
    rec = {'slug': 'ntrs-' + slug, 'url': f'https://ntrs.nasa.gov/citations/{cid}', 'ok': False, 'at': time.strftime('%Y-%m-%dT%H:%M:%S')}
    out = run(['curl', '-s', '-m', '60', '-A', UA, api])
    try: d = json.loads(out)
    except Exception: d = None
    if d and d.get('title'):
        (D / 'html' / f'ntrs-{slug}.json').write_text(json.dumps(d))
        pub = (d.get('publications') or [{}])[0]
        authors = '; '.join(x.get('meta', {}).get('author', {}).get('name', '') for x in d.get('authorAffiliations', []))
        head = f"{rec['url']}\nTITLE: {d['title']}\nFETCHED: {rec['at']}\nNTRS-ID: {cid}\nDATE: {(pub.get('publicationDate') or d.get('distributionDate') or '')[:10]}\nAUTHORS: {authors}\nREPORT: {'; '.join(d.get('otherReportNumbers') or [])}\n"
        body = f"# {d['title']}\n\n## Abstract (NTRS record)\n\n{d.get('abstract') or ''}\n"
        pdfs = [x['links'].get('pdf') or x['links'].get('original') for x in d.get('downloads', []) if x.get('links')]
        pdfs = [p for p in pdfs if p and p.lower().split('?')[0].endswith('.pdf')]
        if pdfs:
            purl = 'https://ntrs.nasa.gov' + pdfs[0]
            pf = D / f'ntrs-{slug}.pdf'
            code = run(['curl', '-sL', '-m', '180', '--max-filesize', '20000000', '-A', UA, '-o', str(pf), '-w', '%{http_code}', purl])
            if code == '200' and pf.exists() and pf.read_bytes()[:4] == b'%PDF':
                t = subprocess.run(['pdftotext', '-layout', str(pf), '-'], capture_output=True, text=True).stdout
                head += f'PDF: {purl}\n'
                body += f'\n## Full text (pdftotext -layout)\n\n{t}\n'
                rec['pdf_chars'] = len(t)
            else:
                rec['pdf_error'] = f'http {code}'; pf.unlink(missing_ok=True)
        (D / f'ntrs-{slug}.txt').write_text(head + '\n' + body)
        rec.update(ok=True, title=d['title'], chars=len(body))
    else: rec['info'] = (out or 'no response')[:150]
    open(D / '_fetchlog.jsonl', 'a').write(json.dumps(rec) + '\n')
    print(rec['slug'], rec['ok'], rec.get('chars'), rec.get('pdf_chars'), rec.get('pdf_error'), (rec.get('title') or rec.get('info'))[:80])
