"""Print the BASE and CLASSES tables of app/src/errors.js from the two fits.
Foundation Foods (per-sample, mostly single purchases) where a class has >= MIN_FOODS foods for a kind; otherwise
SR28 x SR28_TO_ITEM, the median ratio of Foundation Foods' CVs to SR28's over the class x kind pairs both have.
Usage: python3 -I cv_table.py <foundation_fitted_cvs.csv> <sr28_fitted_cvs.csv>
"""
import csv, statistics as st, sys

MIN_FOODS = 10
CLASSES = ['unknown', 'produce', 'fruit', 'nuts', 'grains', 'bakery', 'meat', 'fish', 'eggs', 'dairy', 'fats', 'dishes', 'sweets',
           'beverages', 'seasonings', 'baby']
KINDS = ['water', 'protein', 'carbs', 'sugars', 'fibre', 'fat', 'energy', 'alcohol', 'majorMinerals', 'minerals',
         'trace', 'bVitamins', 'folateCarotene', 'vitaminC', 'vitaminD', 'other']

def load(path):
    out = {}
    for r in csv.DictReader(open(path)):
        out[(r['kind'], r['class'])] = (int(r['n_foods']), float(r['cv_median']))
    return out

ff, sr = load(sys.argv[1]), load(sys.argv[2])
ratio = st.median(ff[k][1] / sr[k][1] for k in ff if k in sr and sr[k][1] > 0 and k[1] not in ('unknown', 'base'))

def pick(kind, cls):
    if (kind, cls) in ff and ff[kind, cls][0] >= MIN_FOODS: return ff[kind, cls][1]
    if (kind, cls) in sr: return sr[kind, cls][1] * ratio
    return None

sig = lambda x: float(f'{x:.2g}')
def block(d, indent):
    items, lines, line = [f'{k}: {v}' for k, v in d.items()], [], ''
    for it in items:
        if len(line) + len(it) + 2 > 116 - len(indent): lines.append(line.rstrip()); line = ''
        line += it + ', '
    lines.append(line.rstrip().rstrip(','))
    return '\n'.join(indent + l for l in lines) + ','

print(f'// SR28_TO_ITEM = {ratio:.2f}')
print('const BASE = {\n' + block({k: sig(pick(k, 'base')) for k in KINDS if pick(k, 'base')}, '  ') + '\n}')
print('const CLASSES = {')
for c in CLASSES:
    d = {k: sig(v) for k in KINDS if (v := pick(k, c)) is not None and (c == 'unknown' or (k, c) in ff or (k, c) in sr)}
    print(f'  {c}: {{\n' + block(d, '    ') + '\n  },')
print('}')
