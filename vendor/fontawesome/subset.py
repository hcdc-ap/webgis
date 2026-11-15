"""Tạo lại vendor/fontawesome/css/all.min.css chỉ gồm icon đang dùng.

Chạy từ thư mục gốc dự án:  python vendor/fontawesome/subset.py
Nguồn: all.full.min.css (Font Awesome Free 6.0.0, đã đổi font-display sang swap, chỉ giữ woff2).
"""
import re

SOURCES = ['index.html', 'app.js', 'ahp-core.js', 'scoring-core.js']
FULL = 'vendor/fontawesome/css/all.full.min.css'
OUT = 'vendor/fontawesome/css/all.min.css'

used = set()
for f in SOURCES:
    used |= set(re.findall(r'fa-[a-z0-9]+(?:-[a-z0-9]+)*', open(f, encoding='utf-8').read()))

css = open(FULL, encoding='utf-8').read()
m = re.match(r'(/\*!.*?\*/)\s*', css, re.S)
header, body = m.group(1), css[m.end():]

rules, depth, start = [], 0, 0
for j, ch in enumerate(body):
    if ch == '{':
        depth += 1
    elif ch == '}':
        depth -= 1
        if depth == 0:
            rules.append(body[start:j + 1])
            start = j + 1

icon_sel = re.compile(r'^\.(fa-[a-z0-9-]+):(?:before|after)$')
out = []
for r in rules:
    sel, decl = r.split('{', 1)
    sels = sel.split(',')
    if all(icon_sel.match(s) for s in sels) and decl.strip().startswith('content:'):
        keep = [s for s in sels if icon_sel.match(s).group(1) in used]
        if keep:
            out.append(','.join(keep) + '{' + decl)
    else:
        out.append(r)

open(OUT, 'w', encoding='utf-8').write(
    header + '\n/* Đã lọc chỉ giữ icon được dùng. Thêm icon mới: chạy python vendor/fontawesome/subset.py */\n' + ''.join(out))
print('Wrote', OUT)
