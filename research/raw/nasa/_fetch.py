#!/usr/bin/env python3
"""Cache a NASA page as plain text. usage: _fetch.py <slug> <url> [<slug> <url> ...]
Writes html/<slug>.html (or <slug>.pdf) and <slug>.txt (URL on line 1). One request at a time, 1 s pause, 3 tries."""
import sys, re, html, subprocess, time, pathlib, json
D = pathlib.Path(__file__).resolve().parent
UA = 'Mozilla/5.0 (Macintosh) research-cache/1.0'
BLOCK = r'(script|style|noscript|svg|nav|header|footer|aside|button|iframe|select)'

def get(url, out):
    for i in range(3):
        r = subprocess.run(['curl', '-sL', '-m', '90', '--max-filesize', '20000000', '-A', UA, '-o', str(out),
                            '-w', '%{http_code} %{content_type}', url], capture_output=True, text=True)
        time.sleep(1)
        code = r.stdout.split(' ')[0] if r.stdout else '000'
        if code == '200' and out.exists() and out.stat().st_size > 0:
            return code, r.stdout.split(' ', 1)[1] if ' ' in r.stdout else ''
        err = f'http {code} curl_exit {r.returncode}'
        time.sleep(3)
    return None, err

def to_text(h):
    m = re.search(r'<main\b.*?</main>', h, flags=re.S | re.I) or re.search(r'<article\b.*?</article>', h, flags=re.S | re.I) \
        or re.search(r'<body\b.*?</body>', h, flags=re.S | re.I)
    b = m.group(0) if m else h
    t = re.search(r'<title[^>]*>(.*?)</title>', h, flags=re.S | re.I)
    title = html.unescape(re.sub(r'\s+', ' ', t.group(1))).strip() if t else ''
    b = re.sub(r'<!--.*?-->', '', b, flags=re.S)
    b = re.sub(rf'<{BLOCK}\b[^>]*>.*?</\1>', ' ', b, flags=re.S | re.I)
    b = re.sub(r'<h([1-6])\b[^>]*>', lambda m: '\n\n' + '#' * int(m.group(1)) + ' ', b, flags=re.I)
    b = re.sub(r'<li\b[^>]*>', '\n- ', b, flags=re.I)
    b = re.sub(r'<(br|/p|/div|/h[1-6]|/li|/tr|/ul|/ol|/table|/section|/blockquote|/dd|/dt)\b[^>]*>', '\n', b, flags=re.I)
    b = re.sub(r'<(p|div|tr|section|blockquote)\b[^>]*>', '\n', b, flags=re.I)
    b = re.sub(r'</t[dh]>', ' | ', b, flags=re.I)
    b = re.sub(r'<[^>]+>', '', b)
    b = html.unescape(b).replace('\xa0', ' ')
    lines = [re.sub(r'[ \t\r\f\v]+', ' ', l).strip() for l in b.split('\n')]
    out, blank = [], False
    for l in lines:
        if not l or l in ('-', '|'):
            blank = True; continue
        if blank and out: out.append('')
        out.append(l); blank = False
    return title, '\n'.join(out)

def main():
    a = sys.argv[1:]
    log = D / '_fetchlog.jsonl'
    for slug, url in zip(a[0::2], a[1::2]):
        ispdf = url.split('?')[0].lower().endswith('.pdf')
        raw = D / (f'{slug}.pdf' if ispdf else f'html/{slug}.html')
        raw.parent.mkdir(exist_ok=True)
        code, info = get(url, raw)
        rec = {'slug': slug, 'url': url, 'ok': bool(code), 'info': info, 'at': time.strftime('%Y-%m-%dT%H:%M:%S')}
        if code:
            head = raw.read_bytes()[:5]
            if ispdf or head.startswith(b'%PDF'):
                if not ispdf:
                    raw = raw.rename(D / f'{slug}.pdf')
                body = subprocess.run(['pdftotext', '-layout', str(raw), '-'], capture_output=True, text=True).stdout
                title = ''
            else:
                title, body = to_text(raw.read_text(errors='replace'))
            (D / f'{slug}.txt').write_text(f'{url}\nTITLE: {title}\nFETCHED: {rec["at"]}\n\n{body}\n')
            rec['title'] = title; rec['chars'] = len(body)
        with open(log, 'a') as f: f.write(json.dumps(rec) + '\n')
        print(json.dumps(rec))
main()
