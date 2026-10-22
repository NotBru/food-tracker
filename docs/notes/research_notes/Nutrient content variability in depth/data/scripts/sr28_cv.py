"""Compute sample-to-sample CVs from USDA SR28 NUT_DATA.
CV = SD/mean, SD = Std_Error * sqrt(Num_Data_Pts).
Usage: python3 -I sr28_cv.py <sr28asc_dir> <out_dir>
Writes: sr28_cv_selected_foods.csv, sr28_cv_by_nutrient.csv, sr28_cv_macro_vs_micro_paired.csv,
        sr28_banana_detail.csv
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

foods = {r[0]: (r[1], r[2]) for r in rows('FOOD_DES.txt')}          # ndb -> (group, desc)
groups = {r[0]: r[1] for r in rows('FD_GROUP.txt')}
ndef = {r[0]: (r[3], r[1]) for r in rows('NUTR_DEF.txt')}            # nutr -> (desc, unit)

# nutrient set: code -> (short label, class)
NUTS = {
 '255': ('Water', 'macro'), '203': ('Protein', 'macro'), '204': ('Total fat', 'macro'),
 '205': ('Carbohydrate (by diff.)', 'macro'), '269': ('Total sugars', 'macro'),
 '209': ('Starch', 'macro'), '291': ('Fibre, total dietary', 'macro'), '207': ('Ash', 'macro'),
 '208': ('Energy kcal', 'macro'),
 '401': ('Vitamin C', 'micro'), '320': ('Vitamin A RAE', 'micro'), '319': ('Retinol', 'micro'),
 '321': ('beta-Carotene', 'micro'), '322': ('alpha-Carotene', 'micro'),
 '417': ('Folate, total', 'micro'), '432': ('Folate, food', 'micro'),
 '404': ('Thiamin', 'micro'), '405': ('Riboflavin', 'micro'), '406': ('Niacin', 'micro'),
 '415': ('Vitamin B6', 'micro'), '418': ('Vitamin B12', 'micro'), '323': ('Vitamin E (alpha-toc.)', 'micro'),
 '430': ('Vitamin K1', 'micro'), '421': ('Choline', 'micro'),
 '303': ('Iron', 'micro'), '309': ('Zinc', 'micro'), '301': ('Calcium', 'micro'),
 '304': ('Magnesium', 'micro'), '306': ('Potassium', 'micro'), '307': ('Sodium', 'micro'),
 '317': ('Selenium', 'micro'), '305': ('Phosphorus', 'micro'), '312': ('Copper', 'micro'),
 '315': ('Manganese', 'micro'),
}
MACRO_CORE = ['255', '203', '204', '291', '269', '209']           # analysed proximates (carb by diff usually has no SE)
MICRO_CORE = ['401', '321', '417', '404', '405', '323', '303', '309', '301', '304', '306', '307', '317']

SELECTED = [
 ('09040', 'Banana'), ('09003', 'Apple, with skin'), ('09200', 'Orange'), ('11352', 'Potato, flesh+skin'),
 ('11529', 'Tomato, red, year-round'), ('11124', 'Carrot'), ('11090', 'Broccoli'), ('11457', 'Spinach'),
 ('20444', 'White rice, long-grain, unenriched'), ('20081', 'Wheat flour, white, enriched'),
 ('20080', 'Wheat flour, whole-grain'), ('08120', 'Oats, regular/quick, dry'),
 ('16014', 'Black beans, dry'), ('16032', 'Kidney beans, dry'), ('16042', 'Pinto beans, dry'),
 ('01123', 'Egg, whole, raw'), ('01211', 'Milk, whole, no added vit A/D'), ('01077', 'Milk, whole, vit D added'),
 ('01009', 'Cheddar'),
 ('23572', 'Beef, ground 80/20'), ('23584', 'Beef, top sirloin lean, select'), ('13235', 'Beef, T-bone lean, choice'),
 ('13294', 'Beef, chuck under blade lean, choice'),
 ('10060', 'Pork tenderloin, lean'), ('10040', 'Pork loin chop, lean'),
 ('05062', 'Chicken breast, meat only'), ('05057', 'Chicken breast, meat+skin'),
 ('15236', 'Salmon, Atlantic, farmed'), ('15076', 'Salmon, Atlantic, wild'), ('15085', 'Salmon, sockeye'),
 ('15081', 'Salmon, coho, wild'),
 ('12061', 'Almonds'), ('12078', 'Brazil nuts'),
]

# NUT_DATA fields
F = ['ndb','nutr','val','n','se','src','deriv','ref','addmark','nstud','min','max','df','loweb','upeb','statcmt','date','cc']
data = defaultdict(dict)   # ndb -> nutr -> record
for r in rows('NUT_DATA.txt'):
    rec = dict(zip(F, r))
    data[rec['ndb']][rec['nutr']] = rec

def cv_of(rec):
    v, n, se = num(rec['val']), num(rec['n']), num(rec['se'])
    if v is None or n is None or se is None or v <= 0 or n < 2:
        return None
    return se * math.sqrt(n) / v

def fmt(x, d=3):
    return '' if x is None else (f'{x:.{d}f}' if isinstance(x, float) else str(x))

os.makedirs(out, exist_ok=True)

# 1. Selected foods table
with open(os.path.join(out, 'sr28_cv_selected_foods.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['ndb_no','food','sr28_description','nutr_no','nutrient','class','unit','mean_per_100g','n_data_pts',
                'std_error','sd_est','cv','min','max','rel_range_(max-min)/mean','n_studies','src_cd','deriv_cd','stat_cmt'])
    for ndb, label in SELECTED:
        if ndb not in foods: print('missing', ndb, label); continue
        for code, (nm, cls) in NUTS.items():
            rec = data[ndb].get(code)
            if not rec: continue
            v, n, se = num(rec['val']), num(rec['n']), num(rec['se'])
            cv = cv_of(rec)
            sd = se * math.sqrt(n) if (se is not None and n) else None
            mn, mx = num(rec['min']), num(rec['max'])
            rr = (mx - mn) / v if (mn is not None and mx is not None and v) else None
            w.writerow([ndb, label, foods[ndb][1], code, nm, cls, ndef[code][1], rec['val'], rec['n'], rec['se'],
                        fmt(sd), fmt(cv), rec['min'], rec['max'], fmt(rr), rec['nstud'], rec['src'], rec['deriv'], rec['statcmt']])

# 2. Database-wide per-nutrient distribution
THRESHOLDS = [3, 5, 10]
summary = []
for code, (nm, cls) in NUTS.items():
    for th in THRESHOLDS:
        cvs = []
        cvs_src1 = []
        for ndb, nd in data.items():
            rec = nd.get(code)
            if not rec: continue
            n = num(rec['n'])
            if n is None or n < th: continue
            c = cv_of(rec)
            if c is None: continue
            cvs.append(c)
            if rec['src'] == '1' and (rec['nstud'] in ('', '1')): cvs_src1.append(c)
        if not cvs:
            summary.append([code, nm, cls, th, 0] + ['']*7); continue
        q = st.quantiles(cvs, n=4) if len(cvs) >= 4 else [None, st.median(cvs), None]
        summary.append([code, nm, cls, th, len(cvs), fmt(q[0]), fmt(st.median(cvs)), fmt(q[2]),
                        fmt(sum(1 for c in cvs if c > 0.5)/len(cvs)), len(cvs_src1),
                        fmt(st.median(cvs_src1)) if cvs_src1 else '', ''])
with open(os.path.join(out, 'sr28_cv_by_nutrient.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['nutr_no','nutrient','class','min_n','foods_with_cv','cv_p25','cv_median','cv_p75',
                'share_cv_gt_0.5','foods_src1_single_study','cv_median_src1_single_study','note'])
    w.writerows(summary)

# 3. Paired macro vs micro within the same food (n>=5): median CV of core macros vs core micros
TH = 5
paired = []
for ndb, nd in data.items():
    def cvs(codes):
        res = []
        for c in codes:
            rec = nd.get(c)
            if rec and num(rec['n']) is not None and num(rec['n']) >= TH:
                x = cv_of(rec)
                if x is not None: res.append(x)
        return res
    ma, mi = cvs(MACRO_CORE), cvs(MICRO_CORE)
    if len(ma) >= 2 and len(mi) >= 3:
        paired.append((ndb, foods[ndb][1], groups.get(foods[ndb][0], ''), len(ma), st.median(ma), len(mi), st.median(mi)))
with open(os.path.join(out, 'sr28_cv_macro_vs_micro_paired.csv'), 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['ndb_no','description','food_group','n_macro_cvs','median_macro_cv','n_micro_cvs','median_micro_cv','micro_over_macro'])
    for p in paired:
        w.writerow([p[0], p[1], p[2], p[3], fmt(p[4]), p[5], fmt(p[6]), fmt(p[6]/p[4] if p[4] else None, 2)])

# console summary
print(f'foods in SR28: {len(foods)}; nutrient rows: {sum(len(v) for v in data.values())}')
allrecs = [r for nd in data.values() for r in nd.values()]
print('rows with n>=1:', sum(1 for r in allrecs if (num(r["n"]) or 0) >= 1),
      ' with SE:', sum(1 for r in allrecs if num(r['se']) is not None),
      ' n==0 (calc/imputed):', sum(1 for r in allrecs if num(r['n']) == 0))
print('\nmedian CV per nutrient (n>=5), ranked:')
rk = sorted([s for s in summary if s[3] == 5 and s[4]], key=lambda s: float(s[6]))
for s in rk: print(f'  {s[1]:28s} {s[2]:5s} foods={s[4]:5d} p25={s[5]} med={s[6]} p75={s[7]} >0.5:{s[8]}  single-study src1: {s[9]} med={s[10]}')
ratios = [p[6]/p[4] for p in paired if p[4] > 0]
print(f'\npaired foods (n>={TH}): {len(paired)}; micro>macro in {sum(1 for r in ratios if r>1)} ({sum(1 for r in ratios if r>1)/len(ratios):.0%}); median ratio {st.median(ratios):.2f}')
print('median of food-level macro median CV', fmt(st.median([p[4] for p in paired])), ' micro', fmt(st.median([p[6] for p in paired])))
