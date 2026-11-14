#!/usr/bin/env python3
"""Cache nasa.gov 'migration' posts (legacy pages with no public permalink) through the WordPress REST API.
usage: _fetch_wp.py list <query>...   |   _fetch_wp.py get <slug> <id> [<slug> <id> ...]"""
import sys, json, subprocess, time, pathlib, importlib.util
D = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('f', D / '_fetch.py')
src = (D / '_fetch.py').read_text().replace('\nmain()\n', '\n')
ns = {'__file__': str(D / '_fetch.py')}; exec(compile(src, '_fetch.py', 'exec'), ns)
def curl(u):
    for i in range(3):
        r = subprocess.run(['curl', '-s', '-m', '60', '-A', ns['UA'], u], capture_output=True, text=True); time.sleep(1)
        try: return json.loads(r.stdout)
        except Exception: time.sleep(3)
    return None
if sys.argv[1] == 'list':
    seen = set()
    for q in sys.argv[2:]:
        for r in curl(f'https://www.nasa.gov/wp-json/wp/v2/search?search={q}&per_page=30') or []:
            if r['id'] not in seen and r.get('subtype') == 'migration':
                seen.add(r['id']); print(r['id'], r['url'], '|', r['title'])
else:
    a = sys.argv[2:]
    for slug, pid in zip(a[0::2], a[1::2]):
        u = f'https://www.nasa.gov/wp-json/wp/v2/migration/{pid}'
        d = curl(u)
        rec = {'slug': slug, 'url': u, 'ok': bool(d and d.get('content')), 'at': time.strftime('%Y-%m-%dT%H:%M:%S')}
        if rec['ok']:
            (D / 'html' / f'{slug}.json').write_text(json.dumps(d))
            import html as H
            title = H.unescape(d['title']['rendered'])
            _, body = ns['to_text']('<body>' + d['content']['rendered'] + '</body>')
            (D / f'{slug}.txt').write_text(f'{u}\nTITLE: {title}\nFETCHED: {rec["at"]}\nPUBLIC-LINK: {d.get("link")}\nDATE: {d.get("date")}\n\n# {title}\n\n{body}\n')
            rec.update(title=title, chars=len(body))
        else: rec['info'] = str(d)[:200]
        open(D / '_fetchlog.jsonl', 'a').write(json.dumps(rec) + '\n'); print(slug, rec['ok'], rec.get('chars'), rec.get('title') or rec.get('info'))
