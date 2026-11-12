"""Add the Spanish names (scripts/es/: ciqual.tsv, usda.tsv as "<code or fdcId><TAB>name", groups.json) to
app/public/ciqual.json and fdc.json (stdlib only). ciqual.py and fdc.py call it after writing their table; run it by
itself to update the tables in place: python3 scripts/es/merge.py

Each food gets its Spanish name as one more, last, column ("" if there's none), and the table a "groupsEs" beside
"groups". The names were machine-translated (Claude) into Argentine Spanish, checked by hand only in part; a food
added to a table later has no Spanish name until a line is added here.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, '..', '..', 'public')
# Table -> (its file, the names file, the groups key, the food row's length without the Spanish name).
TABLES = {'ciqual': ('ciqual.json', 'ciqual.tsv', 5), 'fdc': ('fdc.json', 'usda.tsv', 7)}


def names(file):
    out = {}
    with open(os.path.join(HERE, file), encoding='utf-8') as f:
        for line in f:
            if line.strip():
                code, name = line.rstrip('\n').split('\t')
                out[int(code)] = name
    return out


def merge(table):
    file, tsv, width = TABLES[table]
    path = os.path.join(PUBLIC, file)
    with open(path, encoding='utf-8') as f:
        t = json.load(f)
    es = names(tsv)
    with open(os.path.join(HERE, 'groups.json'), encoding='utf-8') as f:
        t['groupsEs'] = json.load(f)['ciqual' if table == 'ciqual' else 'usda']
    missing = 0
    for food in t['foods']:
        del food[width:]  # an earlier merge's
        food.append(es.get(food[0], ''))
        missing += food[0] not in es
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(t, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{table}: {len(t["foods"]) - missing} Spanish names, {missing} missing -> {os.path.normpath(path)}')


if __name__ == '__main__':
    merge('ciqual')
    merge('fdc')
