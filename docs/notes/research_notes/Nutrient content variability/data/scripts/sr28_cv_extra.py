"""Robustness checks on SR28 CVs.
Usage: python3 -I sr28_cv_extra.py <sr28asc_dir> <out_dir>
Writes: sr28_cv_by_nutrient_group.csv, sr28_banana_detail.csv; prints consistency stats.
Consistency test: a sample SD cannot exceed half the range times sqrt(n/(n-1)) (bound for any data set),
so SE*sqrt(n) > 0.5*(max-min)*sqrt(n/(n-1))*1.05 marks an SE that is not a simple SE of the n points.
"""
import csv, math, os, statistics as st, sys
from collections import defaultdict
src, out = sys.argv[1], sys.argv[2]
def rows(name):
    with open(os.path.join(src, name), encoding='latin-1') as f:
        for line in f:
            yield [c.strip('~') for c in line.rstrip('\r\n').split('^')]
def num(x):
    try: return float(x)
    except ValueError: return None
foods = {r[0]: (r[1], r[2]) for r in rows('FOOD_DES.txt')}
ndef = {r[0]: (r[3], r[1]) for r in rows('NUTR_DEF.txt')}
F = ['ndb','nutr','val','n','se','src','deriv','ref','addmark','nstud','min','max','df','loweb','upeb','statcmt','date','cc']
data = defaultdict(dict)
for r in rows('NUT_DATA.txt'):
    rec = dict(zip(F, r)); data[rec['ndb']][rec['nutr']] = rec

NUTS = {'255':'Water','203':'Protein','204':'Total fat','269':'Total sugars','209':'Starch','291':'Fibre',
        '401':'Vitamin C','321':'beta-Carotene','320':'Vitamin A RAE','417':'Folate, total','404':'Thiamin',
        '405':'Riboflavin','406':'Niacin','415':'Vitamin B6','323':'Vitamin E','303':'Iron','309':'Zinc','301':'Calcium',
        '304':'Magnesium','306':'Potassium','307':'Sodium','317':'Selenium','305':'Phosphorus','312':'Copper'}
MACRO = {'255','203','204','269','209','291'}
GROUPS = {'Fruits & vegetables (0900,1100)': {'0900','1100'}, 'Legumes, nuts, cereal grains (1200,1600,2000)': {'1200','1600','2000'},
          'Meat, poultry, fish (0500,1000,1300,1500,1700)': {'0500','1000','1300','1500','1700'},
          'Dairy & egg (0100)': {'0100'}}

def cv(rec):
    v, n, se = num(rec['val']), num(rec['n']), num(rec['se'])
    if v is None or n is None or se is None or v <= 0 or n < 2: return None
    return se*math.sqrt(n)/v
def consistent(rec):
    mn, mx, n, se = num(rec['min']), num(rec['max']), num(rec['n']), num(rec['se'])
    if None in (mn, mx, n, se) or n < 2: return None
    return se*math.sqrt(n) <= 0.5*(mx-mn)*math.sqrt(n/(n-1))*1.05 + 1e-9

# consistency stats overall (n>=5)
tot = bad = 0; bad_by_stat = defaultdict(int); tot_by_stat = defaultdict(int); bad_multi = tot_multi = 0
for nd in data.values():
    for rec in nd.values():
        if (num(rec['n']) or 0) < 5 or cv(rec) is None: continue
        c = consistent(rec)
        if c is None: continue
        tot += 1; bad += (not c)
        tot_by_stat[rec['statcmt'] or '-'] += 1; bad_by_stat[rec['statcmt'] or '-'] += (not c)
        if rec['nstud'] not in ('', '1'):
            tot_multi += 1; bad_multi += (not c)
print(f'records n>=5 with SE and min/max: {tot}; SD exceeds range bound: {bad} ({bad/tot:.1%})')
print(f'  of which multi-study (Num_Studies>1): {tot_multi}, violating {bad_multi}')
print('  by Stat_cmt:', {k: f'{bad_by_stat[k]}/{tot_by_stat[k]}' for k in tot_by_stat})
nse = sum(1 for nd in data.values() for r in nd.values() if (num(r['n']) or 0) >= 3 and num(r['se']) is None)
print('records with n>=3 but no SE:', nse)

# per-nutrient x group: median CV (n>=5), median CV restricted to range-consistent records, median relative range
res = []
for code, nm in NUTS.items():
    for gname, gset in list(GROUPS.items()) + [('ALL foods', None)]:
        cvs, cvs_ok, rr, rr_n = [], [], [], []
        for ndb, nd in data.items():
            if gset is not None and foods[ndb][0] not in gset: continue
            rec = nd.get(code)
            if not rec or (num(rec['n']) or 0) < 5: continue
            c = cv(rec)
            if c is not None:
                cvs.append(c)
                if consistent(rec): cvs_ok.append(c)
            mn, mx, v = num(rec['min']), num(rec['max']), num(rec['val'])
            if mn is not None and mx is not None and v and v > 0:
                rr.append((mx-mn)/v)
        med = lambda l: f'{st.median(l):.3f}' if l else ''
        res.append([code, nm, 'macro' if code in MACRO else 'micro', gname, len(cvs), med(cvs), len(cvs_ok), med(cvs_ok), len(rr), med(rr)])
with open(os.path.join(out, 'sr28_cv_by_nutrient_group.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['nutr_no','nutrient','class','food_group','n_foods_cv','median_cv','n_foods_cv_range_consistent',
                'median_cv_range_consistent','n_foods_minmax','median_rel_range_(max-min)/mean'])
    w.writerows(res)
for g in list(GROUPS) + ['ALL foods']:
    print('\n==', g)
    for r in sorted([r for r in res if r[3] == g and r[5]], key=lambda r: float(r[5])):
        print(f'  {r[1]:16s} {r[2]:5s} n={r[4]:5d} medCV={r[5]}  consistent-only n={r[6]:5d} medCV={r[7]}  relrange n={r[8]} med={r[9]}')

# Banana detail
with open(os.path.join(out, 'sr28_banana_detail.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['nutr_no','nutrient','unit','mean_per_100g','n_data_pts','std_error','cv','min','max','n_studies','src_cd','deriv_cd','df','low_eb','up_eb','stat_cmt','addmod_date'])
    for code, rec in sorted(data['09040'].items(), key=lambda kv: kv[0]):
        if code in ('255','203','204','205','269','209','291','210','211','212','213','214','287','207','208','306','401'):
            c = cv(rec)
            w.writerow([code, ndef[code][0], ndef[code][1], rec['val'], rec['n'], rec['se'], f'{c:.3f}' if c is not None else '',
                        rec['min'], rec['max'], rec['nstud'], rec['src'], rec['deriv'], rec['df'], rec['loweb'], rec['upeb'], rec['statcmt'], rec['date']])
            print('banana', code, ndef[code][0], rec['val'], 'n', rec['n'], 'se', rec['se'], 'min', rec['min'], 'max', rec['max'], 'studies', rec['nstud'], 'src', rec['src'], rec['deriv'], 'df', rec['df'], 'EB', rec['loweb'], rec['upeb'], 'date', rec['date'])
