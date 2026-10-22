"""Render selected-food CVs as a markdown table. Usage: python3 -I md_table.py sr28_cv_selected_foods.csv"""
import csv, sys
cols = [('255','H2O'),('203','Prot'),('204','Fat'),('269','Sugars'),('209','Starch'),('291','Fibre'),
        ('401','VitC'),('321','bCar'),('417','Fol'),('404','B1'),('405','B2'),('323','VitE'),
        ('303','Fe'),('309','Zn'),('301','Ca'),('304','Mg'),('306','K'),('307','Na'),('317','Se')]
d = {}
order = []
for r in csv.DictReader(open(sys.argv[1])):
    if r['food'] not in d: d[r['food']] = {}; order.append(r['food'])
    n = r['n_data_pts']
    d[r['food']][r['nutr_no']] = (f"{float(r['cv']):.2f} ({n})" if r['cv'] else (f"– ({n})" if n not in ('0','') else '·'))
print('| Food | ' + ' | '.join(c[1] for c in cols) + ' |')
print('|' + '---|'*(len(cols)+1))
for f in order:
    print(f'| {f} | ' + ' | '.join(d[f].get(c, '') for c, _ in cols) + ' |')
