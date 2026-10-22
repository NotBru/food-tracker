# Sample-to-sample nutrient variability within single foods, measured from USDA SR28 / SR Legacy

**Data and method.** I downloaded both USDA releases on 2026-10-22:

- **FoodData Central "SR Legacy" CSV (April 2018).** Zip 6.1 MB, unpacked 38 MB. — [FDC download](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip)
- **The equivalent SR28 ASCII release.** Zip 6.2 MB, unpacked 48 MB; `NUT_DATA.txt` alone is 40 MB with 679,045 rows covering 8,789 foods. — [SR28 ASCII](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip)
- **The SR28 documentation PDF** (0.65 MB). — [SR28 doc](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/sr28_doc.pdf)

The raw files are in `data/raw/`, with a `.gitignore` so they are not committed.

**The FDC SR Legacy CSV has no standard-error column.** Its `food_nutrient.csv` header is `amount, data_points, derivation_id, min, max, median, footnote, min_year_acquired`. For that reason every CV below comes from the SR28 ASCII `NUT_DATA` file, which carries `Std_Error`, `Num_Studies`, `DF`, `Low_EB`/`Up_EB` and `Stat_cmt`. For banana I checked that the FDC CSV gives the same mean, n, min and max as SR28.

**Formula.** CV = SE·√n / mean, where n is `Num_Data_Pts`.

**Scripts** are in `data/scripts/` and were run with `python3 -I`, with data paths passed as arguments:

- `sr28_cv.py` computes the selected-food table, the per-nutrient distributions and the paired macro-vs-micro comparison.
- `sr28_cv_extra.py` runs the range-consistency check, the food-group split and the banana detail table.
- `sr28_paired_variants.py` runs the macro-vs-micro comparison under several filters.
- `md_table.py` renders the table below; `pdf_text.py` is a standard-library PDF text extractor used on the documentation.

**Output CSVs** are in `data/`:

- `sr28_cv_selected_foods.csv`
- `sr28_cv_by_nutrient.csv`
- `sr28_cv_by_nutrient_group.csv`
- `sr28_cv_macro_vs_micro_paired.csv`
- `sr28_cv_paired_variants.csv`
- `sr28_banana_detail.csv`

## Q1. CVs for common whole foods (SR28 per-nutrient n, SE, min, max)

### Takeaway
In most of these foods, water, protein, and fat in fatty foods have CVs of about 1–10%. Most minerals fall in the 5–30% range. Vitamins and carotenoids (thiamin, riboflavin, folate, vitamin E, β-carotene, selenium) commonly have CVs of 20–100% or more. There are many exceptions, though. Trace-level macronutrients are very variable: fat in fruit and vegetables has a CV of 0.4–0.9. Many CVs implied by the SEs also contradict the published min–max ranges, so treat any single food's CV as rough, ±2× at best.

### Cited Findings
In the table below, each cell is CV (n = `Num_Data_Pts`). A cell reading "– (n)" means n is at least 1 but no SE is published. A cell reading "·" means n = 0: the value was calculated or imputed, not analysed. A blank cell means the nutrient is not in the file. The source for every number is my computation from SR28 `NUT_DATA` ([SR28 ASCII](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip)); full values, means, SE, min and max are in `data/sr28_cv_selected_foods.csv`.

| Food | H2O | Prot | Fat | Sugars | Starch | Fibre | VitC | bCar | Fol | B1 | B2 | VitE | Fe | Zn | Ca | Mg | K | Na | Se |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Banana | 0.02 (20) | 0.07 (12) | 0.89 (19) | 0.24 (8) | 0.30 (8) | 0.18 (13) | 0.14 (8) | 0.26 (10) | 0.08 (11) | 0.67 (12) | 0.38 (12) | 2.09 (15) | 0.03 (42) | 0.04 (45) | 0.06 (45) | 0.12 (45) | 0.04 (45) | 2.65 (45) | 1.61 (31) |
| Apple, with skin | 0.02 (38) | 0.39 (29) | 0.38 (35) | 0.05 (25) | 0.00 (10) | 0.62 (29) | 0.18 (3) | 0.23 (14) | 0.98 (23) | 0.56 (23) | 0.69 (20) | – (10) | 0.30 (16) | 0.51 (26) | 0.29 (26) | 0.07 (26) | 0.10 (26) | 0.17 (6) | – (7) |
| Orange | 0.01 (88) | 0.12 (69) | 0.17 (4) | · |  | · | 0.16 (145) | 2.33 (55) | 0.33 (154) | 0.14 (148) | · | 0.37 (4) | 0.32 (64) | – (3) | · | 0.25 (212) | 0.10 (180) | – (72) | 0.94 (5) |
| Potato, flesh+skin | 0.02 (11) | 0.08 (11) | 0.44 (11) | – (5) | 0.33 (11) | – (5) | 0.46 (141) | 1.87 (11) | 0.67 (11) | 0.25 (11) | 1.35 (11) | – (2) | 0.22 (11) | 0.03 (11) | 0.42 (11) | 0.09 (11) | 0.11 (11) | 1.08 (73) | – (2) |
| Tomato, red, year-round | 0.01 (39) | 0.19 (19) | 0.87 (26) | · | – (4) | 0.44 (5) | 0.31 (25) | 0.05 (70) | 0.65 (19) | 0.47 (19) | 0.23 (19) | 0.52 (16) | 0.47 (70) | 1.77 (70) | 0.24 (69) | 0.15 (70) | 0.18 (67) | 0.92 (66) | – (36) |
| Carrot | 0.03 (33) | 0.04 (19) | 0.38 (26) | · | – (2) | – (4) | 0.88 (21) | 1.83 (197) | 1.19 (19) | 0.76 (21) | 0.98 (19) | 1.35 (11) | 0.40 (75) | 0.40 (76) | 0.29 (75) | 0.27 (75) | 0.23 (76) | 0.44 (81) | 2.37 (39) |
| Broccoli | 0.08 (49) | 0.74 (23) | 0.06 (29) | · | – (1) | 0.36 (13) | 0.19 (19) | 0.22 (124) | 1.05 (27) | 0.68 (23) | 0.82 (23) | 0.44 (12) | 0.75 (33) | 0.15 (33) | 0.63 (33) | 0.58 (33) | 0.14 (37) | 1.03 (42) | 0.12 (8) |
| Spinach | – (1) | 0.12 (9) | 0.22 (7) | · |  | – (1) | 0.39 (7) | 0.30 (5) | 0.45 (6) | 0.31 (9) | 0.13 (9) | 0.20 (7) | 0.61 (10) | 0.20 (7) | 0.15 (9) | 0.16 (7) | 0.16 (10) | 0.43 (10) | 0.75 (5) |
| White rice, long-grain, unenriched | 0.22 (58) | 0.16 (70) | 0.39 (23) | · |  | · | · | · | 0.27 (5) | – (1) | 0.98 (19) | · | – (1) | 0.23 (13) | 0.51 (22) | 0.26 (13) | 0.37 (17) | 0.67 (10) | 0.91 (7) |
| Wheat flour, white, enriched | 0.13 (72) | 0.10 (61) | 0.21 (29) | – (3) |  | · | · | – (1) | 0.10 (9) | 0.12 (36) | 0.18 (32) | 0.40 (9) | 0.08 (23) | 0.33 (136) | 0.26 (113) | 0.30 (129) | 0.24 (94) | 1.02 (82) | 0.64 (46) |
| Wheat flour, whole-grain | 0.33 (6) | 0.15 (3) | 0.06 (3) | 0.13 (3) | 0.03 (3) | 0.07 (7) | · | – (1) | 0.25 (7) | 0.06 (3) | 0.02 (3) | 0.12 (3) | 0.07 (3) | 0.00 (3) | 0.06 (3) | 0.11 (3) | 0.06 (3) | 0.05 (3) | 0.42 (6) |
| Oats, regular/quick, dry | 0.06 (4) | 0.01 (4) | 0.06 (4) | 0.04 (4) | 0.01 (4) | 0.09 (4) | – (4) | – (1) | 0.53 (24) | 0.15 (4) | 0.75 (4) | 0.18 (4) | 0.03 (4) | 0.05 (4) | 0.10 (33) | 0.03 (4) | 0.02 (4) | 0.14 (4) | 0.12 (4) |
| Black beans, dry | 0.18 (40) | 0.08 (36) | 0.16 (12) | · |  | · | · | · | 0.22 (8) | 0.09 (26) | 0.18 (26) | · | 0.60 (28) | 0.51 (27) | 0.31 (11) | 0.08 (26) | – (9) | 0.25 (4) | · |
| Kidney beans, dry | 0.14 (58) | 0.08 (61) | 0.44 (65) | · |  | · | – (1) | · | 0.19 (32) | 0.52 (48) | 0.26 (48) | · | 0.26 (51) | 0.16 (51) | 0.42 (50) | 0.23 (49) | 0.13 (51) | 1.19 (44) | · |
| Pinto beans, dry | 0.12 (20) | 0.05 (8) | 0.14 (20) | · | 0.06 (4) | 0.02 (4) | – (2) | – (2) | 0.15 (12) | 0.16 (20) | 0.38 (20) | · | 0.18 (16) | 0.14 (16) | 0.08 (16) | 0.04 (16) | 0.03 (16) | 0.30 (12) | – (2) |
| Egg, whole, raw | 0.01 (12) | 0.03 (12) | 0.04 (12) | 0.05 (6) |  | – (1) | – (2) | – (6) | 0.51 (23) | 0.18 (6) | 0.11 (6) | 0.27 (6) | 0.06 (6) | 0.03 (6) | 0.03 (6) | 0.05 (6) | 0.03 (6) | 0.02 (6) | 0.17 (6) |
| Milk, whole, no added vit A/D | 0.00 (28) | 0.05 (27) | 0.04 (27) | · |  | · | – (7) | 0.28 (10) | 0.30 (8) | 0.11 (24) | 0.03 (23) | 0.21 (24) | 0.45 (46) | 0.12 (42) | 0.06 (16) | 0.07 (42) | 0.10 (41) | 0.08 (42) | 0.27 (29) |
| Milk, whole, vit D added | 0.00 (28) | 0.05 (27) | · | · |  | · | – (7) | 0.28 (10) | 0.30 (8) | 0.11 (24) | 0.03 (23) | 0.21 (24) | 0.45 (46) | 0.12 (42) | 0.06 (16) | 0.07 (42) | 0.10 (41) | 0.08 (42) | 0.27 (29) |
| Cheddar | 0.03 (39) | 0.04 (39) | 0.03 (39) | · |  | · | · | · | – (4) | 0.00 (28) | 0.17 (27) | 0.01 (13) | 0.27 (39) | 0.07 (39) | 0.08 (39) | 0.07 (39) | 0.14 (39) | 0.13 (39) | 0.20 (29) |
| Beef, ground 80/20 | 0.02 (107) | 0.09 (72) | – (72) | · |  | · | · | · | 0.32 (6) | 0.28 (36) | 0.40 (36) | 0.18 (19) | 0.15 (36) | 0.09 (36) | 0.68 (36) | 0.08 (36) | 0.07 (36) | 0.10 (36) | 0.50 (72) |
| Beef, top sirloin lean, select | 0.01 (10) | 0.03 (10) | 0.21 (10) | · |  | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Beef, T-bone lean, choice | 0.02 (24) | 0.08 (24) | 0.31 (24) | · |  | · | · | · | · | · | 0.14 (4) | · | – (2) | – (2) | – (2) | – (2) | – (2) | – (2) | – (2) |
| Beef, chuck under blade lean, choice | 0.05 (24) | 0.06 (24) | 0.25 (24) | · |  | · | · | · | · | – (1) | 0.03 (4) | 0.34 (4) | 0.06 (4) | 0.02 (4) | 0.04 (4) | 0.06 (4) | 0.05 (4) | 0.02 (4) | 0.12 (4) |
| Pork tenderloin, lean | 0.02 (12) | 0.09 (12) | 0.21 (12) | · |  | · | · | · | – (1) | 0.32 (12) | 0.27 (12) | – (1) | 0.11 (12) | 0.15 (12) | 0.14 (12) | 0.12 (12) | 0.14 (12) | 0.40 (12) | 0.42 (12) |
| Pork loin chop, lean | 0.02 (12) | 0.09 (12) | 0.24 (12) | · |  | · | · | · | · | · | · | · | 0.09 (12) | 0.08 (12) | 0.37 (12) | 0.06 (12) | 0.07 (12) | 0.08 (12) | 0.44 (12) |
| Chicken breast, meat only | 0.01 (6) | 0.03 (6) | 0.21 (6) | · |  | · | · | · | · | 0.20 (3) | 0.12 (3) | – (2) | 0.09 (6) | 0.11 (6) | 0.17 (6) | 0.04 (6) | 0.03 (6) | 0.13 (6) | 0.26 (3) |
| Chicken breast, meat+skin | 0.02 (29) | 0.04 (29) | 0.14 (29) | · |  | · | · | · | 0.40 (4) | 0.25 (16) | 0.19 (16) | · | 0.20 (24) | 0.10 (24) | 0.22 (24) | 0.07 (24) | 0.12 (24) | 0.13 (24) | · |
| Salmon, Atlantic, farmed | 0.02 (4) | 0.04 (4) | 0.19 (4) | · |  | · | – (2) | · | – (1) | 0.16 (4) | 0.12 (4) | 0.15 (4) | 0.11 (4) | 0.06 (4) | 0.16 (4) | 0.03 (4) | 0.03 (4) | 0.38 (4) | 0.10 (4) |
| Salmon, Atlantic, wild | 0.08 (21) | 0.10 (9) | 0.74 (7) |  |  | · | · |  | – (1) | 0.56 (11) | 0.95 (6) |  | – (1) | – (1) | 0.59 (3) | – (1) | 0.11 (3) | – (2) | · |
| Salmon, sockeye | – (22) | – (22) | – (22) | – (1) | – (1) | · | – (1) | · | – (19) | – (19) | – (19) | – (19) | – (22) | – (22) | – (22) | – (22) | – (22) | – (22) | – (19) |
| Salmon, coho, wild | 0.03 (178) | 0.03 (178) | 0.40 (219) | · |  | · | 0.48 (4) | · | 0.62 (3) | 0.46 (3) | 0.15 (3) | · | 0.24 (3) | 0.36 (74) | – (1) | 0.05 (3) | 0.04 (47) | 0.17 (47) | · |
| Almonds | 0.47 (90) | 0.05 (91) | 0.05 (90) | · | 0.28 (4) | 0.22 (89) | – (49) | 3.45 (26) | 0.94 (41) | 0.41 (85) | 0.95 (88) | 0.11 (90) | 0.35 (89) | 0.18 (86) | 0.27 (89) | 0.05 (88) | 0.21 (88) | 4.31 (85) | 3.04 (26) |
| Brazil nuts | 0.24 (10) | 0.03 (7) | 0.03 (11) | 0.09 (7) | 0.00 (7) | 0.05 (3) | 0.00 (3) | – (1) | 0.21 (4) | 0.23 (7) | 0.08 (7) | 0.58 (9) | 0.03 (7) | 0.03 (7) | 0.09 (7) | 0.03 (7) | 0.04 (7) | 0.22 (7) | 0.47 (15) |

Column key: H2O = water; Prot = protein; Fat = total fat; Sugars = total sugars; Fibre = total dietary fibre; VitC = vitamin C; bCar = β-carotene; Fol = total folate; B1 = thiamin; B2 = riboflavin; VitE = α-tocopherol. Carbohydrate by difference (205), energy (208) and vitamin A RAE (320) are left out of the table because they have n = 0 in essentially every food: they are computed (`Deriv_Cd` NC/NP) and carry no SE. The one exception is apple, whose RAE has n = 14 and CV 0.19. — [SR28 ASCII](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip)

**Notable individual values** (all from my SR28 computation):

- **Orange.** Vitamin C is 53.2 mg/100 g with n = 145 and CV 0.16. Folate has n = 154 and CV 0.33; magnesium has n = 212 and CV 0.25.
- **Brazil nuts.** Selenium is 1917 µg/100 g with n = 15, CV 0.47 and a range of 136–2740 µg, a 20-fold spread. Protein and fat in Brazil nuts have CVs of only 0.03.
- **Carrot.** β-carotene is 8285 µg with n = 197, CV 1.83 and a range of 1990–21000 µg.
- **Almonds.** Vitamin E is 25.6 mg with n = 90 and CV 0.11. Riboflavin has CV 0.95 (range 0.46–2.26 mg) and folate has CV 0.94 (range 10–107 µg). Fat has CV 0.05.
- **Egg (n = 6–12).** Every macro has a CV of 0.06 or less. Minerals are at 0.02–0.06, and selenium and vitamin E are at 0.17–0.27.
- **Cheddar (n = 39).** Water, protein and fat are each at 0.03–0.04, and calcium is at 0.08.
- **Beef top sirloin (lean, select).** The proximates are analysed (n = 10), but every micronutrient has n = 0, meaning it was imputed or calculated.
- **Beef T-bone.** Most minerals have n = 2, so no SE is published.
- **Sockeye salmon.** n = 19–22 and min/max are given, but no SE is published for any nutrient.
- **Farmed Atlantic salmon** rests on n = 4. Fat has CV 0.19 and protein 0.035.
- **Wild Atlantic salmon.** Fat has n = 7 and CV 0.74.

**Implausible SEs.** Some published SEs imply SDs that cannot be reconciled with the published ranges:

- **Broccoli protein.** CV 0.74 would mean an SD of about 2.1 g, but the range is only 1.99–3.15 g.
- **Banana iron.** CV 0.025 would mean an SD of about 0.007 mg, yet the range is 0.19–0.41 mg.
- **Cheddar thiamin.** CV 0.000 with a range of 0.027–0.029 mg.

See Q2 for why this happens.

### Inferences
- **Energy macronutrients are mostly tightly measured.** For the macronutrient that dominates a food's energy, CVs are mostly small:
  - Starch in grains is about 0.01–0.03.
  - Fat in nuts, cheese and egg is 0.03–0.05.
  - Protein in meats and dairy is 0.03–0.09.
  - Sugars in apple are 0.05.

  The main exceptions are banana sugars (0.24) and starch (0.30), which change with ripeness, potato starch (0.33), and fat in meat and fish (0.14–0.74). Fat variation in meat and fish reflects trim and marbling, and wild versus farmed or seasonal fattening for fish.
- **High macro CVs are mostly trace components.** Fat and protein in fruit sit at a few tenths of a gram per 100 g, so they matter little for energy.
- **There is no CV for total carbohydrate.** It is computed by difference, so SR28 gives no CV for it. Its uncertainty can only be inferred from the CVs of water, protein, fat and ash, or from the sugar and starch components where these were analysed.

### Gaps
- **Some requested foods have no CV for key nutrients.** Most beef retail cuts have imputed micronutrients. For beef, pork and salmon, micronutrient CVs exist only for some entries.
- **White rice and the beans have no min/max.** Their records are older (pre-SR14) and lack the min/max fields, so their CVs cannot be cross-checked against a range.

## Q2. Database-wide median CV per nutrient: ranking and the macro vs micro ordering

### Takeaway
Across all SR28 foods with n ≥ 5, the median CV ranks roughly as follows:

| Median CV | Nutrients |
|---|---|
| ≈ 0.03 | water |
| ≈ 0.07 | starch, protein |
| ≈ 0.10 | magnesium, phosphorus |
| ≈ 0.12 | sugars, potassium |
| ≈ 0.15 | zinc, sodium |
| ≈ 0.16 | fibre, B6 |
| ≈ 0.17 | niacin |
| ≈ 0.20 | iron, calcium, **total fat**, vitamin E, copper |
| ≈ 0.21 | thiamin |
| ≈ 0.23 | folate |
| ≈ 0.27 | β-carotene |
| ≈ 0.32 | selenium, vitamin A RAE |
| ≈ 0.34 | vitamin C |

Within the same food, the median micronutrient CV is higher than the median macronutrient CV in 83% of foods; the median ratio is 1.9×. **Much of that "macro < micro" gap comes from water, whose CV is structurally small.** With water excluded, the ratio drops to 1.2× overall. It is about 1.0× in fruit and vegetables and in meat and fish, and stays at 1.6–1.9× in legumes, nuts, grains and dairy. So the ordering is a tendency, not a clean separation.

### Cited Findings (all computed from [SR28 NUT_DATA](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip); tables in `data/sr28_cv_by_nutrient*.csv`)

**Coverage of the file:**

| Count | Rows |
|---|---|
| 679,045 | all nutrient rows |
| 463,089 | rows with n = 0 (calculated or imputed; 68%) |
| 215,956 | rows with n ≥ 1 |
| 111,929 | rows with an SE |
| 12,631 | rows with n ≥ 3 but no SE published |

**Median CV per nutrient**, for foods with n ≥ 5 (foods counted / P25 / median / P75):

| Nutrient | Foods | P25 | Median | P75 |
|---|---|---|---|---|
| Water | 2750 | 0.017 | 0.033 | 0.067 |
| Starch | 224 | 0.030 | 0.066 | 0.123 |
| Protein | 2637 | 0.043 | 0.072 | 0.127 |
| Magnesium | 1709 | – | 0.095 | – |
| Phosphorus | 1725 | – | 0.101 | – |
| Total sugars | 343 | 0.054 | 0.118 | 0.307 |
| Potassium | 1871 | – | 0.118 | – |
| Ash | 2638 | – | 0.119 | – |
| Zinc | 1748 | – | 0.148 | – |
| Sodium | 1607 | 0.077 | 0.155 | 0.361 |
| Fibre | 344 | 0.100 | 0.160 | 0.244 |
| Vitamin B6 | 950 | – | 0.161 | – |
| Niacin | 1395 | – | 0.169 | – |
| Manganese | – | – | 0.171 | – |
| Riboflavin | 1427 | – | 0.182 | – |
| Iron | 1922 | 0.112 | 0.198 | 0.348 |
| Calcium | 1911 | – | 0.198 | – |
| Total fat | 2611 | 0.095 | 0.201 | 0.360 |
| Vitamin E | 306 | – | 0.202 | – |
| Copper | 1694 | – | 0.208 | – |
| Vitamin B12 | – | – | 0.212 | – |
| Thiamin | 1347 | 0.122 | 0.213 | 0.356 |
| Folate (total) | 557 | 0.147 | 0.231 | 0.457 |
| β-carotene | 158 | 0.123 | 0.269 | 0.764 |
| Vitamin K1 | – | – | 0.307 | – |
| Selenium | 719 | 0.170 | 0.318 | 0.544 |
| Vitamin A RAE | 115 | – | 0.320 | – |
| Vitamin C | 591 | 0.190 | 0.340 | 0.585 |
| α-carotene | 66 | – | 1.14 | – |

A dash means the figure was not extracted for these notes. The share of foods with CV > 0.5 is 0.8% for water and 1.6% for protein, against 30% for vitamin C, 32% for β-carotene and 28% for selenium.

**Robustness to the n threshold.** Using n ≥ 3 or n ≥ 10 barely changes the medians: water is 0.031 at n ≥ 3 and 0.037 at n ≥ 10 (`sr28_cv_by_nutrient.csv`). Restricting to single-study, analytical-source records gives almost the same ranking: protein 0.068, fat 0.197, iron 0.186, vitamin C 0.340, selenium 0.262.

**The ranking varies by food group** (`sr28_cv_by_nutrient_group.csv`):

- **Fruit and vegetables.** Water 0.017; sugars 0.105; protein 0.154; fibre 0.166; **fat 0.409**; potassium 0.159; vitamin C 0.335; iron 0.348; sodium 0.455; selenium 0.86.
- **Meat, poultry and fish.** Water 0.033; protein 0.059; **fat 0.247**; potassium 0.090; zinc 0.122; iron 0.151; thiamin 0.233; selenium 0.241.
- **Legumes, nuts and grains.** Starch 0.054; protein 0.077; fat 0.173; magnesium 0.137; iron 0.211; selenium 0.426.
- **Dairy and egg.** Water 0.027; protein 0.049; fat 0.076; calcium 0.104; riboflavin 0.155; folate 0.430.

**Paired within-food comparison** (n ≥ 5; at least 3 of these micronutrients per food: vitamin C, β-carotene, folate, thiamin, riboflavin, vitamin E, Fe, Zn, Ca, Mg, K, Na, Se; `sr28_cv_paired_variants.csv`). The two CV columns are the medians, across foods, of each food's own median CV.

| Comparison | Foods | Macro CV | Micro CV | Ratio | Micro > macro |
|---|---|---|---|---|---|
| Macros incl. water, all foods | 1932 | 0.079 | 0.167 | 1.89 | 83% |
| Macros excl. water, all foods | 1879 | 0.131 | 0.165 | 1.23 | 62% |
| Excl. water: fruit and vegetables | 394 | 0.247 | 0.255 | 0.98 | 49% |
| Excl. water: meat and fish | 405 | 0.143 | 0.148 | 1.05 | 52% |
| Excl. water: legumes, nuts, grains | 224 | 0.137 | 0.218 | 1.58 | 74% |
| Excl. water: dairy and egg | 98 | 0.066 | 0.122 | 1.90 | 80% |
| Excl. water, range-consistent records only | 874 | 0.092 | 0.107 | 1.20 | 61% |

**Many SEs fail a consistency check against their min–max range.** No data set can have an SD larger than half its range times √(n/(n−1)). Of 34,022 records with n ≥ 5, an SE and a min/max, 3,156 (9.3%) imply an SD above that bound, even with a 5% tolerance. The rate is 25% for multi-study records (1,715 of 6,905) and about 5% for single-study records. In the consistent-only subset, the median CVs drop by roughly a third for minerals: iron 0.135, calcium 0.133, potassium 0.081, fat 0.119, protein 0.057. The ranking is broadly unchanged.

**Medians of relative range** ((max − min)/mean, all foods, n ≥ 5) give the same ordering: water 0.08, protein 0.18, starch 0.21, magnesium 0.24, fat 0.41, iron 0.46, folate 0.68, selenium 0.89, β-carotene 0.96, vitamin C 1.00.

### Inferences
- **Energy-bearing components in ample amounts have low CVs.** Starch in grains, protein in animal foods, fat in nuts and dairy, and sugars in most fruit typically have CVs of 0.03–0.12.
- **Many micronutrients are 2–5× more variable.** Vitamin C, folate, β-carotene, selenium and the B vitamins typically have CVs of 0.2–0.35, with long right tails. Selenium in plant foods tracks soil, and carotenoids track cultivar and ripeness.
- **Some minerals are as stable as protein.** Magnesium, phosphorus and potassium have CVs of 0.08–0.12.
- **Total fat is the main macro exception.** It is as variable as iron or calcium (median CV about 0.2), because it varies in meat and fish and is present only in traces in plant foods.
- **What this means for macro vs micro.** Macronutrient uncertainty is not negligible, especially fat in meat and sugars and starch in ripening fruit. On average, though, it is about half that of micronutrients when water is counted, and about 0.8× when water is excluded.
- **Why macro medians land around 0.07–0.20.** The values are shaped by trace-level components, where small absolute differences give large CVs. Weighting by contribution to energy would lower the macro medians further. I did not compute an energy-weighted version.

### Gaps
- **No CV for total carbohydrate or energy.** Both are calculated (n = 0) in essentially every food: only 3 foods have an SE for carbohydrate and 2 for energy. Their variability cannot be read from SR28.
- **No direct test of compositing.** I could not separate composite-based SEs from individual-sample SEs record by record, because SR28 has no field marking composites. See Q4.

## Q3. Banana (NDB 09040, "Bananas, raw"): ranges and sample counts for carbohydrate, sugars, starch and water

### Takeaway
Banana sugars and starch rest on only 8 analyses from 2 studies. They vary about 2–3-fold: sugars run from 7.51 to 16.21 g/100 g (CV ≈ 0.24), and starch from 3.00 to 9.39 g (CV ≈ 0.30). Water is tight at 71.3–78.2 g (n = 20, CV ≈ 0.017). Carbohydrate by difference (22.84 g) and energy (89 kcal) are calculated, with n = 0 and no SE, min or max.

### Cited Findings
Source for all rows: SR28 `NUT_DATA`, my extraction in `data/sr28_banana_detail.csv` ([SR28 ASCII](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip)). The FDC CSV gives the same mean, n, min and max ([FDC CSV](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip)). All values are per 100 g and were last modified in 12/2002. The 95% error bounds are the published `Low_EB`/`Up_EB`.

| Nutrient | Mean | n | Studies | SE | Min–max | CV (SE√n) | 95% error bounds (DF) |
|---|---|---|---|---|---|---|---|
| Water | 74.91 g | 20 | 6 | 0.286 | 71.30–78.20 | 0.017 | 73.8–76.0 (DF 2) |
| Total sugars | 12.23 g | 8 | 2 | 1.034 | 7.51–16.21 | 0.239 | 9.10–15.36 (DF 3) |
| Glucose | 4.98 g | 8 | 2 | 0.806 | 1.79–8.13 | 0.46 | – |
| Fructose | 4.85 g | 8 | 2 | 0.658 | 2.34–7.52 | 0.38 | – |
| Sucrose | 2.39 g | 8 | 2 | 0.546 | 0.45–4.12 | 0.65 | – |
| Starch | 5.38 g | 8 | 2 | 0.564 | 3.00–9.39 | 0.297 | 3.89–6.87 (DF 5) |
| Fibre, total dietary | 2.6 g | 13 | 5 | 0.129 | 1.7–3.7 | 0.18 | – |
| Protein | 1.09 g | 12 | 3 | 0.022 | 0.75–1.31 | 0.07 | 0.81–1.38 (DF 1) |
| Fat | 0.33 g | 19 | 5 | – | 0.07–0.70 | 0.89 | – |
| Carbohydrate, by difference | 22.84 g | 0 | – | – | – | – | calculated (Src 4, Deriv NC, 04/2006) |
| Energy | 89 kcal | 0 | – | – | – | – | calculated (Src 4, Deriv NC, 04/2006) |
| Potassium | 358 mg | 45 | 14 | – | 308–426 | 0.04 | – |
| Vitamin C | 8.7 mg | 8 | 2 | – | 8.0–9.5 | 0.14 | – |

### Inferences
- **Sugar and starch roughly trade off.** Sugars plus starch span about 10.5–25.6 g if the extremes are combined, but extremes probably co-occur in opposite directions: ripe fruit is high in sugar and low in starch. Their sum, plus fibre, is consistent with the 22.8 g carbohydrate-by-difference figure. The sugar/starch spread is most plausibly ripeness stage, though SR28 does not record ripeness.
- **The protein CV of 0.07 is understated.** It conflicts with a range of 0.75–1.31. With 3 studies and DF = 1, the SE comes from the between-study "generic mean" procedure (see Q4), and SE·√n understates the point-to-point SD here.
- **With n = 8 from 2 studies, banana sugar and starch CVs are themselves very uncertain.** The DF of 3–5 means the 95% bound on the mean is about ±25% for sugars.

### Gaps
- **The two underlying banana studies are not identified here.** They are in `DATSRCLN`/`DATA_SRC`, which I did not trace, so cultivar, ripeness and origin were not checked.

## Q4. How USDA produced these statistics, and the caveats that make SE and CV non-comparable

### Takeaway
In SR, "n" counts analyses, which may each be a composite of several sample units. The SE is the SE of a (possibly study-weighted) mean, not a descriptive SD. The SE is blank when n < 3 or when the value is calculated or imputed. Statistics fields (min, max, DF, error bounds, statistical comments) exist only for data added or updated since SR14 (2001). NFNAP sampling is a national probability-proportional-to-size design, often reduced to 12 locations combined into a few composites. All of this means SE·√n is only a rough, often downward-biased estimate of true unit-to-unit variability, and that it is not comparable across foods sampled differently.

### Cited Findings
- **What n counts.** "Number of data points is the number of analyses used to calculate the nutrient value. If the number of data points is 0, the value was calculated or imputed." — [SR28 documentation, Nutrient Data file format](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/sr28_doc.pdf)
- **When there is no SE.** `Std_Error`: "Standard error of the mean. Null if cannot be calculated. The standard error is also not given if the number of data points is less than three." — [SR28 documentation](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/sr28_doc.pdf)
- **SE describes the mean, not the spread.** The standard error is defined as "a measure of variability of the mean value as a function of the number of data points". Num_Studies is "the number of analytical studies used to generate the mean". — [SR28 documentation](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/sr28_doc.pdf)
- **Statistics fields only exist for newer data.** Min, max, degrees of freedom, the 95% error bounds and statistical comments "are only populated for data added or updated since we changed over to a new version of the Nutrient Databank System in 2001 (SR14)". — [SR28 documentation](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/sr28_doc.pdf)
- **Statistical comment codes:**
  - Comment 1: statistics were computed from data that include verbally described values ("less than, trace or not-detected"), which were imputed by interpolation.
  - Comment 2: DF were computed with Satterthwaite's approximation.
  - Comment 3: the "generic mean" reliability procedure "requires that the data associated with each study be a simple random sample from all the products associated with the given data source… one or more data sources had only one observation. Therefore, the standard errors, degrees of freedom, and error bounds were computed from the between-group standard deviation of the weighted groups having only one observation."

  — [SR28 documentation](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/sr28_doc.pdf)
- **How common those comments are in my data.** Among the 34,022 checkable records with n ≥ 5, 22,161 carry comment "2, 3", 4,411 carry "4", and 3,768 carry "1, 2, 3". Comment 4 is not defined in the passage I extracted. The SD-exceeds-range rate is 4% for "2, 3" (847 of 22,161), 20% for "4" (875 of 4,411) and 43% for "2" (750 of 1,742). These are my computations from SR28.
- **Beef: no SE or n for derived values.** "The analytical nutrient data include the mean nutrient value, the standard error… and the number of observations… For many food items, mean values are given without an accompanying standard error and number of samples. These values are either calculated by pooling data or by weighting means (e.g., All Grades), by applying cooking yields or nutrient retention factors, or by imputation from a different, closely related food." — [SR28 documentation, Notes on Foods: beef](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/sr28_doc.pdf)
- **Mixed designs, individual samples plus composites.** In the SR28 beef research notes, proximates "were determined on individual samples and composites of the separable fat". Muscle samples were "pooled into composites [of three] and analyzed for fatty acid content". Turkey analytical samples were per-location composites (n = 4–6). Mushrooms from 12 metropolitan areas "were composited into four composites of samples from three locations each". — [SR28 documentation, Notes on Foods](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/sr28_doc.pdf)
- **The NFNAP sampling plan.** It is a probability-proportional-to-size plan developed with USDA National Agricultural Statistics Service statisticians (Pehrsson et al., 2000). The revised design (Perry et al., 2003) is a "stratified three-stage design… Forty-eight geographically dispersed counties were selected at the first stage, supermarket outlets at the second stage, and specific food products at the third stage. Subsets of these locations can be selected… weighing variability vs. reliability. Multiples… can also be employed… where wide variability in a nutrient is expected." "Fewer samples would be analyzed for lower consumption foods… or for nutrients in foods which were not significant contributors to the diet or present in low or trace concentrations." — [SR28 documentation, Notes on Foods: NFNAP](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/sr28_doc.pdf)
- **Data quality before NFNAP.** At NFNAP's start in 1997, data for many foods "were found to be more than 10 years old, based on a limited number of values, lacking in complete and accurate documentation". NDL's data-quality expert system rates five indicators: sampling plan, sample handling, number of samples, analytical method and analytical QC (Holden et al., 2002 and 2005). — [SR28 documentation](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/sr28_doc.pdf)
- **Pickups and composites.** Retail pickups used 24 locations but were "more typically taken from a random and geographically dispersed subset of 12 locations". For produce the plan called for "four composites for selected nutrients", built from 4 regions × 3 stores. Some samples were analysed per location as individual units forming a composite; others were combined across locations. — [Trainer et al. 2010, J Food Compos Anal 23:843–851 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3079229)
- **Analytical error is small next to sample variability.** NFNAP control composites showed homogeneity with an "overall coefficient of variation (CV) … usually less than 1%". This shows that analytical and subsampling error is small next to the between-sample CVs above, at least for moisture and minerals. — [Phillips et al. 2006, Anal Bioanal Chem 384:1341–1355](https://www.ars.usda.gov/SP2UserFiles/Place/12354500/Articles/AnalBioaanlChem_QCPaper.pdf)
- **Key sampling paper (citation only).** Pehrsson PR, Haytowitz DB, Holden JM, Perry CR, Beckler DG (2000), "USDA's National Food and Nutrient Analysis Program: food sampling", J Food Compos Anal 12:379–389. I confirmed only the citation, not the text. — [reference list via KoreaScience](https://www.koreascience.or.kr/article/JAKO202014151761113.page). NFNAP is summarised in Haytowitz, Pehrsson & Holden (2008), J Food Compos Anal 21 (Suppl 1): S94–S102, cited in the [SR28 documentation](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/sr28_doc.pdf).

### Inferences
These follow from standard statistics applied to the cited design facts, not from a USDA statement.

- **Composites shrink the apparent SD.** If each data point is a composite of k units, the SD between composites is about σ/√k. With 12 locations pooled into 4 composites of 3, SE·√n underestimates the unit-to-unit SD by about √3 ≈ 1.7×, and a single fruit or cut varies more still. CVs from composite-based foods therefore cannot be compared directly with CVs from foods analysed as individual samples (for example, some beef proximates).
- **Multi-study ("generic mean") SEs reflect between-study scatter.** For records with Num_Studies > 1 and statistical comment 3, the SE comes from between-study or weighted-group variation. SE·√n then has no clean interpretation as a sample SD. This explains why 25% of multi-study records imply an SD larger than the published range allows.
- **The range-based measure is a useful cross-check.** Min and max are taken over the data points, which are themselves possibly composites. Where available, (max − min)/mean gives an independent ordering, and it agreed with the SE-based ranking.
- **Selection bias against variable foods.** Calculated and imputed values (68% of rows) carry no SE, and NFNAP analyses fewer samples for low-priority nutrients. The database's CV coverage is therefore biased toward key foods and toward proximates and minerals, which are cheaper to analyse.
- **The direction of the bias.** Medians computed here are likely lower bounds on true serving-to-serving variability for composite-based foods. They may be upper bounds where trace levels, values below the limit of detection (comment 1), or between-study heterogeneity (cultivars, years, methods) inflate the SE.

### Gaps
- **The full NFNAP sampling paper could not be read.** I could not retrieve the full text of Pehrsson et al. 2000 or Perry et al. 2003, the ARS-hosted Haytowitz & Pehrsson Food Chemistry PDF would not extract, and the ucanr.edu copy of the 2008 "decade of progress" paper returned 404. So I have no USDA-authored quote that explicitly says compositing reduces variance estimates; that statement remains my inference.
- **Statistical comment 4** appears in the data, but its definition was not captured in my extraction of the documentation.
- **There is no per-record flag for composites.** The number of units per composite is not in SR28, so composite versus individual status cannot be controlled for in the database-wide CVs.
