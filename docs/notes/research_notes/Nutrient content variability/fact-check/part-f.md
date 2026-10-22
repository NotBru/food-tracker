# Fact-check part F: `plant-macros-gaps.md`

File checked: `docs/notes/research_notes/Nutrient content variability/plant-macros-gaps.md` (the follow-up
thread on the gaps in `plant-macros.md`).

How the sources were checked:
- **SR28.** Every SR28 figure was recomputed from `data/raw/sr28asc/NUT_DATA.txt`, with descriptions from `FOOD_DES.txt`.
  SD = SE·√n, CV = SD/mean, and DM CV = SD_water/(100 − water). The script is in the session scratchpad, not the notes
  folder. Each SD was also tested against its own min–max with the Bhatia–Davis bound, SD ≤ √((max − mean)(mean − min)).
  An SD above that bound cannot come from the same set of samples as the reported mean, min and max. The usual cause in
  SR28 is a mean or SE aggregated from different data than the min–max.
- **PMC papers.** Read as Europe PMC full-text XML (`/webservices/rest/PMCxxxx/fullTextXML`), with tables parsed.
- **Other papers.** Read as the publisher abstract through the Europe PMC REST API (`search?query=DOI:"…"&resultType=core`).
  Author lists were checked against Crossref (`api.crossref.org/works/<doi>`).
- **Veerman (2001).** PDF downloaded from edepot.wur.nl/121260 (3.9 MB) and its full text extracted. Page numbers below
  are the printed ones.
- **POGA oat summary.** PDF downloaded and its text extracted.
- **Balijagić / Arslanović-Lukač (2021).** Read through Crossref metadata and the UDG EmpowerHR4Inno record. The
  doiSerbia PDF host refused connections (HTTP 000), and the rivec.institut-palanka.rs and Plantarum records are behind
  a human-verification wall.

---

## A. Grapes (§1)

| # | Claim | Source opened | Verdict | Note |
|---|---|---|---|---|
| A1 | SR28 09132: water 80.54 (78.47–82.22; CV 0.014); sugars 15.48 (14.63–16.73; CV 0.05); starch 0 (n = 4); protein 0.72 (0.55–0.86; CV 0.12); fibre 0.9 (0.6–1.7; CV 0.36); n = 8 | NUT_DATA.txt | CONFIRMED | Recomputed: water SD 1.16, CV 0.014; sugar SD 0.78, CV 0.051; protein CV 0.122; fibre CV 0.358. All SDs pass Bhatia–Davis. |
| A2 | DM 19.5 ± 1.2 g/100 g, CV ≈ 6%; 09131 water 81.3, sugars 16.25 (n = 1) | NUT_DATA.txt | CONFIRMED | DM 19.46, SD 1.16, CV 0.060. For 09131 the sugar value has n = 0 (imputed), not n = 1; only water is n = 1. Optional: say "sugars 16.25 (imputed)". |
| A3 | Kunter et al. 2024 *Front Plant Sci* 15:1321210: 17 cultivars (15 *vinifera*, Isabella, Kyoho), Kalecik (Ankara), 2018–2019; TSS 14.1 (Big Perlon) to 21.9 °Brix (Horoz Karası, 2019); glucose 6.94–10.33 (2018) and 6.20–11.10 g/100 g (2019); no sucrose; TA 0.48–0.51 (Victoria) to 0.89–0.90 (Tekirdağ Çekirdeksizi) "g/L"; cultivar and year significant | PMC10957544 full text | CONFIRMED | All values match the abstract, the text and Table 1. HoKa is 21.90 in 2019 in Table 1. Authors and DOI are correct. |
| A4 | "Fructose reached up to 12.12 g/100 g (Kyoho, 2019)" | PMC10957544 | CORRECTION NEEDED | The text says "Ko exhibited the highest fructose accumulation in 2019, reaching 12.12 g/100 g", and Ko is 'Köhnü' (Kyoho is "Ky"). Replacement: "Fructose reached up to 12.12 g/100 g ('Köhnü', 2019)." |
| A5 | Caution: units differ (g/L vs g/100 g), the glucose/fructose ranges look swapped, TSS maximum 21.0 in text vs 21.9 in table | PMC10957544 | CONFIRMED | The abstract gives fructose 6.50–11.10 and glucose 5.83–12.12 "g/L"; Results gives glucose 6.94–10.33 / 6.20–11.10 g/100 g. Results text says 21.0 °Brix (YaMi), while the abstract and Table 1 give 21.90 (HoKa, 2019). |
| A6 | Inference: 14 → 22 °Brix ≈ 12 → 19 g sugar/100 g, about ±25% around the mean | arithmetic | CONFIRMED | 12 and 19 g are −23% and +23% around 15.5 g. |

## B. Citrus (§2, plus §9 citrus rows)

| # | Claim | Source opened | Verdict | Note |
|---|---|---|---|---|
| B1 | SR28 water: 09200 86.75 (n = 88, SD 1.14, CV 0.013); Florida (09203) 87.14 (n = 35, CV 0.008); California Valencia (09201) 86.34 (n = 17, CV 0.009) | NUT_DATA.txt | CONFIRMED | Recomputed exactly. No min/max is published for these entries. |
| B2 | Navel (09202) water 85.97 (84.58–87.93; n = 10; CV 0.03) | NUT_DATA.txt | CORRECTION NEEDED | The arithmetic reproduces (SD 2.68, CV 0.031), but the SD exceeds the Bhatia–Davis maximum of 1.65 for that range. Replacement: "navel: 85.97 (84.58–87.93; n = 10). The SE-derived SD (2.7) exceeds what the range allows (≤ 1.65, CV ≤ 0.019), so it is not used." |
| B3 | Tangerine (09218) water 85.17 (80.68–88.60; n = 15; CV 0.035); lemon juice 92.31 (92.00–92.87; n = 6); lemon pulp 88.98 (n = 5, CV 0.02) | NUT_DATA.txt | CONFIRMED | Tangerine SD 2.95 passes the bound (≤ 3.92). Lemon pulp CV 0.021. Lemon-juice water SD (0.63) fails the bound (≤ 0.42), but the notes do not quote it. |
| B4 | SR28 sugars: navel 8.5 (6.15–10.05; n = 9; CV 0.14); tangerine 10.58 (8.87–15.16; n = 8; CV 0.26); lemon juice 2.52 (2.21–2.70; n = 4); all-commercial and Florida sugars imputed (n = 0); protein CV 0.08–0.14 across the orange entries | NUT_DATA.txt | CONFIRMED | Navel CV 0.137; tangerine CV 0.262 (SD 2.77, just inside the bound of 2.80). Protein CVs: 0.124 (09200), 0.138 (09201), 0.096 (09202), 0.076 (09203). |
| B5 | Takeaway: "Water is tight in oranges (CV about 1%)" | NUT_DATA.txt | OVERSTATED | True for the big commercial entries (0.8–1.3%). The navel entry gives 3.1%, though that figure is unreliable (B2). Softened: "Water is tight in the large SR28 orange entries (CV about 1%; the small navel entry's SE is unreliable)." |
| B6 | Alhassan et al. 2019 *Foods* 8(1):19, low-ethylene rows. Navel: t0 TSS 11.0, TA 1.26; 10 weeks at 1 °C TSS 12.2, TA 1.17, weight loss 4.7%; 10 weeks at 10 °C TSS 13.5, TA 1.21, weight loss 4.3%. 'Afourer': t0 TSS 10.2, TA 0.60; 8 weeks at 5 °C TSS 9.6, TA 0.45, weight loss 0.78%; 8 weeks at 10 °C TA 0.47, weight loss 2.26%; 4 weeks at 20 °C TA 0.52, weight loss 1.68%; 1 µL/L at 5 °C, 8 weeks: TA 0.37 | PMC6351945, Tables 3–6 | CONFIRMED | All cells match. Mandarin t0 TA is printed as "0.6". Authors and DOI are correct. |
| B7 | Inference: cold storage removes "about 1–3% of the initial TA per week"; navel TSS rose 1–2.5 points, "of which roughly 4–5% weight loss explains about half" | arithmetic on B6 | CORRECTION NEEDED | Navel TA fell 7% in 10 weeks (0.7%/week) and the mandarin 25% in 8 weeks (3.1%/week). A 4.3–4.7% weight loss concentrates TSS by about 0.5 point: roughly 40% of the +1.2 point rise at 1 °C and 20% of the +2.5 point rise at 10 °C. Replacement: "Cold storage removes acid (about 0.7–3% of the initial TA per week). … TSS rose 1.2–2.5 points in navels; the 4–5% weight loss explains about 0.5 point of that (≈ 40% at 1 °C, ≈ 20% at 10 °C)." |

## C. Maize (§3)

| # | Claim | Source opened | Verdict | Note |
|---|---|---|---|---|
| C1 | Rosales A, Burgueño J, Gómez-Pérez V, et al. 2026, *Foods* 15(16):2933; CIMMYT Maize Quality Lab; 1,554 samples over more than a decade | PMC13512079 full text; Europe PMC record | CONFIRMED | The paper exists (PMC13512079): 1554 entries (995 landraces, 559 hybrids), analysed 2011–2022. Authors are Rosales, Burgueño, Gómez-Pérez, Molina, Cabrera-Soto, Chassaigne and Palacios-Rojas. |
| C2 | Table values: hybrids protein 7.23–14.30 (9.92, n = 519), starch 61.05–76.92 (69.76, n = 506), fat 3.02–7.20 (4.77, n = 519); landraces 6.36–15.76 (10.88, n = 510), 52.85–74.12 (68.06, n = 486), 2.63–11.80 (5.20, n = 472) | PMC13512079, Table "Variability of physical, chemical, and nutritional compounds…" | CONFIRMED | All twelve cells and all n match. |
| C3 | "basis not stated in the table; NIR/lab values presumably on a dry basis"; Gaps: "The CIMMYT ranges do not state their moisture basis" | PMC13512079, Methods | CORRECTION NEEDED | Methods: protein by Kjeldahl (N × 6.25), starch by modified Megazyme, oil by Soxtec, and "All results are expressed on a dry basis." Replacement (§3): "Table 'Variability of…' (dry basis, per Methods; protein Kjeldahl N × 6.25, starch Megazyme, oil Soxtec)". Gaps line: delete "The CIMMYT ranges do not state their moisture basis." |
| C4 | "Germ was 7.4–17.6% of the kernel and pericarp 3.5–7.6%" | PMC13512079, same table | CORRECTION NEEDED | These are the hybrid ranges (n = 314). Landraces: germ 6.25–18.12%, pericarp 2.89–13.41% (n ≈ 60). Replacement: "In hybrids, germ was 7.4–17.6% of the kernel and pericarp 3.5–7.6% (landraces: 6.3–18.1% and 2.9–13.4%)." |
| C5 | SR28 20014: protein 9.42 (n = 7, CV 0.09), fat 4.74 (n = 4), water 10.37 (n = 10, CV 0.32); 20020: protein 8.12 (CV 0.10), fat 3.59 (CV 0.17), water CV 0.04 | NUT_DATA.txt | CONFIRMED | Recomputed CVs 0.095, 0.316, 0.100, 0.167, 0.043. No min/max is published, so the bound test does not apply. |
| C6 | SR28 11167: water 76.05 (75.96–81.44; n = 103), SD 8.8 not used; fat 1.35 (1.18–2.13; CV 0.25); sugars 6.26 (6.16–6.35; n = 2); starch 5.7 (4.6–6.8; n = 2) | NUT_DATA.txt | CONFIRMED | SD 8.76. The bound allows at most 0.70, because the mean sits 0.09 above the minimum. Fat CV 0.247 passes. |
| C7 | SR28 11167 protein 3.27 (3.13–3.75; CV 0.16) | NUT_DATA.txt | CORRECTION NEEDED | SD 0.52 exceeds the bound of 0.26 (CV ≤ 0.08). Replacement: "protein 3.27 (3.13–3.75; n = 8; the SE-derived CV of 0.16 exceeds what the range allows, ≤ 0.08)". |
| C8 | "Funsueb, Thanavanich, Chudoung, Jomnong, Theanjumpol, Kittiwachana, Chen 2026, *Molecules* 31(14):2512" | Crossref and Europe PMC for 10.3390/molecules31142512 | CORRECTION NEEDED | Six authors; there is no "Chen". Replacement: "Funsueb S, Thanavanich C, Chudoung C, Jomnong P, Theanjumpol P, Kittiwachana S. 2026, *Molecules* 31(14):2512." |
| C9 | Funsueb: one cultivar 'Pure White Hokkaido', one region; sucrose 83.02 → 6.26 g/kg (29 days, 13 °C) and 85.18 → 10.35 g/kg (13 days, 25 °C); 43.51 g/kg at 4 °C on the final day; shelf life 41.3 / 11.0 / 8.9 days | PMC13416319 full text | CONFIRMED | Exact match. The sample was harvested November 2024 in San Sai, Chiang Mai (Thailand), from a single harvest season. The paper does not state a fresh- or dry-weight basis for g kg⁻¹; worth adding "(basis not stated)". |
| C10 | Inference: "Field-maize flour protein varies about ±20% across hybrids … Starch varies about ±8%" | arithmetic on C2 | CORRECTION NEEDED | Hybrid protein 7.23–14.30 around 9.92 is −27% to +44%; starch 61.05–76.92 around 69.76 is −12% to +10%. Replacement: "Hybrid protein spans 7.2–14.3% (−27% to +44% around the 9.9% mean; SR28 CV ≈ 0.09–0.10). … Starch spans about ±11%." |

## D. Oats (§4)

| # | Claim | Source opened | Verdict | Note |
|---|---|---|---|---|
| D1 | Ames N., POGA research summary "Quality of international oat sources" (grey literature): 50 samples from 8 countries (41 varieties) plus 40 Canadian; groat wholemeal; protein 11.4–21.6% (Canada 14.4–21.0%); CV ≈ 6.5% for Canadian-bred varieties abroad; oil 5.2–12.2%, within-location CVs 4.1–25%, AC Morgan and CDC Dancer CV 8.6%; β-glucan CVs ≈ 3% within Canada; "informal survey" | POGA PDF (opened, text extracted) | CONFIRMED | All figures match. The grey-literature label is present and correct. The 6.5% CV applies to Leggett, AC Morgan and AC Dancer. Oil was NIR-predicted (in-house equations), not extracted; worth adding. |
| D2 | Saastamoinen M, Plaami S, Kumpulainen J. 1992, *J Cereal Sci* (volume/pages not retrieved): 8 Finnish locations 1988–89; trial means 3.1–4.5% whole grain, 4.0–6.3% groats; 2.78% ('Pol') to 4.68% ('Stil'); year, trial, genotype and year × trial significant; 1989 colder and lower; β-glucan negatively correlated with protein | Europe PMC abstract | CONFIRMED | All values match. Fill the gap: *J Cereal Sci* 16:279–290. |
| D3 | Manitoba thesis: genotype 78% of β-glucan variation; growing conditions 73% of protein and 49% of oil variation "(snippet, unverified)" | UManitoba MSpace record (abstract) | CONFIRMED | The abstract confirms all three figures (it also gives 36% for groat breakage). Attribution: Rhymer CR. 2002, *Effects of nitrogen fertilization, genotype and environment on the quality of oats (Avena sativa) grown in Manitoba*, University of Manitoba thesis. The label can be upgraded to "(thesis abstract)". |
| D4 | SR28 20038: protein 16.89 (n = 50, CV 0.14), fat 6.9 (n = 14, CV 0.38), water 8.22 (n = 17, CV 0.19); 08120 n = 4, protein 13.00–13.24, fat 6.20–6.92, starch 57.5–58.4, fibre 8.8–11.0 | NUT_DATA.txt | CONFIRMED | CVs 0.136, 0.382, 0.191. |
| D5 | Inference: "Oil swings (5–12%) move energy per gram by about ±3%: 7 g fat × 9 kcal ≈ 63 kcal against a total of about 380 kcal" | arithmetic | CORRECTION NEEDED | 63 kcal is 17% of 380 kcal, so the range spans about ±8%, not ±3%. Replacement: "Oil swings (5–12%) move energy per gram by about ±8% (a 7 g range × 9 kcal ≈ 63 kcal against about 380 kcal), less if starch falls as oil rises." |

## E. Nuts (§5)

| # | Claim | Source opened | Verdict | Note |
|---|---|---|---|---|
| E1 | SR28 table: almonds (n ≈ 90) fat 49.93 (43.7–54.1; 0.05), protein 21.15 (16.82–25.43; 0.05), fibre 12.5 (7.9–19.3; 0.22); walnuts n = 7, fat 65.21 (63.5–66.9; 0.02), protein CV 0.04; pistachios n = 10, fat 45.32 (40.9–47.3; 0.07), protein CV 0.04, sugars CV 0.07; peanuts fat 49.24 (n = 98; CV 0.06), protein 25.8 (n = 78; CV 0.08); Valencia peanuts (16093) fat 47.58 (CV 0.03), water 4.26 (CV 0.67) | NUT_DATA.txt | CONFIRMED | All recomputed (almond fat n = 90, protein n = 91). Pistachio fat SD 3.04 is a hair over its bound (2.96); immaterial at two decimals. |
| E2 | Almond water 4.41 (CV 0.47) | NUT_DATA.txt | CORRECTION NEEDED | SD 2.08 exceeds the bound of 1.51 for 3.20–6.30 (CV ≤ 0.34). Replacement: "water 4.41 (3.2–6.3; SE-derived CV 0.47 exceeds what the range allows, ≤ 0.34)". |
| E3 | Cashews, macadamias and pecans have n ≤ 3 | NUT_DATA.txt | CONFIRMED | Cashew protein n = 2 and fat n = 0; macadamia n = 3; pecan n = 3. |
| E4 | Gouta et al. 2021 *J Food Compos Anal* (doi:10.1016/j.jfca.2021.103840): 31 genotypes; oil 42.6–61%, protein 14.5–28.3% of kernel DW; oleic 60.3–76.5%, linoleic 13.4–28.9% | Europe PMC abstract | CONFIRMED | 15 seedlings + 11 local + 5 foreign = 31. Volume 98. |
| E5 | Amaral et al. 2006 *Eur Food Res Technol*: 19 hazelnut cultivars, Vila Real, 2001 crop; fat 59.3–69.0% | Europe PMC abstract | CONFIRMED | 222:274–280. |
| E6 | Ozturk B, et al. 2025 *BMC Plant Biol*: 7 Italian and Turkish cultivars under identical conditions; oil 52.46–65.74% | PMC12628583 full text | CONFIRMED | Four Italian and three Turkish cultivars at Ordu; 'Nocchione' 52.46% to 'Tombul' 65.74%. Article 25:1596. The full text is available, so the "abstract, truncated" label can be dropped. |
| E7 | Polat Y, et al. 2026 *BMC Plant Biol*: 3 cultivars at 3 altitudes; protein 17.60–22.87% "with a significant genotype × altitude interaction" | PMC12990614 full text | OVERSTATED | Range, design and paper are confirmed (26:487; altitudes 300, 400 and 590 m; one orchard per altitude). The abstract reports "significant genotype × altitude interactions" for the analyses generally, and no protein-specific interaction test was found in the text. Softened: "Protein ran 17.60–22.87% (Çakıldak 590 m to Palaz 590 m); the authors report significant genotype × altitude interactions across traits." |
| E8 | Hakimi, Ṭāhirī, Rahmani 2024 *Genet Resour Crop Evol*: 7 genotypes + 'Jamal', 'Lara', 'Serr', 2019–2022; oil 62.26–70.08%, protein 16.79–21.61%, PUFA 52.05–74.40% | Europe PMC abstract | CONFIRMED | 71:3361–3381. |
| E9 | Liu Z, Li X. 2023 *Crop Sci*: 12 cultivars, 2 Shandong regions, 2019–2020; oil 38.83–56.48%, protein 21.80–31.65%; oil rose with GDD and sunshine | Europe PMC abstract | CONFIRMED | 63:2491–2508. Regions: Yantai and Heze. |
| E10 | Ribeiro SR, et al. 2022 *Food Res Int*: 'Barton' pecans, 6 months; moisture fell in all CA treatments; PV and AV lowest at 10 °C; oxidation volatiles rose in all; total fat not reported as changing | Europe PMC abstract | CONFIRMED | 158:111498. The abstract does not measure total fat at all, so "not reported" is the accurate wording. |
| E11 | Wang G, et al. 2022 *J Food Process Preserv*: irradiation "delay[ed] the reduction of fat" in hazelnuts at 4 °C | not opened | UNVERIFIABLE | The notes give no DOI and the record was not located within budget. Keep it labelled as unverified. |

## F. Vegetable water / dry matter (§6) and the SR28 caution note

| # | Claim | Source opened | Verdict | Note |
|---|---|---|---|---|
| F1 | Table rows (water mean, range, n, DM, CV of DM, solids ratio): iceberg, romaine, celery, zucchini, green pepper, cabbage, mushrooms, onion, carrot, potato, peas, grapes | NUT_DATA.txt | CONFIRMED | Recomputed DM CVs: 0.167, 0.060, 0.115, 0.065, 0.148, 0.073, 0.236, 0.133, 0.210, 0.060, 0.076, 0.060. Ratios: 2.6, 1.3, 1.6, 1.6, 2.0, 1.6, 2.5, 2.1, 1.6, 1.4, 1.2. All these SDs pass Bhatia–Davis (carrot is closest: 2.46 against 2.76). |
| F2 | Cauliflower 92.07 (91.70–93.82; 36), DM CV 0.18 | NUT_DATA.txt | CORRECTION NEEDED | SD 1.45 exceeds the bound of 0.80 (and even half the range, 1.06), so DM CV ≤ 0.10. Replacement row: "Cauliflower \| 92.07 (91.70–93.82; 36) \| 7.93 \| ≤ 0.10 (SE-derived 0.18 is inconsistent with the range) \| 1.3×". The Takeaway's "middle" group should then drop cauliflower ("… iceberg 17%"), with cauliflower moved to "lowest (≤ 10%)". |
| F3 | Takeaway: "The min–max ranges imply 1.6–2.6× differences in solids per gram" | table ratios | CORRECTION NEEDED | Romaine and cauliflower are 1.3×, potato 1.4×, grapes 1.2×. Replacement: "The min–max ranges imply 1.3–2.6× differences in solids per gram between the wettest and driest samples of these vegetables." |
| F4 | Caution: sweet-corn water SD 8.8 against 75.96–81.44 and snap-bean SD 3.5 against 90.27–93.13 contradict their ranges | NUT_DATA.txt | CONFIRMED | Both exceed even half the range (2.74 and 1.43). The Bhatia–Davis maxima are 0.70 and 0.37, because both means sit at the bottom of their ranges. |
| F5 | Broccoli water SD 7.3 (CV_DM 0.68) is inconsistent with its range | NUT_DATA.txt | CONFIRMED | The range is 73.73–91.80 with mean 89.30. SD 7.25 is below half the range (9.0), so a naive check passes, but it exceeds the Bhatia–Davis maximum of 6.24. The notes' first caution bullet gives no range for broccoli; worth adding "(73.73–91.80; the 73.73 minimum is itself an outlier)". |
| F6 | Beets water SD (CV_DM 0.27) is "inconsistent with their ranges or implausible" (§6); Gaps: "internally inconsistent and unusable" | NUT_DATA.txt | OVERSTATED | SR28 11080 (water 87.58, n = 21, SE 0.723) publishes **no min or max**, so it cannot contradict a range. It is only implausibly large (SD 3.3). Softened: "beets (0.27; no range published, SD implausibly large)". In Gaps, change "are internally inconsistent" to "are inconsistent with their ranges (broccoli, snap beans, sweet corn) or implausible (beets)". |
| F7 | Caution list is complete ("For a few foods…") | NUT_DATA.txt | CORRECTION NEEDED | The bound test also fails for SDs the notes *do* use: navel water (B2), cauliflower water (F2), sweet-corn protein (C7), almond water (E2) and potato starch (H6). Add to the caution: "The same check (SD ≤ √((max − mean)(mean − min))) also fails for navel-orange water, cauliflower water, sweet-corn protein, almond water and potato starch; their CVs are upper-bounded as noted where used." |
| F8 | Veerman 2001 in §6: between tubers 79% (1987) and 83% (1988) of total DM variance (cv. Prominent); plants 15% and 9%; field blocks 6% and 8% | Veerman PDF, p. 52 (Ch. 3, Table 3.8, Dataset 4) | CONFIRMED | Verbatim on p. 52. The "blocks" are positions within one commercial field ("praktijkperceel"), not separate plots or lots; worth saying "field blocks within one commercial field". |

## G. Cavendish bananas (§7)

| # | Claim | Source opened | Verdict | Note |
|---|---|---|---|---|
| G1 | No primary data on Cavendish composition by origin or cold-chain duration; PJSIR 1990 and *Horticulturae* 10(4):384 ripening numbers labelled snippet/unverified | not re-searched | not scored | This is a negative search result, and the two numeric items are already labelled unverified. Skipped for budget. |

## H. Potato storage (§8)

| # | Claim | Source opened | Verdict | Note |
|---|---|---|---|---|
| H1 | "Chen, Thompson, Jyoti, Hatterman-Valenti, Abbey, Zhang 2024, *Plants* 13(20):2868" | Crossref and Europe PMC | CORRECTION NEEDED | Four authors only. Replacement: "Chen Z, Thompson AL, Jyoti J, Hatterman-Valenti HM. 2024, *Plants* 13(20):2868." |
| H2 | Chen Table 5 (temperature × month): glucose 8.9 °C 0.34–0.47 for months 1–7, 1.32 at month 10; 7.2 °C 0.92 → 2.44; 5.5 °C 1.01–1.56; sucrose 8.9 °C 0.93–1.25 (2.91 at month 10), 7.2 °C 1.52–4.40 | PMC11511073, Table 5 | CONFIRMED | Every cell matches. Units are mg g⁻¹; no fresh- or dry-weight basis is stated in the text, as the notes say. |
| H3 | Chen Table 4 (cultivar × temperature, glucose): Dakota Diamond 1.92 / 2.15 / 0.51; Dakota Pearl 0.64 / 0.92 / 0.36; NorValley 1.18 / 1.84 / 0.82 | PMC11511073, Table 4 | CONFIRMED | Exact. |
| H4 | Chen Table 1: non-irrigated NorValley glucose 1.79 against 0.77 irrigated; sucrose 1.47–2.65 | PMC11511073, Table 1 | CONFIRMED | Exact. Not every cultivar is higher non-irrigated (Dakota Pearl sucrose is similar), but glucose is higher non-irrigated for all four. |
| H5 | Gikundi EN, Buzera AK, Orina IN, Sila DN. 2023 *Potato Res* 66:137–158: Shangi, Unica, Dutch Robijn, 3 months; weight loss 6.9–35.13% at RT (21.7 °C) against 1.6–3.7% at 7 °C/75% RH; reducing sugars 3.8–9.3-fold (RT) and 26.0–68.5-fold (7 °C); Shangi worst | Europe PMC abstract | CONFIRMED | Exact. |
| H6 | SR28 11352: starch 15.29 (10.54–18.10; n = 11; CV 0.33); sugars 0.82 (0.50–1.60; n = 5); water 79.25 (77.70–83.92) | NUT_DATA.txt | CORRECTION NEEDED | The values reproduce, but starch SD 5.06 exceeds the bound of 3.65 (CV ≤ 0.24). Replacement: "starch 15.29 g/100 g (10.54–18.10; n = 11; the SE-derived CV of 0.33 exceeds what the range allows, ≤ 0.24)". The §8 inference should read "SR28's starch spread (10.5–18.1 g/100 g, CV up to about 0.24) is far larger than storage effects." |
| H7 | Gikundi EN, et al. 2024 *Foods* 13(5):652: 4 °C for 30 days then 22 °C; mg/100 g FW; fry glucose threshold ≤ 22 mg/100 g; chips ≈ 14; cited study 333 → 32 mg/100 g after 2 weeks | PMC10930719 full text | CONFIRMED | Exact. The cited study is Kumar & Ezekiel (stored at 10–12 °C, reconditioned at 20 °C). The abstract gives the critical ranges as 12–22 (fries) and 8–14 mg/100 g (chips). |
| H8 | Broćić et al. 2016 *Potato Res* 59:21–34: 10 cultivars, 3 Serbian sites, 2001–2002, 7 months at 3–4 °C; DM > 19% except Jaerla and Condor; DM rose (quote); starch in DM fell; Frisia, Red Star, Agria low weight loss; no numbers | Europe PMC abstract | CONFIRMED | Exact, including the quotation. Sites: Sombor, Čačak, Guča. |
| H9 | Inference: 2 + 2 + 3 mg/g sugars ≈ 0.7 g/100 g | arithmetic | CONFIRMED | 7 mg/g = 0.7 g/100 g. |

## I. Apples (§9)

| # | Claim | Source opened | Verdict | Note |
|---|---|---|---|---|
| I1 | Ferreira C, Ribeiro C, Nunes FM. 2024 *Molecules* 29(13):2954: GD and RD, 5 months, 2 °C / 90% RH, NA / CA (3 kPa O₂, 1 kPa CO₂) / 1-MCP + CA, n = 5 | PMC11243091 full text | CONFIRMED | Matches. |
| I2 | "Table 1, harvest → NA / CA / 1-MCP + CA" with malic acid, total sugars, sucrose, glucose, fructose and TSS rows | PMC11243091, Tables 1 and 2 | CORRECTION NEEDED (source location only) | Every number matches, but malic acid and sugars come from **Table 2** (g/kg); only TSS is from Table 1. Replacement: "Tables 1 (TSS) and 2 (malic acid, sugars, g/kg), harvest → NA / CA / 1-MCP + CA". The 12% (GD) and 18% (RD) CA malic-acid drops are verbatim. |
| I3 | Takeaway: "Total sugars fell 10–32% depending on atmosphere" | PMC11243091, Table 2 | CORRECTION NEEDED | GD under 1-MCP went 70.7 → 70.1 (−1%, "remained unchanged"). The other cells: GD NA −32%, CA −10%; RD NA −26%, CA −10%, 1-MCP −21%. Replacement: "Total sugars fell 10–32% under NA or CA and 21% in RD under 1-MCP, but were unchanged in GD under 1-MCP." The inference "at most about 10–30%" should read "0–32%". |

## J. Montenegro potato paper (§10 Claim A)

| # | Claim | Source opened | Verdict | Note |
|---|---|---|---|---|
| J1 | Three-year mean DM: Agria 25.46% (highest), Desiree 25.33%, Kennebec 25.13%, Almera 20.82% (lowest) | UDG EmpowerHR4Inno record (abstract); search snippet of Plantarum record | CONFIRMED (abstract level) | All four values match the abstract. The full text is still unreachable (doiSerbia host refuses connections; the other repositories have a CAPTCHA). |
| J2 | Design: 8 cultivars (Riviera; Almera, Aladin, Bounty; Agria, Margarita, Kennebec, Desiree), Nedakusi 556 m, Sutivan 680 m, Orahovica 900 m, 2015–2017, RCBD × 3; significance for yield components; DM not split by year or site in the abstract | UDG record | CONFIRMED | Exact. The abstract also says acid brown soil, and gives yields of 31.41 / 21.35 / 17.36 t/ha by site. |
| J3 | "Balijagić J, Zečević V, Đurić N, Arslanović-Lukač S, Poštić D. 2021 … The DOI prefix indicates *Genetika* (Belgrade), but the journal name was not confirmed" | Crossref record for 10.2298/GENSR2101305A | CORRECTION NEEDED | The publisher-deposited metadata gives the author order Arslanović-Lukač S, Đurić N, Zečević V, Balijagić J, Poštić D, and the journal *Genetika* 53(1):305–322 (2021). The UDG order is a repository artefact. Replacement: "**Record:** Arslanović-Lukač S, Đurić N, Zečević V, Balijagić J, Poštić D. 2021, 'The effect of year and genotype on productivity and quality of potato', *Genetika* (Belgrade) 53(1):305–322, doi:10.2298/GENSR2101305A (author order and journal per Crossref; one repository lists Balijagić first)." Elsewhere, cite it as "Arslanović-Lukač et al. 2021", not "Balijagić et al. 2021". |

## K. Veerman 2001 thesis (§10 Claim B)

| # | Claim | Source opened | Verdict | Note |
|---|---|---|---|---|
| K1 | Veerman A. 2001, *Variatie in knolkwaliteit tussen en binnen partijen van consumptieaardappelrassen*, PhD thesis, Wageningen University, 253 pp.; promotor P.C. Struik; research 1988–1994 at PAGV Lelystad | Veerman PDF (title page, p. 9 abstract, colophon) | CONFIRMED | 253 pp., promotor Prof. dr. ir. P.C. Struik, and "The research described in this thesis (1988-1994) was conducted at Applied Plant Research … Lelystad" (PPO, the successor of PAGV; field sites included PAGV). Note: Dataset 4 (cv. Prominent) includes a 1987 experiment, so "1987–1994" would describe the data more accurately. |
| K2 | Abstract: "Depending on characteristic, about 10 to 40 % was accounted for by cultivar"; N and K 0–10%; "The major part of variance was caused by environmental influences related to the factors location, year and their interactions" | Veerman PDF, p. 9; English Summary | CONFIRMED | Verbatim. The correction from 10–30% to 10–40% is right; the Summary repeats "10 to 40 %". |
| K3 | "The greater part of the variance was found within rather than between experimental plots"; tubers from the same stems = "80 to 90 % of total variance found within potato lots" | Veerman PDF, p. 9 | CONFIRMED | Verbatim. The English Summary (p. 234) phrases it as "80 to 90 % of the variance within experimental units was caused by tubers originating from individual plants and even from individual stems". The notes' correction to plant-macros.md (within lots, not total variance) is right. |
| K4 | Ch. 3: 79–99% (Dataset 1) and 82–97% (Dataset 2) of underwater-weight variance within experimental units | Veerman PDF, Ch. 3 discussion (and the results text for Table 3.6) | CONFIRMED | "het overgrote deel van de variantie (resp. 79 - 99 en 82 - 97 %) binnen de experimentele eenheden". |
| K5 | cv. Prominent (Dataset 4): between tubers 79% / 83%, plants 15% / 9%, blocks 6% / 8%; between-tuber share 59% (July) → 83% (September 1988) | Veerman PDF, p. 52 and Table 3.8 | CONFIRMED | Verbatim. The 59 → 83% is the share "between tubers of the same plant" over the 1988 season. |
| K6 | Management: −100 kg N/ha raised DM by about 0.4 points; spring K₂SO₄ −0.3 to −0.5; KCl almost −0.4 more; cultivar × location × year significant | Veerman PDF, Summary p. 234 | CONFIRMED | Verbatim. The N cut is relative to the recommended rate for cv. Bintje ("consistent over other cultivars"); −50 kg N/ha "hardly increased" DM. |

## Skipped (budget) or not scored

These items are labelled "(snippet, unverified)" in the notes and were not re-opened. They should stay labelled, or be
dropped from any report:
- Marmara OUCI record
- Muñoz-Robredo 2011
- Karnataka *Plant Archives* 2024
- *Horticulturae* 8(7):570
- PMC9689076 (Gannan navel)
- J-STAGE JJSHS 54(2)
- Çukurova early mandarins
- PHTnet wx431 sweet-corn thesis
- *Front Plant Sci* 2024 10.3389/fpls.2024.1453031
- *Genes* 17(3):291
- IPM "A Moment of Science" (popular source, already labelled)
- Kennebec microtubers (BF02357613)
- s11540-025-09875-9
- J Am Pomol Soc PDF
- §7 banana snippets
- Wang 2022 (scored UNVERIFIABLE above)

The "13.5–18.3 °Brix across 26 cultivars" in §9 comes from `plant-macros.md` and is outside this file's scope.

## Verdict counts (68 claims scored)

- **CONFIRMED: 46.** A1–A3, A5, A6, B1, B3, B4, B6, C1, C2, C5, C6, C9, D1–D4, E1, E3–E6, E8–E10, F1, F4, F5, F8, H2–H5, H7–H9, I1, J1, J2, K1–K6. Several carry optional precision notes: A2, C9, D1, D3, E6, F5, F8, K1.
- **CORRECTION NEEDED: 18.** A4, B2, B7, C3, C4, C7, C8, C10, D5, E2, F2, F3, F7, H1, H6, I2, I3, J3.
- **OVERSTATED: 3.** B5, E7, F6.
- **UNVERIFIABLE: 1.** E11.

Not scored: G1 (§7 negative search) and the snippet items listed above.
