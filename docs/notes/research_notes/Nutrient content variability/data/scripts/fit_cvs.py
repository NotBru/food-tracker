"""Fit the app's sampling CVs (app/src/errors.js) to USDA SR28.
Per food and nutrient, CV = SE*sqrt(n)/mean (n >= 3). Each SR28 food group goes to one of errors.js's classes,
each nutrient to one of its kinds; a food's CV for a kind is the median over that kind's nutrients, and a class's CV
for a kind the median over its foods (>= MIN_FOODS, else the all-foods median is used).
Energy and carbohydrate have almost no SE in SR28, so they come from the analysed proximates. Carbohydrate is by
difference, C = 100 - W - P - F - A, so per food (components independent):
  Var C = Var W + Var P + Var F + Var A,   Var E = Var(4P + 4C + 9F) = Var(400 - 4W - 4A + 5F) = 16 Var W + 16 Var A + 25 Var F.
Foods with no carbohydrate (<= 1 g, meat, fish...): Var E = 16 Var P + 81 Var F.
Base (any category) = median over all foods; unknown = 75th percentile over all foods.
Usage: python3 -I fit_cvs.py <sr28asc_dir> <out_csv>
"""
import csv, math, os, re, statistics as st, sys
from collections import defaultdict

src, out = sys.argv[1], sys.argv[2]
MIN_N, MIN_FOODS = 3, 5

def rows(name):
    with open(os.path.join(src, name), encoding='latin-1') as f:
        for line in f:
            yield [c.strip('~') for c in line.rstrip('\r\n').split('^')]

def num(x):
    try: return float(x)
    except ValueError: return None

foods = {r[0]: (r[1], r[2]) for r in rows('FOOD_DES.txt')}
F = ['ndb', 'nutr', 'val', 'n', 'se']
data = defaultdict(dict)
for r in rows('NUT_DATA.txt'):
    data[r[0]][r[1]] = dict(zip(F, r))

SWEET = re.compile(r'Cake|Cookie|Pie|Pastr|Doughnut|Danish|Croissant|Muffin|Brownie|Sweet roll|Cream puff|Eclair|Strudel', re.I)
def cls(ndb):
    g, desc = foods[ndb]
    if g == '0100': return 'eggs' if desc.startswith('Egg') else 'dairy'
    if g == '1800':  # bakery: breads, rolls, tortillas (moist); crackers and the like go with grains
        if SWEET.search(desc): return 'sweets'
        return 'bakery' if (num(data[ndb].get('255', {}).get('val', '')) or 0) > 20 else 'grains'
    return {'0200': 'seasonings', '0300': 'baby', '0400': 'fats', '0500': 'meat', '0600': 'dishes', '0700': 'meat',
            '0800': 'grains', '0900': 'fruit', '1000': 'meat', '1100': 'produce', '1200': 'nuts', '1300': 'meat',
            '1400': 'beverages', '1500': 'fish', '1600': 'produce', '1700': 'meat', '1900': 'sweets', '2000': 'grains',
            '2100': 'dishes', '2200': 'dishes', '3600': 'dishes'}.get(g)

KIND = {
    '255': 'water', '203': 'protein', '269': 'sugars', '291': 'fibre', '204': 'fat', '606': 'fat', '645': 'fat',
    '646': 'fat', '601': 'fat', '221': 'alcohol',
    '306': 'majorMinerals', '305': 'majorMinerals', '304': 'majorMinerals',
    '307': 'minerals', '301': 'minerals', '303': 'minerals', '309': 'minerals', '312': 'minerals', '315': 'minerals',
    '317': 'trace',
    '404': 'bVitamins', '405': 'bVitamins', '406': 'bVitamins', '410': 'bVitamins', '415': 'bVitamins',
    '418': 'bVitamins', '323': 'bVitamins',
    '321': 'folateCarotene', '417': 'folateCarotene', '430': 'folateCarotene',
    '401': 'vitaminC', '328': 'vitaminD', '262': 'other',
}

def cv(rec):
    if not rec: return None
    v, n, se = num(rec['val']), num(rec['n']), num(rec['se'])
    if v is None or n is None or not se or v <= 0 or n < MIN_N: return None  # SE 0: a placeholder
    return se * math.sqrt(n) / v

def var(rec):
    c = cv(rec)
    return None if c is None else (c * num(rec['val'])) ** 2

per = defaultdict(lambda: defaultdict(list))   # kind -> class -> [food CV]
for ndb, nd in data.items():
    c = cls(ndb)
    byk = defaultdict(list)
    for code, rec in nd.items():
        k = KIND.get(code)
        x = cv(rec)
        if k and x is not None: byk[k].append(x)
    vw, vp, vf, va = (var(nd.get(k)) for k in ('255', '203', '204', '207'))
    e, carb = num(nd.get('208', {}).get('val', '')), num(nd.get('205', {}).get('val', ''))
    if e and e > 0 and not num(nd.get('221', {}).get('val', '0')):
        if carb and carb > 1:
            if None not in (vw, vf, va): byk['energy'].append(math.sqrt(16 * vw + 16 * va + 25 * vf) / e)
        elif None not in (vp, vf): byk['energy'].append(math.sqrt(16 * vp + 81 * vf) / e)
    if None not in (vw, vp, vf, va) and carb and carb > 1:
        byk['carbs'].append(math.sqrt(vw + vp + vf + va) / carb)
    for k, xs in byk.items():
        per[k]['all'].append(st.median(xs))
        if c: per[k][c].append(st.median(xs))

CLASSES = ['produce', 'fruit', 'nuts', 'grains', 'bakery', 'meat', 'fish', 'eggs', 'dairy', 'fats', 'dishes', 'sweets',
           'beverages', 'seasonings', 'baby']
KINDS = ['water', 'protein', 'carbs', 'sugars', 'fibre', 'fat', 'energy', 'alcohol', 'majorMinerals', 'minerals',
         'trace', 'bVitamins', 'folateCarotene', 'vitaminC', 'vitaminD', 'other']
with open(out, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['kind', 'class', 'n_foods', 'cv_median', 'cv_p75'])
    for k in KINDS:
        xs = per[k]['all']
        if len(xs) < MIN_FOODS: print('no fit for', k, len(xs)); continue
        q = st.quantiles(xs, n=4)
        w.writerow([k, 'base', len(xs), f'{q[1]:.3f}', f'{q[2]:.3f}'])
        print(f'{k:15s} base   n={len(xs):5d} med={q[1]:.3f} p75={q[2]:.3f}')
        meds = {c: st.median(per[k][c]) for c in CLASSES if len(per[k][c]) >= MIN_FOODS}
        for c, m in meds.items():
            w.writerow([k, c, len(per[k][c]), f'{m:.3f}', ''])
            print(f'   {c:12s} n={len(per[k][c]):5d} med={m:.3f}')
        u = q[2]
        w.writerow([k, 'unknown', len(xs), f'{u:.3f}', ''])
        print(f'   unknown      {u:.3f}')
