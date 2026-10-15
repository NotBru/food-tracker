"""Convert the ANSES-CIQUAL XML tables into app/public/ciqual.json (stdlib only).

Usage: python3 scripts/ciqual.py <dir with alim_*.xml, alim_grp_*.xml, compo_*.xml> [version]

Source: https://ciqual.anses.fr/ (download page) - Licence Ouverte / Etalab 2.0, credit "ANSES-CIQUAL".

Output (compact, values per 100 g):
  {source, licence, keys: [nutrient keys], groups: {code: name},
   foods: [[code, nameEn, nameFr, subgroupCode, values]]}
where values[i] belongs to keys[i] and is "" (not given), "text" (Δ from the digits) or ["text", delta].
"""
import glob
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter

# CIQUAL const_code -> app nutrient key (src/nutrients.js). Units already match.
CONST = {
    328: 'energy',  # kcal, EU Regulation 1169/2011
    25000: 'proteins',
    40000: 'fat',
    40302: 'saturatedFat',
    40303: 'monounsaturatedFat',
    40304: 'polyunsaturatedFat',
    75100: 'cholesterol',
    31000: 'carbohydrates',
    32000: 'sugars',
    34100: 'fibers',
    10110: 'sodium',
    10004: 'salt',
    10190: 'potassium',
    10170: 'chloride',
    10200: 'calcium',
    10150: 'phosphorus',
    10120: 'magnesium',
    10260: 'iron',
    10300: 'zinc',
    10290: 'copper',
    10251: 'manganese',
    10340: 'selenium',
    10530: 'iodine',
    51104: 'vitaminA',  # retinol activity equivalent
    56100: 'vitaminB1',
    56200: 'vitaminB2',
    56310: 'vitaminB3',
    56400: 'vitaminB5',
    56500: 'vitaminB6',
    56700: 'vitaminB9',
    56600: 'vitaminB12',
    55100: 'vitaminC',
    52100: 'vitaminD',
    53100: 'vitaminE',
    54101: 'vitaminK',  # K1 (K2 is rarely given)
    60000: 'alcohol',
    400: 'water',
}
KEYS = list(dict.fromkeys(CONST.values()))


def rows(path, tag):
    for el in ET.parse(path).getroot().iter(tag):
        yield {c.tag: (c.text or '').strip() for c in el}


def num(s):
    return s.replace(',', '.').strip()


def round_sig(x, digits=3):
    return float(f'{x:.{digits}g}')


def cell(teneur, lo, hi, trace_delta):
    """CIQUAL content -> "text" or ["text", delta], or None when not given."""
    t = teneur.strip()
    if t in ('', '-'):
        return None
    zero = ['0', trace_delta or 0]
    if t == 'traces':  # present below the quantification limit: 0 ± about that limit
        return zero
    m = re.fullmatch(r'<\s*([\d,.]+)', t)
    if m:  # below the limit of quantification: midpoint, ± half the limit
        half = round_sig(float(num(m[1])) / 2)
        return [f'{half:g}', half]
    text = num(t)
    try:
        v = float(text)
    except ValueError:
        return None
    if v == 0:  # a table zero is "none found", not "0 ± 1" as the digits rule would give
        return zero
    try:  # the min-max range of the sources, when given, is a better Δ than the digits
        delta = max(v - float(num(lo)), float(num(hi)) - v)
        if delta > 0:
            return [text, round_sig(delta)]
    except ValueError:
        pass
    return text


def main(src, version):
    one = lambda pat: glob.glob(os.path.join(src, pat))[0]
    groups = {}
    for g in rows(one('alim_grp_*.xml'), 'ALIM_GRP'):
        groups[g['alim_ssgrp_code']] = g['alim_ssgrp_nom_eng'] if g['alim_ssgrp_code'] != '000000' else g['alim_grp_nom_eng']
    foods = {}
    alim = next(p for p in glob.glob(os.path.join(src, 'alim_*.xml')) if 'alim_grp' not in p)
    for a in rows(alim, 'ALIM'):
        foods[a['alim_code']] = [int(a['alim_code']), a['alim_nom_eng'], a['alim_nom_fr'], a['alim_ssgrp_code'], [''] * len(KEYS)]
    compo = [c for c in rows(one('compo_*.xml'), 'COMPO') if int(c['const_code']) in CONST and c['alim_code'] in foods]
    # Most common "< x" limit per nutrient: the Δ for "traces" and zeros (half of it, like "< x" itself).
    seen = {}
    for c in compo:
        m = re.fullmatch(r'<\s*([\d,.]+)', c['teneur'].strip())
        if m:
            seen.setdefault(CONST[int(c['const_code'])], Counter())[float(num(m[1]))] += 1
    limits = {k: n.most_common(1)[0][0] for k, n in seen.items()}
    for c in compo:
        key = CONST[int(c['const_code'])]
        food = foods[c['alim_code']]
        v = cell(c['teneur'], c.get('min', ''), c.get('max', ''), round_sig(limits[key] / 2) if key in limits else None)
        if v is not None:
            food[4][KEYS.index(key)] = v
    out = {
        'source': f'ANSES-CIQUAL {version}',
        'licence': 'Licence Ouverte / Etalab 2.0',
        'keys': KEYS,
        'groups': groups,
        'foods': sorted(foods.values(), key=lambda f: f[1].lower()),
    }
    dest = os.path.join(os.path.dirname(__file__), '..', 'public', 'ciqual.json')
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(foods)} foods -> {os.path.normpath(dest)} ({os.path.getsize(dest) // 1024} KB)')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else '2025')
