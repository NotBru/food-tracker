"""Convert USDA FoodData Central's Foundation Foods and SR Legacy CSV downloads into app/public/fdc.json (stdlib only).

Usage: python3 scripts/fdc.py <Foundation Foods csv dir> <SR Legacy csv dir>

Source: https://fdc.nal.usda.gov/download-datasets - public domain (CC0 1.0), credit "USDA FoodData Central".

Output (compact, values per 100 g):
  {source, licence, datasets: {f: name, s: name}, keys: [nutrient keys], groups: {USDA category id: name},
   foods: [[fdcId, name, dataset, category, group, values, units]]}
where dataset is "f" (Foundation) or "s" (SR Legacy), category the CIQUAL subgroup the error model uses for it
(src/errors.js, "" for unknown), group the USDA category, values[i] the text of keys[i] ("" = not given), and units
[[amount, name, grams]] the household measures (1 cup = 244 g). A food in both datasets (same name) is kept once,
from Foundation.
"""
import csv
import json
import os
import re
import sys
from collections import Counter

# FDC nutrient id -> app nutrient key (src/nutrients.js), [factor to the app's unit]. Alternatives come later in a
# key's list and are used only when the earlier ones aren't given.
NUTRIENTS = {
    'energy': [1008, 2048, 2047],  # Energy; Foundation mostly gives only Atwater specific / general factors
    'proteins': [1003],
    'fat': [1004],
    'saturatedFat': [1258],
    'monounsaturatedFat': [1292],
    'polyunsaturatedFat': [1293],
    'transFat': [1257],
    'cholesterol': [1253],
    'sugars': [2000, 1063],  # Sugars, total; Foundation: Sugars, Total NLEA
    'addedSugars': [1235],
    'fibers': [1079],
    'sodium': [1093],
    'potassium': [1092],
    'chloride': [1088],
    'calcium': [1087],
    'phosphorus': [1091],
    'magnesium': [1090],
    'iron': [1089],
    'zinc': [1095],
    'copper': [1098],
    'manganese': [1101],
    'fluoride': [1099],  # µg in FDC (×0.001 below)
    'selenium': [1103],
    'chromium': [1096],
    'molybdenum': [1102],
    'iodine': [1100],
    'vitaminA': [1106],  # RAE
    'vitaminB1': [1165],
    'vitaminB2': [1166],
    'vitaminB3': [1167],
    'vitaminB5': [1170],
    'vitaminB6': [1175],
    'vitaminB7': [1176],
    'vitaminB9': [1177, 1190],  # folate, total (as CIQUAL); DFE only when total isn't given
    'vitaminB12': [1178],
    'vitaminC': [1162],
    'vitaminD': [1114],  # D2 + D3
    'vitaminE': [1109],  # alpha-tocopherol
    'vitaminK': [1185],  # K1 (phylloquinone), as CIQUAL
    'alcohol': [1018],
    'caffeine': [1057],
    'water': [1051],
}
FACTOR = {1099: 0.001}
CARBS_DIFF, CARBS_SUM = 1005, 1050  # by difference includes fibre; by summation (sugars + starch) doesn't
FIBRE = 1079
# Omega-3 as CIQUAL's: ALA + EPA + DHA, given only when all three are. SR Legacy mostly has 18:3 undifferentiated
# (1270), nearly all ALA outside a few fish and animal fats, when 18:3 n-3 c,c,c (1404) isn't given.
ALA, EPA, DHA = [1404, 1270], [1278], [1272]
KEYS = list(NUTRIENTS) + ['carbohydrates', 'salt', 'omega3']
IDS = {i for ids in [*NUTRIENTS.values(), ALA, EPA, DHA, [CARBS_DIFF, CARBS_SUM]] for i in ids}

# Household measures named like the app's built-in units, so "1 cup" of a liquid also gives its ml.
UNIT_NAMES = {'tablespoon': 'tbsp', 'teaspoon': 'tsp', 'cup': 'cup', 'tbsp': 'tbsp', 'tsp': 'tsp', 'fl oz': 'fl oz'}
MASS = re.compile(r'^(oz|lb|ounce|pound|g|gram|kg)\b', re.I)  # a mass is already a unit


def read(path):
    with open(path, newline='', encoding='utf-8') as f:
        yield from csv.DictReader(f)


def decimals(text):
    return len(text.split('.')[1]) if '.' in text else 0


def clean(amount):
    """FDC amount -> text without float noise ("1.0" -> "1", "0.250" -> "0.25")."""
    return f'{float(amount):.6f}'.rstrip('0').rstrip('.') or '0'


def fmt(x, d):
    return f'{max(x, 0):.{d}f}'


# USDA category (food_category id) -> CIQUAL subgroup, refined by name: SR's categories are coarser than CIQUAL's.
def has(name, *words):
    return any(re.search(rf'\b{w}', name) for w in words)


def category(group, name):
    n = name.lower()
    raw = has(n, 'raw') and not has(n, 'cooked', 'roasted', 'braised', 'broiled', 'grilled', 'fried', 'baked', 'stewed', 'boiled')
    if group == 1:  # Dairy and Egg Products
        if has(n, 'egg'):
            return '0410'
        if has(n, 'cheese'):
            return '0503'
        if has(n, 'butter') and not has(n, 'buttermilk'):
            return '0901'
        if has(n, 'cream') and not has(n, 'ice cream'):
            return '0504'
        if has(n, 'milk') and not has(n, 'yogurt', 'dessert', 'pudding'):
            return '0501'
        return '0502'
    if group == 2:  # Spices and Herbs
        return '1006' if has(n, 'fresh') else '1005'
    if group == 3:  # Baby Foods
        if has(n, 'formula', 'juice', 'beverage', 'milk'):
            return '1101'
        if has(n, 'cereal', 'cookie', 'biscuit', 'cracker', 'teething', 'pretzel'):
            return '1104'
        if has(n, 'dessert', 'pudding', 'fruit', 'apple', 'pear', 'peach', 'banana', 'custard'):
            return '1103'
        return '1102'
    if group == 4:  # Fats and Oils
        if has(n, 'fish oil'):
            return '0904'
        if has(n, 'margarine', 'spread'):
            return '0903'
        if has(n, 'butter'):
            return '0901'
        if has(n, 'salad dressing', 'mayonnaise', 'dressing', 'sandwich spread'):
            return '1001'
        if has(n, 'oil'):
            return '0902'
        return '0905'
    if group in (5, 10, 13, 17):  # Poultry, Pork, Beef, Lamb/Veal/Game
        return '0402' if raw else '0401'
    if group == 6:  # Soups, Sauces, and Gravies
        return '0102' if has(n, 'soup', 'broth', 'bouillon', 'stock', 'chowder') else '1001'
    if group == 7:  # Sausages and Luncheon Meats
        return '0403'
    if group == 8:  # Breakfast Cereals
        return '0707'
    if group == 9:  # Fruits and Fruit Juices
        return '0602' if has(n, 'juice', 'nectar', 'drink') else '0204'
    if group == 11:  # Vegetables
        return '0202' if has(n, 'potato', 'yam', 'cassava', 'taro') else '0201'
    if group == 12:  # Nut and Seed Products
        return '0205'
    if group == 14:  # Beverages
        if has(n, 'water') and not has(n, 'coconut', 'flavored', 'tonic'):
            return '0601'
        return '0603' if has(n, 'alcoholic', 'beer', 'wine', 'liqueur', 'whiskey', 'vodka', 'rum', 'gin') else '0602'
    if group == 28:  # Alcoholic Beverages
        return '0603'
    if group == 15:  # Finfish and Shellfish
        shell = has(n, 'crustacean', 'mollusk', 'shrimp', 'crab', 'lobster', 'clam', 'oyster', 'mussel', 'scallop',
                    'squid', 'octopus', 'crayfish', 'abalone', 'conch', 'cuttlefish', 'whelk')
        return ('0408' if raw else '0407') if shell else ('0406' if raw else '0405')
    if group == 16:  # Legumes
        return '0411' if has(n, 'meatless', 'veggie', 'burger', 'sausage', 'bacon') else '0203'
    if group == 18:  # Baked Products
        if has(n, 'cracker'):
            return '0303'
        if has(n, 'cookie', 'brownie'):
            return '0706'
        if has(n, 'cake', 'pie', 'pastr', 'danish', 'doughnut', 'croissant', 'strudel', 'eclair', 'cream puff', 'muffin'):
            return '0709'
        if has(n, 'dough', 'crust'):
            return '0305'
        return '0302'
    if group == 19:  # Sweets
        if has(n, 'chocolate', 'cocoa', 'fudge'):
            return '0702'
        if has(n, 'ice cream', 'frozen yogurt'):
            return '0801'
        if has(n, 'sherbet', 'sorbet', 'ice pop', 'ices'):
            return '0802'
        if has(n, 'jam', 'jelly', 'jellies', 'preserves', 'marmalade'):
            return '0704'
        if has(n, 'sugar', 'honey', 'syrup', 'molasses'):
            return '0701'
        return '0703'
    if group == 20:  # Cereal Grains and Pasta
        return '0304' if has(n, 'flour', 'meal', 'bran', 'germ') else '0301'
    if group in (21, 22, 25):  # Fast Foods, Meals/Entrees, Restaurant Foods
        if has(n, 'pizza'):
            return '0104'
        if has(n, 'sandwich', 'burger', 'hamburger', 'cheeseburger', 'sub', 'hot dog', 'wrap', 'taco', 'burrito'):
            return '0105'
        return '0103'
    if group == 23:  # Snacks
        return '0708' if has(n, 'bar') else '0303'
    return ''  # American Indian/Alaska Native, quality control materials, anything new


def load(src, data_type):
    foods = {r['fdc_id']: r for r in read(os.path.join(src, 'food.csv')) if r['data_type'] == data_type}
    values = {}  # fdc_id -> {nutrient id: text}
    for r in read(os.path.join(src, 'food_nutrient.csv')):
        n = int(r['nutrient_id'])
        if r['fdc_id'] in foods and n in IDS and r['amount'] != '':
            values.setdefault(r['fdc_id'], {})[n] = clean(r['amount'])
    units = {r['id']: r['name'] for r in read(os.path.join(src, 'measure_unit.csv'))}
    portions = {}
    for r in read(os.path.join(src, 'food_portion.csv')):
        if r['fdc_id'] not in foods or not r['gram_weight'] or float(r['gram_weight']) <= 0:
            continue
        unit = units.get(r['measure_unit_id'], 'undetermined')
        name = ' '.join(s for s in (unit if unit != 'undetermined' else '', r['modifier'], r['portion_description']) if s).strip()
        amount = clean(r['amount'] or '1')
        if re.match(rf'^{re.escape(amount)}\s', name):  # Foundation: portion_description "1 cup"
            name = name[len(amount):].strip()
        portions.setdefault(r['fdc_id'], []).append((amount, name, clean(r['gram_weight'])))
    return foods, values, portions


def unit_name(name):
    """"cup (8 fl oz)" -> "cup"; "tablespoon" -> "tbsp"; "cup, chopped" stays (not the volume cup's weight)."""
    bare = re.sub(r'\s*\([^)]*\)', '', name).strip()
    return UNIT_NAMES.get(bare.lower(), name)


def main(foundation_dir, sr_dir):
    release = lambda d: re.search(r'\d{4}-\d{2}(-\d{2})?', os.path.basename(os.path.normpath(d)))[0]
    datasets = {'f': f'Foundation Foods {release(foundation_dir)}', 's': f'SR Legacy {release(sr_dir)}'}
    groups = {int(r['id']): r['description'] for r in read(os.path.join(sr_dir, 'food_category.csv'))}
    loaded = {'f': load(foundation_dir, 'foundation_food'), 's': load(sr_dir, 'sr_legacy_food')}

    # Decimals FDC usually gives each nutrient: its CSVs drop trailing zeros ("3.5" for 3.50), so a value's text is
    # padded back to them, and a zero gets them too ("0.00" ± 0.01 rather than "0" ± 1, too loose for vitamins).
    usual = {}
    for _, values, _ in loaded.values():
        for vs in values.values():
            for n, t in vs.items():
                if float(t) != 0:
                    usual.setdefault(n, Counter())[decimals(t)] += 1
    usual = {n: c.most_common(1)[0][0] for n, c in usual.items()}

    def text(vs, n):
        t = vs[n]
        d = max(decimals(t), usual.get(n, 0))
        return fmt(float(t) * FACTOR.get(n, 1), d + (3 if n in FACTOR else 0))

    def first(vs, ids):
        return next((n for n in ids if n in vs), None)

    out, names = [], set()
    for ds in ('f', 's'):
        foods, values, portions = loaded[ds]
        for fid, food in foods.items():
            name = food['description'].strip()
            if name.lower() in names:
                continue
            names.add(name.lower())
            vs = values.get(fid, {})
            row = {}
            for key, ids in NUTRIENTS.items():
                n = first(vs, ids)
                if n is not None:
                    row[key] = text(vs, n)
            # The app's carbohydrates exclude fibre (EU labels, CIQUAL); FDC's "by difference" includes it.
            if CARBS_DIFF in vs and FIBRE in vs:
                carbs, fibre = text(vs, CARBS_DIFF), text(vs, FIBRE)
                row['carbohydrates'] = fmt(float(carbs) - float(fibre), max(decimals(carbs), decimals(fibre)))
            elif CARBS_SUM in vs:
                row['carbohydrates'] = text(vs, CARBS_SUM)
            elif CARBS_DIFF in vs:
                row['carbohydrates'] = text(vs, CARBS_DIFF)  # fibre not given: may include some
            if 'sodium' in row:  # salt = sodium × 2.5, as on EU labels and in CIQUAL
                row['salt'] = fmt(float(row['sodium']) * 2.5 / 1000, decimals(row['sodium']) + 3)
            n3 = [first(vs, ids) for ids in (ALA, EPA, DHA)]
            if None not in n3:
                parts = [text(vs, n) for n in n3]
                row['omega3'] = fmt(sum(map(float, parts)), max(map(decimals, parts)))
            seen, measures = set(), []
            for amount, label, grams in portions.get(fid, []):
                u = unit_name(label)
                if not u or MASS.match(u) or u.lower() in seen:
                    continue
                seen.add(u.lower())
                measures.append([amount, u, grams])
            group = int(food['food_category_id'] or 0)
            out.append([int(fid), name, ds, category(group, name), group, [row.get(k, '') for k in KEYS], measures])
    out.sort(key=lambda f: f[1].lower())
    result = {
        'source': 'USDA FoodData Central',
        'licence': 'CC0 1.0 (public domain)',
        'datasets': datasets,
        'keys': KEYS,
        'groups': {g: d for g, d in groups.items()},
        'foods': out,
    }
    dest = os.path.join(os.path.dirname(__file__), '..', 'public', 'fdc.json')
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))
    by = Counter(f[2] for f in out)
    print(f'{len(out)} foods ({by["f"]} Foundation, {by["s"]} SR Legacy) -> {os.path.normpath(dest)} '
          f'({os.path.getsize(dest) // 1024} KB)')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
