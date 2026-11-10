# python3 rep.py <file> <pairs.py>: exact, unique replacements (pairs.py defines P = [(old, new), ...]); fails on a missing or repeated anchor
import sys
f, pf = sys.argv[1], sys.argv[2]
s = open(f, encoding='utf-8').read()
ns = {}
exec(open(pf, encoding='utf-8').read(), ns)
for a, b in ns['P']:
    n = s.count(a)
    if n != 1:
        sys.exit(f'{n} matches in {f}: {a[:90]!r}')
    s = s.replace(a, b)
open(f, 'w', encoding='utf-8').write(s)
print('ok', f, len(ns['P']))
