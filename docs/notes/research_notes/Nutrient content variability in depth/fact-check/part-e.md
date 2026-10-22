# Fact-check part E: report lines 66–100

Scope: "Energy is itself a model with 5–30% built-in error" (l. 66–70), "A per-nutrient uncertainty budget for a tracker" (l. 72–94), Conclusion (l. 96–100) of `docs/notes/reports/Nutrient content variability in depth.md`.

Method: each primary source opened directly (FAO pages fetched and text-searched; PMC full text; Europe PMC REST abstracts for paywalled DOIs; Cambridge abstract page). Budget-table values were compared against `data/sr28_cv_by_nutrient.csv` (min_n = 5 rows, which the report uses), `data/sr28_cv_by_nutrient_group.csv`, `data/sr28_banana_detail.csv` and `data/sr28_cv_selected_foods.csv`. Budget values are the report's own judgement, so they are flagged only where the evidence contradicts them.

## Energy section (l. 66–70)

| Line | Claim | Source opened | Verdict | Evidence | Fix |
|---|---|---|---|---|---|
| 68 | Conversion factors assume constant digestibility; FAO/INFOODS handbook calls them "questionable assumptions" (Greenfield & Southgate 2003, ch. 9) | https://www.fao.org/4/y4705e/y4705e14.htm | CONFIRMED | Ch. 9 "Conventions and modes of expression…", Energy value: "The convention is based on the following questionable assumptions: … c) Coefficients of apparent digestibility are constant for all foods. d) Digestibility does not vary significantly among individuals." | — |
| 68 | Specific vs general Atwater factors shift diet energy by about −3% to +2% | https://www.fao.org/4/y5022e/y5022e04.htm (FAO FNP 77, ch. 3) | CONFIRMED (approximate) | §3.5.6: carbohydrate "effect on total dietary energy would be between -3 and +1.5 percent"; fat "-2 to +0.8 percent"; protein "about 1 percent"; Brazilian intake data "-3 to +1 percent". Caveat: §3.5.3 also says general factors on the US mixed diet were "on average about 5 percent higher than those obtained with specific factors" (2% without outlier foods). | Optional: add "(up to about 5% in one US comparison)". |
| 68 | Switching to NME lowers diet energy by 4–6% | same | CONFIRMED | §3.7: "use of NME instead of the Atwater general factors resulted in a decrease in estimated energy content of between 4 and 6 percent". | — |
| 68 | For individual high-protein or high-fibre foods the shift reaches 24–27% | same | CONFIRMED | §3.7: "The maximum differences for protein and fibre supplements would be 24 and 27 percent, respectively." (NME vs ME, supplements) | — |
| 68 | FAO puts the "typical error for practical purposes" at about 5% | same | CORRECTION NEEDED | The quoted phrase does not appear in the chapter. The 5% statement is about NME vs ME factors: "Nevertheless, in most cases the error incurred will be about 5 percent, which is within the usually accepted limits of measurement error or biological variation." | Replace with: `and FAO concludes that "in most cases the error incurred will be about 5 percent"`. |
| 68 | Carb-by-difference ×4 counts fibre at 4 kcal/g instead of about 2; 10 g fibre/100 g → ~20 kcal/100 g | same | CONFIRMED | §3.4: "The recommended ME factor for dietary fibre in ordinary diets is 8 kJ/g (2.0 kcal/g)". Arithmetic 10 × (4 − 2) = 20 kcal correct. | — |
| 70 | Almonds overstated 32% (4.6 vs 6.0–6.1 kcal/g) (Novotny et al. 2012) | https://pmc.ncbi.nlm.nih.gov/articles/PMC3396444/ | CONFIRMED | Abstract: ME "4.6 ± 0.8 kcal/g"; Atwater 6.0–6.1 kcal/g; "a 32% overestimation". Novotny, Gebauer, Baer, AJCN 2012;96:296–301. | — |
| 70 | Walnuts 21% (Baer et al. 2016) | https://doi.org/10.3945/jn.115.217372 (publisher redirect blocked; abstract read via Europe PMC) | CONFIRMED | "146 kcal (5.22 kcal/g) … calculated value of 185 kcal/serving (6.61 kcal/g). The ME of the walnuts was 21% less than that predicted by the Atwater factors". Baer, Gebauer, Novotny, J Nutr 2016. | — |
| 70 | Cashews 16% (Baer & Novotny 2019) | https://pmc.ncbi.nlm.nih.gov/articles/PMC6356908/ | CONFIRMED | "137 kcal/serving is 16% lower (p < 0.0001) than what is typically found on food labels" (163 kcal/serving, USDA SR). Nutrients 2019;11(1):33 (online Dec 2018). Note: the paper compares to the USDA/label value; its Fig. 3 calls the current value "calculated using Atwater factors". | — |
| 70 | Pistachios 5% (Baer et al. 2012) | https://www.cambridge.org/core/product/identifier/S0007114511002649/type/journal_article | CONFIRMED | Abstract: "22·6 kJ/g, which is 5 % less than the currently accepted energy value of 23·7 kJ/g, as calculated using the Atwater general factors". Br J Nutr 2012;107:120–5. | — |
| 70 | Whole natural almonds 4.42, chopped 5.04, almond butter 6.53 kcal/g, matching Atwater (Gebauer et al. 2016) | https://doi.org/10.1039/c6fo01076h (RSC 403; abstract via Europe PMC) | CONFIRMED | "Measured ME (kcal g−1) of whole natural almonds (4.42), whole roasted almonds (4.86), and chopped almonds (5.04) was significantly lower than predicted…; ME of almond butter (6.53 kcal g−1) was similar to predicted (P = 0.08)." Food Funct 2016. | — |
| 70 | Individual almond values 2.2–6.0 kcal/g, between-person SD ~17% of mean, within-person CV 6% | https://pmc.ncbi.nlm.nih.gov/articles/PMC3396444/ | CONFIRMED | "Measured values for individual volunteers ranged from 2.2 to 6.0 kcal/g"; 0.8/4.6 = 17%; "The mean intraindividual CV was 6%." | — |
| 70 | Absorbed 94–97% of Western diet energy vs 84–96% of high-fibre diet (Corbin et al. 2023) | https://pmc.ncbi.nlm.nih.gov/articles/PMC10232526/ | CONFIRMED | Abstract: "89.5 ± 0.73%; range 84.2–96.1% on the MBD vs. 95.4 ± 0.21%; range 94.1–97.0% on the WD" (n = 17). Nat Commun 2023;14:3161. These are metabolizable energy as % of intake. | — |

## Uncertainty budget (l. 74–94)

Reference values from SR28 (median CV, min_n = 5): water 0.033; protein 0.072 (F&V 0.154, meat/fish 0.059, dairy/egg 0.049); starch 0.066; sugars 0.118; fibre 0.160; fat 0.201 (dairy/egg 0.076, meat/fish 0.247, F&V 0.409; almond 0.054, Brazil nut 0.029, egg 0.042); Mg 0.095, P 0.101, K 0.118; Zn 0.148, Na 0.155, Fe 0.198, Ca 0.198, Cu 0.208; thiamin 0.213, riboflavin 0.182, niacin 0.169, B6 0.161, B12 0.212, vit E 0.202; folate 0.231, β-carotene 0.269, vit A RAE 0.320; vit C 0.340; selenium 0.318 (F&V 0.858, legumes/nuts/cereals 0.426, meat/fish 0.241, dairy/egg 0.299). Banana: sugars CV 0.239, starch 0.297, fibre 2.6 g, carb by difference 22.84 g.

| Line | Claim | Source checked | Verdict | Evidence | Fix |
|---|---|---|---|---|---|
| 78 | Water 3% | sr28_cv_by_nutrient.csv | CONFIRMED (consistent) | median 0.033 | — |
| 79 | Protein 7–10% animal/dairy; 15% produce | sr28_cv_by_nutrient_group.csv | CONFIRMED (consistent) | Produce 0.154. Animal/dairy medians are 0.05–0.06, so 7–10% is conservative, not contradictory. | — |
| 80 | Starch/sugars 7–12%; 25–30% in ripening fruit | sr28_cv_by_nutrient.csv; sr28_banana_detail.csv | CONFIRMED (consistent) | starch 0.066, sugars 0.118; banana sugars 0.239, starch 0.297 | — |
| 81 | By-difference vs available differs by the fibre content (banana ≈ 11%) | sr28_banana_detail.csv | CONFIRMED | 2.6 / 22.84 = 11.4% | — |
| 82 | Fibre 16–25%; between-lab 23–84% | sr28_cv_by_nutrient.csv; Hollman & Katan 1988 abstract (Europe PMC, PMID 2835409, doi 10.1016/S0002-8223(21)02007-1) | CONFIRMED | SR28 fibre 0.160. "The CV between for total dietary fiber ranged from 23% to 84%" (19 labs, J Am Diet Assoc 1988). | — |
| 83 | Fat 8% dairy/egg/nuts; 25% meat/fish; 40% produce | sr28 group + selected foods | CONFIRMED (consistent) | dairy/egg 0.076, egg 0.042, almond 0.054, Brazil nut 0.029; meat/fish 0.247; F&V 0.409. (The broad "legumes, nuts, cereal grains" group is 0.173, but the individual nuts are low.) | — |
| 84 | Shift down 5–32% for whole nuts | papers above | CONFIRMED | pistachio 5%, cashew 16%, walnut 21%, almond 32% | — |
| 84 | "labels average +4–8% under actual" | report l. 58 (Jumpertz median +4.3%, Urban 2010 +8%) | CONFIRMED, wording unclear | Numbers match l. 58; "+…under" is ambiguous. | Suggested: "measured energy averages 4–8% above the label". |
| 85 | Mg, P, K 10–12% | sr28_cv_by_nutrient.csv | CONFIRMED (consistent) | 0.095 / 0.101 / 0.118 | — |
| 86 | Zn, Na, Fe, Ca, Cu 15–20%; label sodium tends to run under the true value | sr28_cv_by_nutrient.csv; report l. 58 (Fitzpatrick 2014) | CONFIRMED (consistent) | 0.148–0.208; Fitzpatrick: every failure above declared, sodium failed most | — |
| 87 | B vitamins, vitamin E 17–25% | sr28_cv_by_nutrient.csv | CONFIRMED (consistent) | 0.161–0.213; E 0.202 | — |
| 88 | Folate, carotenoids 25–30%; stored leafy greens lose ~50% by end of shelf life | sr28 csv; report l. 48 (Pandrangi & LaBorde: 53% folate, 44–61% carotenoids retained) | CONFIRMED (consistent) | folate 0.231, β-carotene 0.269, vit A RAE 0.320; losses ≈ 39–56% | — |
| 89 | Vitamin C 35%, lognormal | sr28_cv_by_nutrient.csv | CONFIRMED | 0.340; 30% of foods CV > 0.5 | — |
| 90 | Selenium, iodine, vitamin D, **B12**: 50–150%, order-of-magnitude range | sr28 csv; report l. 16, 52 | OVERSTATED (for B12) | SR28 B12 median CV 0.212 (only 8.7% of foods > 0.5), and the report's own l. 16 puts B12 in the 0.18–0.21 band. The only B12 order-of-magnitude evidence (Duplessis 2024) is individual cows' milk, not pooled retail food. Selenium is consistent for plant foods (F&V 0.86, grains/nuts 0.43) but SR28 gives 0.24–0.30 for meat, fish, dairy, egg. Iodine and vitamin D have no SR28 CVs; the l. 52 evidence supports wide ranges. | Split the row: "Selenium (plant foods), iodine, vitamin D: 50–150%…" and "B12, selenium in animal foods: 20–30%; widen when the animal's diet is unknown". |
| 90 | "fortified foods and supplements run above label" | Holick et al. 1992 abstract (Europe PMC, PMID 1313548); Andrews et al. 2018 abstract (PMID 31505677) | CORRECTION NEEDED | Supplements: Andrews: "Analytical overages >20% of label levels are predicted … in 50-99% of multivitamin-mineral products". Fortified milk ran **under**: "Twenty-six of the 42 milk samples (62 percent) contained less than 80 percent of the amount claimed"; only infant formula ran over ("Seven of the 10 … more than 200 percent"). Holick concludes products "may be either underfortified or overfortified." | Replace with: "supplements run above label; fortified foods can miss in either direction (milk vitamin D mostly below label, infant formula above)". |
| 92 | Around 30% of foods have CV > 0.5 for vitamin C, β-carotene and selenium | sr28_cv_by_nutrient.csv (share_cv_gt_0.5, min_n = 5) | CONFIRMED | 0.301 / 0.323 / 0.281 | — |
| 92 | Ten foods at 20% CV → ~6% total; 10–15% if one or two foods dominate | arithmetic | CONFIRMED | 20/√10 = 6.3%. One food at 50% of total: ≈10.5%; two at 40% each: ≈11.4%; one at 70%: ≈14% | — |
| 92 | Evenepoel's per-portion caps | Evenepoel et al. 2020 abstract (Europe PMC, PMID 33084583) | CONFIRMED | "Per food portion, the following upper limits were defined: 1500 kilocalories…" | — |
| 92 | Content vs absorbed diverge by 5–10% at diet level for nut/fibre-heavy diets | Corbin 2023 | CONFIRMED (consistent) | Mean ME 89.5% (MBD) vs 95.4% (WD), a ~6-point gap; the MBD range reaches 84%. | — |
| 94 | SR28 CVs "cannot be computed at all for energy or total carbohydrate" | sr28_cv_by_nutrient.csv | OVERSTATED (minor) | Energy has CVs for 10 foods and carb by difference for 10 foods (min_n = 3), out of several thousand. | "…and can be computed for only about ten foods for energy or total carbohydrate". |
| 94 | No study measured paired macro/micro CVs on the same samples; no primary data on Cavendish origin/cold chain, brand macro spread, OFF accuracy | — | UNVERIFIABLE (absence claim) | Negative search claims; consistent with the research notes and report l. 32 and l. 64. Not falsified. | — |

## Conclusion (l. 96–100)

| Line | Claim | Source checked | Verdict | Evidence | Fix |
|---|---|---|---|---|---|
| 98 | Natural variation in the energy-carrying macronutrients is "small (a few percent to about 12%)" | sr28_cv_by_nutrient.csv / group csv; report l. 3 | CORRECTION NEEDED | Fat is the main energy carrier per gram, and its SR28 median CV is 0.201 (0.247 meat/fish), and the report's own l. 3 gives "20% for total fat" and the budget gives fat 25% for meat and fish. 12% covers only protein, starch and sugars. | Replace with: "is small for protein and carbohydrate (a few percent to about 12%) and moderate for fat (about 20%, 25% in meat and fish)". |
| 98 | Atwater overestimation for intact plant foods runs in a known direction; one-way energy overstatement in nut-heavy diets | nut papers; Corbin 2023 | CONFIRMED | All four nut studies plus Gebauer show ME below Atwater | — |
| 100 | Four logging-time facts would remove more uncertainty than table refinement | — | Not checked (synthesis judgement, no figure) | — | — |

## Verdict count

- CONFIRMED: 30 (including 2 with optional wording suggestions: l. 68 Atwater range, l. 84 label bias)
- CORRECTION NEEDED: 3 (l. 68 misquoted "typical error for practical purposes"; l. 90 fortified foods "run above label"; l. 98 macro-variation range omits fat)
- OVERSTATED: 2 (l. 90 B12 at 50–150%; l. 94 "cannot be computed at all")
- UNVERIFIABLE: 1 (l. 94 absence-of-evidence claims)
- Not checked (no factual figure): 1 (l. 100)
