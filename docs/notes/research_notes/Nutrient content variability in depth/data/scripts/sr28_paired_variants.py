"""Within-food macro vs micro CV comparison under several filters.
Usage: python3 -I sr28_paired_variants.py <sr28asc_dir> <out_csv>"""
import csv, math, os, statistics as st, sys
from collections import defaultdict
src, outcsv = sys.argv[1], sys.argv[2]
def rows(name):
    with open(os.path.join(src, name), encoding='latin-1') as f:
        for line in f: yield [c.strip('~') for c in line.rstrip('\r\n').split('^')]
def num(x):
    try: return float(x)
    except ValueError: return None
foods = {r[0]: r[1] for r in rows('FOOD_DES.txt')}
F = ['ndb','nutr','val','n','se','src','deriv','ref','addmark','nstud','min','max','df','loweb','upeb','statcmt','date','cc']
data = defaultdict(dict)
for r in rows('NUT_DATA.txt'):
    rec = dict(zip(F, r)); data[rec['ndb']][rec['nutr']] = rec
MICRO = ['401','321','417','404','405','323','303','309','301','304','306','307','317']
GROUPS = {'fruit_veg': {'0900','1100'}, 'legume_nut_grain': {'1200','1600','2000'},
          'meat_fish': {'0500','1000','1300','1500','1700'}, 'dairy_egg': {'0100'}, 'all': None}
def cv(rec, single, consist):
    v, n, se = num(rec['val']), num(rec['n']), num(rec['se'])
    if v is None or n is None or se is None or v <= 0 or n < 5: return None
    if single and rec['nstud'] not in ('', '1'): return None
    if consist:
        mn, mx = num(rec['min']), num(rec['max'])
        if mn is None or mx is None or se*math.sqrt(n) > 0.5*(mx-mn)*math.sqrt(n/(n-1))*1.05 + 1e-9: return None
    return se*math.sqrt(n)/v
variants = [('core macros incl water', ['255','203','204','291','269','209'], False, False),
            ('macros excl water', ['203','204','291','269','209'], False, False),
            ('protein+fat only', ['203','204'], False, False),
            ('macros excl water, single-study', ['203','204','291','269','209'], True, False),
            ('macros excl water, range-consistent', ['203','204','291','269','209'], False, True)]
out = []
for vname, macros, single, consist in variants:
    for g, gs in GROUPS.items():
        ratios, mas, mis = [], [], []
        for ndb, nd in data.items():
            if gs is not None and foods[ndb] not in gs: continue
            ma = [c for c in (cv(nd[k], single, consist) for k in macros if k in nd) if c is not None]
            mi = [c for c in (cv(nd[k], single, consist) for k in MICRO if k in nd) if c is not None]
            if len(ma) >= 1 and len(mi) >= 3:
                a, b = st.median(ma), st.median(mi)
                mas.append(a); mis.append(b)
                if a > 0: ratios.append(b/a)
        if not ratios: continue
        row = [vname, g, len(ratios), f'{st.median(mas):.3f}', f'{st.median(mis):.3f}', f'{st.median(ratios):.2f}',
               f'{sum(r>1 for r in ratios)/len(ratios):.2f}']
        out.append(row); print(row)
with open(outcsv, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['variant','food_group','n_foods','median_of_food_macro_median_cv','median_of_food_micro_median_cv','median_micro/macro_ratio','share_foods_micro_gt_macro'])
    w.writerows(out)
