# Plant macronutrient variability: filling the gaps left by plant-macros.md

Scope note: this is a follow-up thread to `plant-macros.md`. It covers the items listed in that file's "Gaps" sections, on a budget of about 45 tool calls.

How the sources were read:
- PMC papers were read as Europe PMC full-text XML, and the numbers below come from their tables.
- The Veerman (2001) thesis PDF was opened and its text extracted.
- The rest come from abstracts (via the Europe PMC API) or from search-result summaries. Those are marked **(abstract)** or **(snippet, unverified)**.

USDA SR28 values come from `data/raw/sr28asc/NUT_DATA.txt`, with CV = SE·√n / mean for n ≥ 5. The script is in the session scratchpad, not in `data/scripts/`. Citation for all SR28 rows: [USDA SR28](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip).

**Caution on SR28 SEs.** For a few foods the SE cannot be reconciled with the reported min–max:
- sweet corn water: SD 8.8 against a range of 75.96–81.44
- broccoli water: SD 7.3
- snap bean water: SD 3.5 against a range of 90.27–93.13

These look like data-entry or aggregation artefacts. They are flagged where used, and the min–max is preferred for them.

---

## 1. Grapes (table grapes)

### Takeaway
Table grapes are about 80% water, carry 14–17 g sugar per 100 g, and have essentially no starch. Sugar is almost all glucose plus fructose in roughly equal parts; sucrose is undetectable. Cultivar sets most of the spread: about 14–22 °Brix across 17 cultivars in one vineyard. Year adds a significant shift. SR28's within-entry sugar CV is only about 5%, so the generic entry understates the spread between cultivars.

### Cited Findings
- **SR28, "Grapes, red or green (European type)" (09132), n = 8:**
  - water 80.54 g/100 g (78.47–82.22; CV 0.014)
  - total sugars 15.48 g (14.63–16.73; CV 0.05)
  - starch 0 (n = 4)
  - protein 0.72 (0.55–0.86; CV 0.12)
  - fibre 0.9 (0.6–1.7; CV 0.36)
  - Dry matter is therefore 19.5 ± 1.2 g/100 g (CV about 6%, my arithmetic).
  - American slip-skin grapes (09131, n = 1) have water 81.3 and sugars 16.25.
  - Source: [USDA SR28](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip)
- **Kunter B, Unal OB, Keskin S, Hatterman-Valenti H, Kaya O. 2024, *Front Plant Sci* 15:1321210.** 17 table-grape cultivars (15 *V. vinifera*, Isabella, Kyoho), one vineyard (Kalecik, Ankara), seasons 2018 and 2019, HPLC.
  - TSS ranged from 14.1 °Brix ('Big Perlon') to 21.9 °Brix ('Horoz Karası', 2019).
  - Glucose was 6.94–10.33 g/100 g in 2018 and 6.20–11.10 g/100 g in 2019. Fructose reached up to 12.12 g/100 g (Kyoho, 2019). Sucrose was not detected in any cultivar.
  - Titratable acidity ranged from 0.48–0.51 (Victoria) to 0.89–0.90 (Tekirdağ Çekirdeksizi), in units given as g/L.
  - All parameters were significantly affected by cultivar and by year (p ≤ 0.05). Sugars were more stable than acids.
  - **Caution:** the paper is internally inconsistent. The abstract gives sugars in g/L but Table 1 in g/100 g, the glucose and fructose ranges look swapped, and the TSS maximum is 21.0 in the text but 21.9 in the table.
  - Source: [doi:10.3389/fpls.2024.1321210](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2024.1321210/full)
- **Marmara (Turkey), 20 local plus 4 standard varieties:** glucose 7.08–10.2 g/100 g, fructose 6.95–10.38 g/100 g, TSS 15.03–22.25% **(snippet, unverified; authors not identified)**. Source: [OUCI record](https://ouci.dntb.gov.ua/works/4apWM857)
- **Muñoz-Robredo et al. 2011, *Chilean J Agric Res* 71(3):**
  - Glucose dominates early in berry development.
  - At harvest, glucose and fructose converge at about 47% each of total sugar.
  - Organic acids level off about 3–4 weeks before commercial harvest.
  - **(snippet, unverified)** Source: [PDF](https://oes.chileanjar.cl/files/V71_I3_2011_ENG_PabloMuNoz-Robredo.pdf)
- **Karnataka trial, 2021–23:** 'Nanasaheb Purple Seedless' had TSS 21.8 °Brix and reducing sugars 16.81%; 'Crimson Seedless' had the lowest sugars **(snippet, unverified)**. Source: [Plant Archives 2024](https://www.plantarchives.org/article/56-%20Quality-Traits-and-Storage-for-Physiological-Loss-in-Weight-of-Different-table-Grape-Varieties.pdf)

### Inferences
- °Brix in grape juice is mostly glucose + fructose. A 14 → 22 °Brix spread therefore means roughly 12 → 19 g sugar/100 g fresh berry, about ±25% around the mean: much wider than SR28's CV of 0.05.
- Grapes do not ripen after harvest; they are non-climacteric. Harvest maturity is fixed at picking, so retail variation reflects cultivar and the grower's harvest date, not shelf time.
- With no starch, available carbohydrate ≈ sugar. Energy per gram scales almost one-to-one with sugar.

---

## 2. Citrus (oranges, mandarins, lemons)

### Takeaway
Water is tight in oranges (CV about 1%) and somewhat looser in mandarins (CV about 3.5%). Sugars vary more: CV 0.14 within SR28 navels and 0.26 within SR28 tangerines. Lemons carry about 2.5 g sugar/100 g against 8.5–10.6 g in oranges and mandarins. In cold storage, acidity falls by about 7% (navel, 10 weeks at 1 °C) to 25% (mandarin, 8 weeks at 5 °C). TSS moves little, apart from concentration through weight loss.

### Cited Findings
- **SR28 water (g/100 g), with SD from SE·√n:**
  - all commercial oranges (09200): 86.75 (n = 88, SD 1.14, CV 0.013)
  - Florida oranges: 87.14 (n = 35, CV 0.008)
  - California Valencia: 86.34 (n = 17, CV 0.009)
  - navel: 85.97 (84.58–87.93; n = 10; CV 0.03)
  - tangerines/mandarins (09218): 85.17 (80.68–88.60; n = 15; CV 0.035)
  - lemon juice: 92.31 (92.00–92.87; n = 6)
  - lemon pulp without peel: 88.98 (n = 5, CV 0.02)
  - Source: [USDA SR28](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip)
- **SR28 sugars:**
  - navel: 8.5 g/100 g (6.15–10.05; n = 9; CV 0.14)
  - tangerine: 10.58 (8.87–15.16; n = 8; CV 0.26)
  - lemon juice: 2.52 (2.21–2.70; n = 4)
  - all-commercial and Florida orange sugars are imputed (n = 0)
  - Protein CV is 0.08–0.14 across the orange entries.
  - Source: same SR28 file
- **Alhassan N, Golding JB, Wills RBH, Bowyer MC, Pristijono P. 2019, *Foods* 8(1):19.** Tables 3–6, low-ethylene (< 0.001 µL/L) rows:
  - **Navel orange, time 0:** TSS 11.0%, TA 1.26% citric acid.
    - After 10 weeks at 1 °C: TSS 12.2%, TA 1.17% (−7%), weight loss 4.7%.
    - After 10 weeks at 10 °C: TSS 13.5%, TA 1.21%, weight loss 4.3%.
  - **'Afourer' mandarin, time 0:** TSS 10.2%, TA 0.60%.
    - After 8 weeks at 5 °C: TSS 9.6%, TA 0.45% (−25%), weight loss 0.78%.
    - After 8 weeks at 10 °C: TA 0.47%, weight loss 2.26%.
    - After 4 weeks at 20 °C: TA 0.52%, weight loss 1.68%.
  - Higher ethylene (1 µL/L) lowered TA further, to 0.37% for the mandarin at 5 °C and 8 weeks.
  - Source: [doi:10.3390/foods8010019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6351945/)
- **Other storage studies (snippets, unverified):**
  - 'Valencia' at 6 °C for 65 days lost < 5% of its weight. TA was constant early on and then fell in all varieties except Valencia, where it rose slightly. Source: [Horticulturae 8(7):570](https://www.mdpi.com/2311-7524/8/7/570)
  - Gannan navel at 5 °C: TSS fell early in storage and TA fell late. Water loss at 26 °C was 3.1–7.2× faster than at 5 °C. Source: [PMC9689076](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9689076/)
- **Seasonal maturation (snippets, unverified):**
  - 'Harumi' mandarin: sugars rose steadily from August to January, while the monosaccharide share of sugar fell from 70–80% to about 40%; citric acid stayed above 1%.
  - Satsuma: sucrose rose about 6–7× during maturation, glucose stayed roughly constant, and citric acid fell.
  - Korean mandarin juices: total acidity 0.76–1.20%.
  - Source: [J-STAGE JJSHS 54(2)](https://www.jstage.jst.go.jp/browse/jjshs/54/2/_contents/-char/en)
- **Early-ripening mandarins (Turkey, HPLC):** sucrose was the main sugar, 3.65% ('Okitsuwase') to 4.54% ('Primasol') **(snippet, unverified)**. Source: [Çukurova record](https://avesis.cu.edu.tr/yayin/b8e4357d-0a5f-4c70-8494-4ed0870619aa/fruit-quality-and-biochemical-characteristics-of-some-early-ripening-mandarin-varieties)

### Inferences
- Sugar per gram in citrus is set mainly by species/cultivar and harvest date. Sucrose builds up late in the season.
- Cold storage removes acid (about 1–3% of the initial TA per week). Sugar changes little: TSS rose 1–2.5 points in navels, of which roughly 4–5% weight loss explains about half, and fell 0.6 points in the mandarin.
- For an app, citrus carbohydrate error is dominated by cultivar/season (CV about 15–25%), not by storage.

---

## 3. Maize (field grain and sweet corn)

### Takeaway
- **Field maize grain:** hybrids span about 7–14% protein, 61–77% starch and 3–7% fat in a 500-sample CIMMYT set. Landraces span wider. Protein and starch trade off against each other.
- **Sweet corn:** about 76% water. Its sugar is unstable after harvest. In one cultivar, sucrose fell from about 83 g/kg to 6 g/kg in 29 days at 13 °C, and to 10 g/kg in 13 days at 25 °C. At 4 °C it still held 43.5 g/kg at the end of storage. sh2 ("supersweet") types start higher and lose sugar more slowly than su/se types.

### Cited Findings
- **Rosales A, Burgueño J, Gómez-Pérez V, et al. 2026, *Foods* 15(16):2933.** CIMMYT Maize Quality Lab data, 1,554 samples over more than a decade. Table "Variability of…" (basis not stated in the table; NIR/lab values presumably on a dry basis):

  | Group | Protein, % (mean) | Starch, % (mean) | Ether extract (fat), % (mean) |
  |---|---|---|---|
  | Hybrids | 7.23–14.30 (9.92), n = 519 | 61.05–76.92 (69.76), n = 506 | 3.02–7.20 (4.77), n = 519 |
  | Landraces | 6.36–15.76 (10.88), n = 510 | 52.85–74.12 (68.06), n = 486 | 2.63–11.80 (5.20), n = 472 |

  Germ was 7.4–17.6% of the kernel and pericarp 3.5–7.6%. These structural differences drive the oil and fibre differences.
  Source: [doi:10.3390/foods15162933, PMC13512079](https://pmc.ncbi.nlm.nih.gov/articles/PMC13512079/)
- **SR28, maize grain and meal:**
  - Corn grain, yellow (20014): protein 9.42 (n = 7, CV 0.09); fat 4.74 (n = 4); water 10.37 (n = 10, CV 0.32). Grain moisture is a drying and storage variable.
  - Whole-grain yellow cornmeal (20020): protein 8.12 (CV 0.10), fat 3.59 (CV 0.17), water CV 0.04.
  - Source: [USDA SR28](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip)
- **SR28, sweet corn, yellow, raw (11167):**
  - water 76.05 (75.96–81.44; n = 103). The SE-derived SD of 8.8 conflicts with this range, so it is not used.
  - protein 3.27 (3.13–3.75; CV 0.16)
  - fat 1.35 (1.18–2.13; CV 0.25)
  - sugars 6.26 (6.16–6.35; n = 2)
  - starch 5.7 (4.6–6.8; n = 2)
  - Only n = 2 for sugar and starch, so SR28 cannot show cultivar or storage effects.
  - Source: same file
- **Funsueb, Thanavanich, Chudoung, Jomnong, Theanjumpol, Kittiwachana, Chen 2026, *Molecules* 31(14):2512.** One cultivar, 'Pure White Hokkaido', from one region.
  - Sucrose fell from 83.02 to 6.26 g/kg after 29 days at 13 °C, and from 85.18 to 10.35 g/kg after 13 days at 25 °C.
  - At 4 °C, 43.51 g/kg remained on the final day of storage.
  - Predicted shelf life was 41.3, 11.0 and 8.9 days at 4, 13 and 25 °C.
  - Glucose and fructose also fell, by less.
  - Source: [doi:10.3390/molecules31142512, PMC13416319](https://pmc.ncbi.nlm.nih.gov/articles/PMC13416319/)
- **Sweet corn thesis, 'Super Sweet 7210' (sh2) versus 'Sugar Buns' (su se), 12 days at 20 °C:**
  - sh2 had higher initial sugar and better retention. Sugar in su se fell faster.
  - Respiration accounts for most of the loss. In su se, part of the sucrose is also converted to phytoglycogen.
  - Only the abstract was readable; the PDF has no numbers.
  - Source: [PHTnet wx431](https://www.phtnet.org/research/download/pdf/wx431.pdf)
- **Genotype snippets (unverified):**
  - sh2 kernels have about 6× the sugars of field corn, and su1 kernels about 3×. Source: [Front Plant Sci 2024, 10.3389/fpls.2024.1453031](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2024.1453031/full)
  - In a RIL population, the fast-degrading group lost on average 27.48 mg/g sucrose within 72 h. Source: [Genes 17(3):291](https://www.mdpi.com/2073-4425/17/3/291)
  - About one-third of the sugar is lost within 24 h at room temperature. This is a popular-science source, not primary. Source: [Indiana Univ. "A Moment of Science"](https://www.ipm.org/show/amomentofscience/2023-04-11/keeping-sweet-corn-sweet)

### Inferences
- Field-maize flour protein varies about ±20% across hybrids (CV roughly 10%, consistent with SR28's 0.09). Fat varies more (CV about 15–20%). Starch varies about ±8%.
- Sweet-corn sugar is the most storage-sensitive macronutrient in this note. A tracker should treat sweet-corn sugar as uncertain by about a factor of 2, depending on cultivar type and days since harvest. Total carbohydrate changes less, because part of the lost sucrose becomes polysaccharide (su/se types) and part is respired.

---

## 4. Oats

### Takeaway
Oat protein, oil and β-glucan all vary widely:
- **Protein:** about 11–22% across international samples. It is driven mainly by environment and N supply (CV about 6.5% when the same varieties are grown in different countries).
- **Oil:** about 5–12%. Both cultivar and location matter (CV about 9% across locations for the same varieties).
- **β-glucan:** about 3–5% in whole grain and 4–6% in groats. It is mainly genetic, with a year effect (colder years gave less).

### Cited Findings
- **Ames N. "Quality of international oat sources", research summary (POGA; PDF posted 2022; grey literature, PDF opened).**
  - Samples: 50 samples from 8 countries (41 varieties), plus 40 Canadian samples; analysed as groat wholemeal.
  - Protein ranged 11.4–21.6% overall (Canadian samples 14.4–21.0%). The same Canadian-bred varieties grown in different countries had a CV of about 6.5%.
  - Oil ranged 5.2–12.2%. Within-location CVs were 4.1–25%. AC Morgan and CDC Dancer had a CV of 8.6% across locations.
  - β-glucan CVs were about 3% for varieties grown at several Canadian locations, but large between varieties at each location.
  - The author calls it "an informal survey".
  - Source: [POGA PDF](https://poga.ca/wp-content/uploads/2022/06/Quality-of-International-Oat-Sources_research-summary.pdf)
- **Saastamoinen M, Plaami S, Kumpulainen J. 1992, *J Cereal Sci* (volume/pages not retrieved), doi:10.1016/S0733-5210(09)80090-8** (abstract):
  - Design: 2-year trials (1988–89) at 8 Finnish locations.
  - Trial-mean β-glucan was 3.1–4.5% in whole grain and 4.0–6.3% in groats. Across 12 varieties, whole-grain β-glucan ran from 2.78% ('Pol') to 4.68% ('Stil').
  - Year, trial, genotype and year × trial were all significant. The colder year, 1989, had lower β-glucan.
  - β-glucan was negatively correlated with protein.
  - Source: [doi:10.1016/S0733-5210(09)80090-8](https://doi.org/10.1016/S0733-5210(09)80090-8)
- **Manitoba thesis on N fertilisation, genotype and environment:** genotype explained 78% of β-glucan variation. Growing conditions explained 73% of protein and 49% of oil variation **(snippet, unverified)**. Source: [UManitoba MSpace](https://mspace.lib.umanitoba.ca/items/5b8d48ea-f16d-47eb-b8bc-8c1c965cba3b)
- **SR28 "Oats" (20038):**
  - protein 16.89 g/100 g (n = 50, CV 0.14)
  - fat 6.9 (n = 14, CV 0.38)
  - water 8.22 (n = 17, CV 0.19)
  - Rolled oats (08120) had only n = 4, all from a narrow range: protein 13.00–13.24, fat 6.20–6.92, starch 57.5–58.4, fibre 8.8–11.0.
  - Source: [USDA SR28](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip)

### Inferences
- For oat products, the tight n = 4 rolled-oat entry understates real variation. The raw-grain entry's CVs (protein 0.14, fat 0.38) are a better guide to sample-to-sample uncertainty.
- Oil swings (5–12%) move energy per gram by about ±3%: 7 g fat × 9 kcal ≈ 63 kcal against a total of about 380 kcal.

---

## 5. Nuts (fat, protein, storage)

### Takeaway
For nuts, both SR28 and the cultivar trials show tight fat and protein:
- **SR28:** within-entry CV is about 2–7% for fat (almonds n = 90, walnuts, pistachios, peanuts) and about 4–9% for protein.
- **Cultivar and genotype trials:** these span wider. Almond oil runs 43–61% of dry weight and protein 15–28%. Hazelnut fat runs 52–69% across cultivars, walnut oil 62–70%, peanut oil 39–56%.
- **Storage:** no study found shows total fat changing measurably. Storage changes oxidation markers (peroxide and acid values) and moisture, not grams of fat.

### Cited Findings
- **SR28, raw nuts (g/100 g):**

  | Food | n | Fat (range; CV) | Protein (range; CV) | Other |
  |---|---|---|---|---|
  | Almonds (12061) | about 90 | 49.93 (43.7–54.1; 0.05) | 21.15 (16.82–25.43; 0.05) | fibre 12.5 (7.9–19.3; CV 0.22); water 4.41 (CV 0.47) |
  | Walnuts, English (12155) | 7 | 65.21 (63.5–66.9; 0.02) | 15.23 (CV 0.04) | — |
  | Pistachios, raw (12151) | 10 | 45.32 (40.9–47.3; 0.07) | 20.16 (CV 0.04) | sugars CV 0.07 |
  | Peanuts, all types (16087) | 98 | 49.24 (CV 0.06) | 25.8 (n = 78; CV 0.08) | — |
  | Valencia peanuts | — | 47.58 (CV 0.03) | — | water 4.26 (CV 0.67) |

  Cashews, macadamias and pecans have n ≤ 3. Source: [USDA SR28](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip)
- **Gouta H, Laaribi I, Ksia E, Juan T, Estopañan G, Martínez-Gómez P. 2021, *J Food Compos Anal*, doi:10.1016/j.jfca.2021.103840** (abstract): 31 almond genotypes (Tunisian seedlings, local cultivars, foreign cultivars). Oil was 42.6–61% and protein 14.5–28.3% of kernel dry weight. Oleic acid ran 60.3–76.5% of fatty acids and linoleic 13.4–28.9%. Source: [doi:10.1016/j.jfca.2021.103840](https://doi.org/10.1016/j.jfca.2021.103840)
- **Amaral JS, Casal S, Citová I, et al. 2006, *Eur Food Res Technol*, doi:10.1007/s00217-005-0068-0** (abstract): 19 hazelnut cultivars from one site (Vila Real, Portugal), 2001 crop. Fat ran 59.3–69.0%. Source: [doi:10.1007/s00217-005-0068-0](https://doi.org/10.1007/s00217-005-0068-0)
- **Ozturk B, et al. 2025, *BMC Plant Biol*, doi:10.1186/s12870-025-07673-6** (abstract, truncated): 7 Italian and Turkish hazelnut cultivars grown under identical conditions. Oil ran 52.46–65.74%. Source: [PMC12628583](https://pmc.ncbi.nlm.nih.gov/articles/PMC12628583/)
- **Polat Y, et al. 2026, *BMC Plant Biol*, doi:10.1186/s12870-026-08302-6** (abstract): 3 hazelnut cultivars at 3 altitudes. Protein ran 17.60–22.87%, with a significant genotype × altitude interaction. Source: [PMC12990614](https://pmc.ncbi.nlm.nih.gov/articles/PMC12990614/)
- **Hakimi Y, Ṭāhirī Z, Rahmani A. 2024, *Genet Resour Crop Evol*, doi:10.1007/s10722-023-01836-w** (abstract): 7 superior walnut genotypes plus 'Jamal', 'Lara' and 'Serr', over 4 years (2019–2022). Kernel oil ran 62.26–70.08% and protein 16.79–21.61%. PUFA ran 52.05–74.40% of fatty acids. Source: [doi:10.1007/s10722-023-01836-w](https://doi.org/10.1007/s10722-023-01836-w)
- **Liu Z, Li X. 2023, *Crop Sci*, doi:10.1002/csc2.21014** (abstract): 12 peanut cultivars in 2 Shandong regions, 2019–2020.
  - Oil ran 38.83–56.48% and protein 21.80–31.65%.
  - Oil content rose with accumulated growing degree-days and sunshine duration.
  - Source: [doi:10.1002/csc2.21014](https://doi.org/10.1002/csc2.21014)
- **Storage:**
  - Ribeiro SR, et al. 2022, *Food Res Int*, doi:10.1016/j.foodres.2022.111498 (abstract): shelled 'Barton' pecans stored 6 months.
    - Moisture fell in all CA treatments.
    - Peroxide and acid values were lowest at 10 °C, and lipid-oxidation volatiles rose in every treatment.
    - Total fat was not reported as changing.
    - Source: [doi:10.1016/j.foodres.2022.111498](https://doi.org/10.1016/j.foodres.2022.111498)
  - Wang G, et al. 2022, *J Food Process Preserv* (abstract): fresh hazelnuts at 4 °C for 3 months. Irradiation "delay[ed] the reduction of fat" and slowed water loss. No numbers are given in the abstract. Source: [Europe PMC search record; DOI not listed]

### Inferences
- **Within one nut type:** fat CVs of about 5% (SR28) are realistic for commercial lots. Cultivar extremes are about ±15% around the mean.
- **Protein across cultivars:** it varies relatively more (almond 15–28% DW, peanut 22–32%), but contributes less energy.
- **Storage:** what changes in stored nuts is moisture, which shifts per-gram values slightly (a few tenths of a percent), and fat quality (rancidity). Fat grams stay essentially the same. Energy uncertainty for nuts is dominated by the Atwater overestimate covered in the main report, not by composition.

---

## 6. Water content (dry matter) of vegetables and its scaling effect

### Takeaway
For high-water vegetables, a small absolute spread in water is a large relative spread in dry matter, and so in every solid nutrient per gram. In SR28, water CVs of 0.3–3% correspond to dry-matter CVs of about 6–24% (all three vegetable rows below are SR28; my arithmetic):
- **Lowest:** romaine 6%, zucchini 7%, cabbage 7%.
- **Middle:** onion 13%, celery 12%, green pepper 15%, iceberg 17%, cauliflower 18%.
- **Highest:** carrot 21%, mushrooms 24%.

The min–max ranges imply 1.6–2.6× differences in solids per gram between the wettest and driest samples.

### Cited Findings
- **SR28 raw vegetables:** water mean g/100 g (min–max; n), SD = SE·√n, and dry-matter (DM) CV = SD/(100 − water). Source: [USDA SR28](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip)

  | Food | Water (range; n) | DM, g/100 g | CV of DM | Solids ratio, driest/wettest (from min–max) |
  |---|---|---|---|---|
  | Iceberg lettuce | 95.64 (94.0–97.7; 44) | 4.36 | 0.17 | 6.0/2.3 = 2.6× |
  | Romaine | 94.61 (94.0–95.5; 12) | 5.39 | 0.06 | 1.3× |
  | Celery | 95.43 (94.42–96.47; 18) | 4.57 | 0.12 | 1.6× |
  | Zucchini | 94.79 (93.3–95.8; 18) | 5.21 | 0.07 | 1.6× |
  | Green pepper | 93.89 (89.9–94.9; 25) | 6.11 | 0.15 | 2.0× |
  | Cabbage | 92.18 (90.84–94.18; 20) | 7.82 | 0.07 | 1.6× |
  | Cauliflower | 92.07 (91.70–93.82; 36) | 7.93 | 0.18 | 1.3× |
  | Mushrooms, white | 92.45 (88.2–95.2; 56) | 7.55 | 0.24 | 2.5× |
  | Onion | 89.11 (85.57–93.20; 34) | 10.89 | 0.13 | 2.1× |
  | Carrot | 88.29 (85.70–91.23; 33) | 11.71 | 0.21 | 1.6× |
  | Potato, flesh + skin | 79.25 (77.70–83.92; 11) | 20.75 | 0.06 | 1.4× |
  | Green peas | 78.86 (n = 10) | 21.14 | 0.08 | — |
  | Grapes (for comparison) | 80.54 (78.47–82.22; 8) | 19.46 | 0.06 | 1.2× |

  The SR28 water SDs for broccoli (CV_DM 0.68), snap beans (0.36), sweet corn (0.37) and beets (0.27) are inconsistent with their ranges or implausible, and are excluded.
- **Potato, Veerman 2001** (see §10): DM varies far more between tubers within a plot than between plots. Supporting numbers:
  - Between tubers: 79% (1987) and 83% (1988) of total DM variance in cv. Prominent.
  - Between plants: 15% and 9%.
  - Between field blocks: 6% and 8%.
  - Source: [Veerman 2001 thesis, edepot.wur.nl/121260](https://edepot.wur.nl/121260)

### Inferences
- **Scaling rule:** the per-gram content of any solid scales as (100 − water). If the composition of the dry matter is unchanged, CV(nutrient per g) ≈ √(CV_DM² + CV_composition²).
- **Low-DM foods:** in lettuce, celery, cucumber and mushrooms (DM ≈ 4–8%), the water term alone is a 12–24% uncertainty on protein, fibre, sugar and energy. That is as large as most nutrient-specific analytical CVs.
- **Starchy foods:** in potato, peas and grapes (DM ≈ 20%), the water term is only about 6–8%.
- **For an app:** apply a food-level "dry-matter CV" to all solids together (correlated, not independent). In leafy and watery vegetables it is not negligible.
- No study was found that formally partitions total variance into a water (dilution) part and a dry-matter-composition part. This remains a gap; the table above is the best available proxy.

---

## 7. Cavendish bananas by country of origin or cold-chain storage time

### Takeaway
After a real search, **no primary data were found** comparing Cavendish pulp composition by country of origin, or by duration of cold-chain (about 13–14 °C green) storage.

What was searched:
- Europe PMC, for banana or Cavendish with origin, country, cold storage or shipping, sugar, starch or dry matter, and named producer countries.
- A web search on Cavendish dry matter, starch and sugar by growing region and green-life cold storage.

What exists is ripening-stage data:
- green pulp starch about 20–25% falling to 1–2% when ripe, and sugars rising from 1–2% to 15–20% (older review, snippet, unverified) — [PJSIR 1990](https://pjsir.org/multidisciplinary-archive/Volume%2033%201990/Issue%2011/Article%207%20Vol%2033%20Issue%2011%201990.pdf)
- Taiwan 'Pei Chiao' Cavendish: total starch 74% → 31% and resistant starch 32% → 5% (apparently dry basis; snippet, unverified) — [Horticulturae 10(4):384](https://www.mdpi.com/2311-7524/10/4/384/html)

### Gaps
- There is still no basis for an origin-specific or cold-chain-specific correction for Cavendish. The ripeness effect, already in the main report (PMC8266066), remains the only quantified "provider" effect.

---

## 8. Potato storage: sugars and weight loss

### Takeaway
In storage, potatoes keep most of their total carbohydrate per gram but shift a small amount of starch into sugars:
- **Glucose:** about 0.3–0.5 mg/g at 8.9 °C, against 1–2.4 mg/g at 5.5–7.2 °C.
- **Sucrose:** about 1–4.4 mg/g.
- **Cultivar effect:** large. At the same temperature, glucose differed about 2–4× between chipping cultivars.
- **Weight loss:** 1.6–3.7% over 3 months at 7 °C and 75% RH, against 6.9–35% at room temperature. Dry matter rises during cold storage because water is lost faster than DM is respired.

In absolute terms these sugars are a few tenths of a gram per 100 g. They matter for fry colour and acrylamide, not for total carbohydrate.

### Cited Findings
- **Chen, Thompson, Jyoti, Hatterman-Valenti, Abbey, Zhang 2024, *Plants* 13(20):2868.** 4 North Dakota chipping cultivars, irrigated and non-irrigated sites, stored at 5.5, 7.2 and 8.9 °C for 1–10 months, over several years. Values are in mg g⁻¹ as labelled; the fresh-weight basis is implied but not confirmed in the extracted text.
  - **Temperature × month, mean over cultivars:**
    - Glucose at 8.9 °C: 0.34–0.47 mg/g from month 1 to 7, then 1.32 at month 10.
    - Glucose at 7.2 °C: 0.92 (month 1) rising to 2.44 (month 10).
    - Glucose at 5.5 °C: 1.01–1.56.
    - Sucrose at 8.9 °C: 0.93–1.25 (2.91 at month 10). At 7.2 °C: 1.52–4.40.
    - In this dataset 5.5 °C gave less sugar than 7.2 °C, which the classic cold-sweetening picture would not predict.
  - **Cultivar × temperature, glucose:**
    - Dakota Diamond: 1.92 (5.5 °C), 2.15 (7.2 °C), 0.51 (8.9 °C).
    - Dakota Pearl: 0.64, 0.92, 0.36.
    - NorValley: 1.18, 1.84, 0.82.
  - **Site × cultivar, glucose:** non-irrigated tubers were higher, e.g. NorValley 1.79 against 0.77 mg/g irrigated. Sucrose ranged 1.47–2.65.
  - Source: [doi:10.3390/plants13202868, PMC11511073](https://pmc.ncbi.nlm.nih.gov/articles/PMC11511073/)
- **Gikundi EN, Buzera AK, Orina IN, Sila DN. 2023, *Potato Res* 66:137–158** (abstract). Cultivars 'Shangi', 'Unica' and 'Dutch Robijn', stored 3 months.
  - Weight loss was 6.9–35.13% at room temperature (21.7 °C), against 1.6–3.7% at 7 °C and 75% RH.
  - Total reducing sugars rose 3.8–9.3-fold at room temperature and 26.0–68.5-fold at 7 °C.
  - 'Shangi' had the highest weight loss.
  - Source: [doi:10.1007/s11540-022-09575-8](https://doi.org/10.1007/s11540-022-09575-8)
- **Gikundi EN, et al. 2024, *Foods* 13(5):652.** Storage at 4 °C for 30 days, then reconditioning at 22 °C.
  - Sugars are reported in mg/100 g FW.
  - The glucose threshold for acceptable French-fry colour was ≤ 22 mg/100 g (0.22 mg/g). The chip threshold was about 14 mg/100 g.
  - A cited study: the highest reducing sugar, 333 mg/100 g, fell to 32 mg/100 g after 2 weeks of reconditioning.
  - Source: [doi:10.3390/foods13050652, PMC10930719](https://pmc.ncbi.nlm.nih.gov/articles/PMC10930719/)
- **Broćić Z, Dolijanović Ž, Poštić D, Milošević D, Savić J. 2016, *Potato Res* 59:21–34** (abstract). 10 cultivars at 3 Serbian sites, 2001–2002, stored 7 months at 3–4 °C without humidity control.
  - All cultivars except Jaerla and Condor had DM > 19%.
  - DM rose consistently during storage ("relative losses of water caused by transpiration were higher than the relative losses of DM caused by respiration").
  - Starch as a share of DM fell over storage.
  - Frisia, Red Star and Agria had consistently low weight loss.
  - No numbers are given in the abstract.
  - Source: [doi:10.1007/s11540-015-9311-7](https://doi.org/10.1007/s11540-015-9311-7)
- **Snippets (unverified):**
  - Kennebec microtubers: at 2 °C, reducing sugars exceeded 1.0 g/100 g FW and sucrose 0.7 g/100 g, against about 0.3 g/100 g reducing sugars at 8 °C. Source: [Springer BF02357613](https://link.springer.com/article/10.1007/BF02357613)
  - A reconditioning study reported glucose 27.06–253.31, fructose 22.78–251.17 and sucrose 52.33–94.03 mg/100 g FW. Attribution is uncertain; probably [Springer s11540-025-09875-9](https://link.springer.com/article/10.1007/s11540-025-09875-9).
- **SR28 "Potatoes, flesh and skin, raw" (11352):**
  - starch 15.29 g/100 g (10.54–18.10; n = 11; CV 0.33)
  - total sugars 0.82 (0.50–1.60; n = 5)
  - water 79.25 (77.70–83.92)
  - Source: [USDA SR28](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/dnload/sr28asc.zip)

### Inferences
- **Size of the sugar shift:** a cold-stored potato at 2 mg/g glucose + 2 mg/g fructose + 3 mg/g sucrose carries about 0.7 g sugar/100 g, against about 0.2 g when fresh. This moves the sugar/starch split, not total carbohydrate (about 17 g/100 g).
- **Weight loss:** 2–4% over months of good storage, up to 10–35% in ambient storage. If respiration losses are small, every solid concentrates by the same fraction: +2–4% per gram in good storage, more in poor storage.
- **SR28's starch CV of 0.33** is far larger than storage effects. It mostly reflects cultivar, DM and method.

---

## 9. Apples and citrus in storage (acid and sugar loss)

### Takeaway
- **Apples:** five months of storage moved malic acid by roughly −12% to −31% under CA or 1-MCP + CA, with no significant change in normal-atmosphere (NA) cold storage. Total sugars fell 10–32% depending on atmosphere, and sucrose shifted towards glucose and fructose. TSS hardly moved (±1–2 points).
- **Citrus:** see §2. Acidity fell 7–25% over 8–10 weeks of cold storage.

### Cited Findings
- **Ferreira C, Ribeiro C, Nunes FM. 2024, *Molecules* 29(13):2954.** 'Golden Delicious' (GD) and 'Red Delicious' (RD), stored 5 months at 2 °C and 90% RH. Conditions: NA, CA (3 kPa O₂ / 1 kPa CO₂), and 1-MCP + CA. n = 5 per cell. Table 1, harvest → NA / CA / 1-MCP + CA (g/kg, or % for TSS):

  | Parameter | Golden Delicious | Red Delicious |
  |---|---|---|
  | Malic acid | 19.5 → 22.6 / 17.1 / 13.5 | 12.3 → 12.8 / 10.1 / 8.67 |
  | Total sugars | 70.7 → 48.0 / 63.6 / 70.1 | 76.9 → 56.7 / 68.9 / 61.1 |
  | Sucrose | 17.1 → 11.3 / 10.8 / 8.1 | 15.7 → 14.9 / 6.3 / 3.1 |
  | Glucose | 9.1 → 6.7 / 11.2 / 14.4 | 15.9 → 11.0 / 18.9 / 19.4 |
  | Fructose | 43.6 → 28.6 / 40.6 / 46.5 | 43.3 → 28.9 / 41.4 / 37.1 |
  | TSS, % | 13.9 → 13.0 / 12.8 / 13.2 (all NS) | 13.2 → 14.3 / 15.3 / 13.1 |

  - The text gives malic acid drops under CA of 12% (GD) and 18% (RD).
  - **Caution:** HPLC total sugars (about 7 g/100 g) are low against TSS of 13–14% and against SR28 apple sugars (about 10 g/100 g). Titratable-acidity units are inconsistent between the table and the methods. Weight loss is not reported.
  - Source: [doi:10.3390/molecules29132954, PMC11243091](https://pmc.ncbi.nlm.nih.gov/articles/PMC11243091/)
- **Citrus:** Alhassan et al. 2019 (numbers in §2). Navel TA fell −7% (1 °C, 10 weeks) and 'Afourer' TA −25% (5 °C, 8 weeks). Weight loss was 0.8–4.7%. Source: [PMC6351945](https://pmc.ncbi.nlm.nih.gov/articles/PMC6351945/)
- **Other apple studies:**
  - Cold-hardy cultivars in Minnesota, 9 months in air or CA: responses depended on cultivar, harvest date and season. The PDF is a scanned image, so no numbers were extractable. Source: [J Am Pomol Soc PDF](https://journal.americanpomological.org/index.php/jofaps/article/download/2462/2466/5283)

### Inferences
- **Size of the effect:** apple storage changes acid (energy-trivial) and the sugar profile, but changes total sugar per gram by at most about 10–30%. Only one paper and two cultivars were found, and its sugar baseline is suspect.
- **For a tracker:** storage effects in apples are smaller than the spread between cultivars (13.5–18.3 °Brix across 26 cultivars, from plant-macros.md). A modest symmetric widening, about ±10% on apple sugar, is defensible.

---

## 10. Verifying the two unverified potato claims

### Claim A: potato dry matter 20.8% (Almera) to 25.5% (Agria), Montenegro 2015–2017
- **Status: confirmed at abstract level from a second, independent repository record.** Full text not opened.
- **Record:** Balijagić J, Zečević V, Đurić N, Arslanović-Lukač S, Poštić D. 2021, "The effect of year and genotype on productivity and quality of potato", DOI 10.2298/GENSR2101305A.
  - The author order differs between records: another lists Arslanović-Lukač first.
  - The DOI prefix indicates *Genetika* (Belgrade), but the journal name was not confirmed on the page.
- **Three-year mean DM:** Agria 25.46% (highest), Desiree 25.33%, Kennebec 25.13%, Almera 20.82% (lowest).
- **Design:** 8 cultivars (Riviera; Almera, Aladin, Bounty; Agria, Margarita, Kennebec, Desiree) at 3 locations (Nedakusi 556 m, Sutivan 680 m, Orahovica 900 m), 2015–2017, RCBD with 3 replicates.
- **Significance:** genotype, year and location were significant for yield components. The abstract does not split DM by year or site.
- **Sources:**
  - [UDG EmpowerHR4Inno record](https://empowerhr4inno.udg.edu.me/en/resources/show/ff94da41-a11d-45c6-a422-7edf5d0d7c2a)
  - original [Plantarum handle 675](https://plantarum.izbis.bg.ac.rs/handle/123456789/675)
  - [DOI](https://doi.org/10.2298/GENSR2101305A)
- **Access attempts that failed:**
  - Plantarum returns a CAPTCHA.
  - doiSerbia (doiserbia.nb.rs) refused connections.
  - doi.org resolution timed out.

### Claim B: Veerman 2001 (cultivar explains 10–30% of variance; within-lot variation exceeds between-lot)
- **Status: verified from the full thesis PDF, with one correction.** Veerman A. 2001, *Variatie in knolkwaliteit tussen en binnen partijen van consumptieaardappelrassen*, PhD thesis, Wageningen University, 253 pp. (promotor P.C. Struik; research done 1988–1994 at PAGV Lelystad). Source: [edepot.wur.nl/121260](https://edepot.wur.nl/121260)
  - **Correction:** the English abstract (p. 9) says "Depending on characteristic, about **10 to 40 %** was accounted for by cultivar", not 10–30%. Nitrogen and potassium fertiliser contributed 0–10%. "The major part of variance was caused by environmental influences related to the factors location, year and their interactions." The AGRIS record URL now returns 404, so the 10–30% figure in the earlier note probably came from a search summary.
  - **Within- versus between-lot:**
    - "The greater part of the variance was found within rather than between experimental plots."
    - Within plots, "differences between tubers originating from the same stems accounted for 80 to 90 % of total variance found within potato lots."
    - Chapter 3: 79–99% (Dataset 1) and 82–97% (Dataset 2) of variance in underwater weight (a DM proxy) lay within experimental units.
    - In cv. Prominent (Dataset 4): between tubers 79% (1987) and 83% (1988), between plants 15% and 9%, field blocks 6% and 8%.
    - The between-tuber share rose from 59% in July to 83% in September 1988.
  - **Management effects on DM (English summary):**
    - Cutting N by 100 kg/ha raised DM by about 0.4 points.
    - Spring K₂SO₄ lowered DM by 0.3–0.5 points, and KCl by almost 0.4 points more.
    - Cultivar × location × year was significant.
  - **Correction to plant-macros.md wording:** "tubers from the same stem accounted for 80–90% of variance" refers to variance *within lots/experimental units*, not total variance.

---

## Gaps
- **Cavendish:** no primary data on composition by country of origin or by cold-chain (green) storage duration (§7).
- **Montenegro potato paper:** the full text could not be opened (CAPTCHA, unreachable host). DM by year and site, and any variance partition, remain unseen. The cultivar means are confirmed only at abstract level.
- **Sweet corn:**
  - no mg/g fresh-weight table comparing sh2, se and su genotypes under the same storage
  - the "one-third lost in 24 h" figure is from a popular source only
  - the Funsueb 2026 data are one cultivar, and the end day of the 4 °C storage was not extracted
- **Oats:** no peer-reviewed variance-component table read in full. The Manitoba G/E percentages are snippet-only. The POGA summary is grey literature.
- **Field maize:** no G/E/G×E partition of protein, starch or oil was found. The CIMMYT ranges do not state their moisture basis.
- **Nuts:** no study quantifies total-fat change (g/100 g) during storage, only oxidation indices and moisture. SR28 hazelnut rows were not extracted.
- **Citrus:** no single multi-cultivar, multi-season table of sugars in g/100 g fresh weight was read in full. The SR28 navel and tangerine ranges are the best numeric proxy.
- **Apples:** only one 5-month storage paper (2 cultivars) was read, and its HPLC sugar baseline looks low. No monthly time series of acid loss was retrieved.
- **Potato storage:**
  - Chen 2024 gives glucose and sucrose but not fructose, and its 5.5 °C versus 7.2 °C ordering is counter-intuitive.
  - Per-month weight-loss curves (Broćić 2016) were not read.
- **Vegetables:** no formal decomposition of per-gram variance into water and dry-matter-composition parts. Some SR28 water SEs (broccoli, snap beans, sweet corn, beets) are internally inconsistent and unusable.
