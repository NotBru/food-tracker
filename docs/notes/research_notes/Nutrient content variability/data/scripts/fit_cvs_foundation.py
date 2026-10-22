"""Fit the app's sampling CVs (app/src/errors.js) to USDA FoodData Central Foundation Foods, which publishes every
sample's analyses. Most samples are one store purchase (not a blend), so the spread between samples is close to the
spread between the items a user buys.
A sample's content of a nutrient is the mean of its sub-samples'. Per food (>= MIN_SAMPLES samples), CV = SD/mean
across samples. Protein = nitrogen x the food's conversion factor (6.25 when none). Sugars = the sum of the sugars
analysed. Per sample, carbohydrate = 100 - water - protein - fat - ash (0 for foods averaging <= 1 g) and energy =
4 protein + 9 fat + 4 carbohydrate, so their CVs keep the correlations between components.
A food's CV for a kind is the median over that kind's nutrients; a class's, the median over its foods (>= MIN_FOODS).
Usage: python3 -I fit_cvs_foundation.py <foundation csv dir> <out_csv>
"""
import csv, os, statistics as st, sys
from collections import defaultdict

src, out = sys.argv[1], sys.argv[2]
MIN_SAMPLES, MIN_FOODS = 4, 5

def rows(name):
    with open(os.path.join(src, name), newline='') as f:
        yield from csv.DictReader(f)

food = {r['fdc_id']: r for r in rows('food.csv')}
cat = {r['id']: r['code'] for r in rows('food_category.csv')}
foundation = [r['fdc_id'] for r in rows('foundation_food.csv')]
inputs = defaultdict(list)
for r in rows('input_food.csv'):
    if food.get(r['fdc_of_input_food'], {}).get('data_type') == 'sample_food':
        inputs[r['fdc_id']].append(r['fdc_of_input_food'])
subs = defaultdict(list)
for r in rows('sub_sample_food.csv'):
    subs[r['fdc_id_of_sample_food']].append(r['fdc_id'])
acq = defaultdict(int)
for r in rows('acquisition_samples.csv'):
    acq[r['fdc_id_of_sample_food']] += 1
factor_food = {r['id']: r['fdc_id'] for r in rows('food_nutrient_conversion_factor.csv')}
nfactor = {factor_food[r['food_nutrient_conversion_factor_id']]: float(r['value'])
           for r in rows('food_protein_conversion_factor.csv') if r['food_nutrient_conversion_factor_id'] in factor_food}

SUGARS = {'1010', '1011', '1012', '1013', '1014', '1075'}
KIND = {
    '1051': 'water', '1004': 'fat', '1258': 'fat', '1292': 'fat', '1293': 'fat', '1253': 'fat', '1079': 'fibre',
    '1092': 'majorMinerals', '1091': 'majorMinerals', '1090': 'majorMinerals',
    '1093': 'minerals', '1087': 'minerals', '1089': 'minerals', '1095': 'minerals', '1098': 'minerals', '1101': 'minerals',
    '1103': 'trace',
    '1165': 'bVitamins', '1166': 'bVitamins', '1167': 'bVitamins', '1170': 'bVitamins', '1175': 'bVitamins',
    '1178': 'bVitamins', '1176': 'bVitamins', '1109': 'bVitamins',
    '1107': 'folateCarotene', '1177': 'folateCarotene', '1185': 'folateCarotene',
    '1162': 'vitaminC', '1114': 'vitaminD', '1057': 'caffeine',
}
WANT = set(KIND) | SUGARS | {'1002', '1007'}

sub_values = defaultdict(lambda: defaultdict(list))   # sub-sample -> nutrient -> values
sub_ids = {s for ss in subs.values() for s in ss}
for r in rows('food_nutrient.csv'):
    if r['fdc_id'] in sub_ids and r['nutrient_id'] in WANT and r['amount'] != '':
        sub_values[r['fdc_id']][r['nutrient_id']].append(float(r['amount']))

def sample(s, f):
    """Nutrient -> content of sample `s` of foundation food `f`, with derived protein, sugars, carbs, energy."""
    acc = defaultdict(list)
    for x in subs[s]:
        for k, vs in sub_values[x].items():
            acc[k] += vs
    v = {k: st.mean(vs) for k, vs in acc.items()}
    if '1002' in v: v['protein'] = v['1002'] * nfactor.get(f, 6.25)
    if any(k in v for k in SUGARS): v['sugars'] = sum(v.get(k, 0) for k in SUGARS)
    return v

def cls(f):
    code = cat.get(food[f]['food_category_id'], '')
    desc = food[f]['description']
    if code == '0100': return 'eggs' if desc.lower().startswith('egg') else 'dairy'
    return {'0200': 'seasonings', '0300': 'baby', '0400': 'fats', '0500': 'meat', '0600': 'dishes', '0700': 'meat',
            '0800': 'grains', '0900': 'fruit', '1000': 'meat', '1100': 'produce', '1200': 'nuts', '1300': 'meat',
            '1400': 'beverages', '1500': 'fish', '1600': 'produce', '1700': 'meat', '1800': 'grains', '1900': 'sweets',
            '2000': 'grains', '2100': 'dishes', '2200': 'dishes', '3600': 'dishes'}.get(code)

def cv(xs):
    xs = [x for x in xs if x is not None]
    if len(xs) < MIN_SAMPLES: return None
    m = st.mean(xs)
    return st.stdev(xs) / m if m > 0 else None

per = defaultdict(lambda: defaultdict(list))   # kind -> class -> [food CV]
singles = []
for f in foundation:
    c = cls(f)
    samples = [sample(s, f) for s in inputs[f]]
    if len(samples) < MIN_SAMPLES: continue
    singles += [acq[s] for s in inputs[f]]
    byk = defaultdict(list)
    for k in set().union(*samples):
        kind = {'protein': 'protein', 'sugars': 'sugars'}.get(k) or KIND.get(k)
        x = cv([s.get(k) for s in samples])
        if kind and x is not None: byk[kind].append(x)
    full = [s for s in samples if all(k in s for k in ('1051', 'protein', '1004', '1007'))]
    carbs = [max(0, 100 - s['1051'] - s['protein'] - s['1004'] - s['1007']) for s in full]
    if len(full) >= MIN_SAMPLES:
        if st.mean(carbs) <= 1: carbs = [0] * len(full)
        energy = [4 * s['protein'] + 9 * s['1004'] + 4 * c for s, c in zip(full, carbs)]
        for kind, xs in (('carbs', carbs), ('energy', energy)):
            x = cv(xs)
            if x is not None and (kind == 'energy' or st.mean(xs) > 1): byk[kind].append(x)
    for k, xs in byk.items():
        per[k]['all'].append(st.median(xs))
        if c: per[k][c].append(st.median(xs))

print('samples that are one purchase:', f'{sum(1 for a in singles if a <= 1) / len(singles):.0%}', 'of', len(singles))
CLASSES = ['produce', 'fruit', 'nuts', 'grains', 'meat', 'fish', 'eggs', 'dairy', 'fats', 'dishes', 'sweets',
           'beverages', 'seasonings', 'baby']
KINDS = ['water', 'protein', 'carbs', 'sugars', 'fibre', 'fat', 'energy', 'majorMinerals', 'minerals', 'trace',
         'bVitamins', 'folateCarotene', 'vitaminC', 'vitaminD', 'caffeine']
with open(out, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['kind', 'class', 'n_foods', 'cv_median', 'cv_p75'])
    for k in KINDS:
        xs = per[k]['all']
        if len(xs) < MIN_FOODS: print('no fit for', k, len(xs)); continue
        q = st.quantiles(xs, n=4)
        w.writerow([k, 'base', len(xs), f'{q[1]:.3f}', f'{q[2]:.3f}'])
        w.writerow([k, 'unknown', len(xs), f'{q[2]:.3f}', ''])
        print(f'{k:15s} base   n={len(xs):4d} med={q[1]:.3f} p75={q[2]:.3f}')
        for c in CLASSES:
            ys = per[k][c]
            if len(ys) < MIN_FOODS: continue
            w.writerow([k, c, len(ys), f'{st.median(ys):.3f}', ''])
            print(f'   {c:12s} n={len(ys):4d} med={st.median(ys):.3f}')
