# Label accuracy, database disagreement and energy uncertainty

(Cost-limited run: 6 web searches, no page fetches; figures come from search snippets/summaries. Verify against primary papers before quoting.)

## 1. Declared vs measured values (label-accuracy studies)

### Takeaway
Urban et al. 2010 found measured energy above stated energy: about +18% for restaurant items and about +8% for frozen supermarket meals, with very wide spread. The Jumpertz 2013 paper could not be confirmed from these searches; a secondary review says 96% of US snack items were within 20% of label.

### Cited Findings
- Urban et al. 2010 (J Am Diet Assoc): 29 restaurant items measured about 18% above stated energy; individual items up to 200% of stated; free sides raised energy to about 245% of the stated value of the entree. — [ScienceDaily](https://www.sciencedaily.com/releases/2010/01/100105100021.htm); [Tufts](https://now.tufts.edu/2010/01/06/study-examines-calorie-information-restaurants-packaged-foods)
- Same study: 10 frozen supermarket meals averaged about 8% above label. Authors tied the smaller gap to FDA oversight. Differences were not statistically significant given the large variability and small sample. — [Tufts](https://now.tufts.edu/2010/01/06/study-examines-calorie-information-restaurants-packaged-foods); [FoodNavigator](https://www.foodnavigator.com/Article/2010/01/06/Low-calorie-foods-could-contain-more-energy-than-labels-state/)
- A review in a Cambridge journal, citing Jumpertz, reports popular US snacks had on average higher energy than labelled, but for 96% of items the label was within 20% of measured. — [Cambridge core reader](https://www.cambridge.org/core/product/44E6DBCA1388414E5201EBF0C67C23FD/core-reader) (secondary; only a search summary)
- Blog posts (Nutrola) give conflicting accounts of Jumpertz (bomb calorimetry, +8% vs metabolic chamber, 8-15%). Treat as unreliable. — [Nutrola](https://nutrola.app/en/blog/nutrition-label-vs-lab-test-how-accurate-are-packaged-food-labels); contradicted by [Nutrola 2](https://nutrola.app/en/blog/can-you-trust-calorie-counts-on-nutrition-labels)

### Inferences
- Gaps are skewed positive (actual > label), consistent with tolerance rules that penalise overstatement of energy less than... (see section 2: upper limit 120% for calories) and with restaurant portions having no regulated limit. Spread is large (item-level up to 3x), so a mean of +8 to +18% hides big outliers.

### Gaps
- Original Jumpertz 2013 (Obesity) sample size, mean and SD not retrieved.
- Vitamin/supplement-above-label studies and EU/national surveillance numbers (declared vs measured) not found in this run.
- Restaurant calorie labelling in England 2024 (LJMU paper surfaced in results) not read.

## 2. Legal tolerances

### Takeaway
US: calories, sugars, fat, sat fat, cholesterol, sodium must not exceed 120% of label; naturally occurring vitamins, minerals, protein, carbs, fibre must be at least 80%; added (Class I) nutrients must be at least 100%. EU 2012 guidance: vitamins +50%/-35% (supplements +50%/-20%). Rules bias toward vitamin overages and permit energy overages.

### Cited Findings
- FDA 21 CFR 101.9(g): Class II naturally occurring nutrients out of compliance if composite is below 80% of label; Class I added nutrients must be at least 100%; calories, sugars, total/sat fat, cholesterol, sodium noncompliant above 120%. Test uses a composite of 12 subsamples from randomly chosen cases. — [FDA law blog](https://www.thefdalawblog.com/2015/08/fda-guidance-regarding-nutrition-labeling-regulations-for-small-amount-of-nutrients-and-dietary-ingr/); [FDA database guide](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-industry-guide-developing-and-using-data-bases-nutrition-labeling); [FDA warning letter](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/evimeria-el-aztecano-inc-624797-11162022)
- Using a database to derive label values is voluntary; FDA does not prescribe method. — [FDA database guide](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-industry-guide-developing-and-using-data-bases-nutrition-labeling)
- Rounding under 101.9(c) can push small amounts outside the 20% window (e.g. 0.75-0.79 g rounded to 1.00 g). — [FDA law blog](https://www.thefdalawblog.com/2015/08/fda-guidance-regarding-nutrition-labeling-regulations-for-small-amount-of-nutrients-and-dietary-ingr/)
- EU Dec 2012 guidance: vitamins +50%/-35% (non-supplement foods; table also shows +45%/-35% for another category), food supplements +50%/-20%; includes measurement uncertainty; no formal legal status. — [FSAI](https://www.FSAI.ie/getmedia/71c87819-77a7-4bf2-b741-2f11cf019c2d/EU-guidance-tolerances.pdf); [BDA appendix 11](https://www.bda.uk.com/practice-and-education/resources-for-practice/the-nutrition-and-hydration-digest/appendices/appendix-11-tolerances.html); [Ruokavirasto](https://www.ruokavirasto.fi/en/foodstuffs/food-sector/food-information/labelling/nutrition-labelling/tolerances-for-nutrients/)

### Inferences
- Asymmetric limits (80% floor, 120% cap for "bad" nutrients; added vitamins floor at 100%) explain why measured vitamins in fortified foods exceed label and why companies declare conservatively.

### Gaps
- EU energy and macronutrient tolerances (e.g. 8 g/100 g rules, +-20%) not confirmed in snippets; check the FSAI/EC PDF.

## 3. Disagreement between food composition databases

### Takeaway
Only qualitative evidence found: macronutrients and energy agree fairly well across databases; vitamins A, C, calcium, iron and fibre/starch-related values diverge more. No numbers for USDA vs CoFID vs BLS vs Open Food Facts.

### Cited Findings
- EuroFIR comparison of Greek, Belgian and US databases: protein, carbohydrate, fat close; vitamins A, C, calcium, iron differed much more; causes cited: data sources, analytical methods, food origin, coding conventions. — [EuroFIR](https://www.eurofir.org/risks-of-using-the-wrong-food-composition-databases-in-nutrition-research/)
- Calculation approaches (and energy factors applied to carbohydrate) give different values for foods with fibre or complex starch. EPIC data: small but significant differences between US and European tables for energy and macronutrient intakes, strong agreement for energy and total fat. — [Measurement toolkit](https://measurement-toolkit.org/diet/introduction/food-composition)
- CoFID values largely from composite studies plus literature; BLS covers >15,000 foods from German institutes and producers. — [SpecPage BLS](https://help.specpage.com/SpecPDM/en/bls_lieferant_zuordnen.htm)

### Inferences
- Expect energy differences of a few percent for simple foods but larger gaps from fibre definition, Atwater general vs specific factors and carbohydrate by difference vs available carbohydrate (reasoned, not sourced numerically here).

### Gaps
- No quantified per-food cross-database comparison; nothing on Open Food Facts / crowdsourced error rates; brand-to-brand variability not found.

## 4. Uncertainty of energy itself

### Takeaway
Novotny et al. 2012 measured almonds at 4.6 +- 0.8 kcal/g (129 kcal per 28 g) versus about 6.0-6.1 kcal/g by Atwater, i.e. Atwater overestimates by 32% (measured is about 24% lower). Processing matters: ground almonds/almond butter gave more energy than whole.

### Cited Findings
- 18 adults, crossover, 0/42/84 g/d almonds, energy from urine and faeces; ME 4.6 +- 0.8 kcal/g vs Atwater 6.0-6.1; 32% overestimate. — [PMC3396444](https://pmc.ncbi.nlm.nih.gov/articles/PMC3396444); [USDA](https://www.usda.gov/about-usda/news/blog/going-nuts-calories)
- Gebauer 2016 follow-up: processing (roasting, chopping, grinding) effects; almond butter had more metabolisable energy than whole almonds. — [RSC Food & Function 2016](https://pubs.rsc.org/en/content/articlehtml/2016/fo/c6fo01076h); [Farm Progress](https://www.farmprogress.com/tree-nuts/almonds-pack-far-fewer-calories-than-thought)

### Inferences
- High-fibre, intact-cell-wall foods (nuts, whole grains, legumes) are the main candidates for label overstatement of energy; this partly offsets the positive measured-vs-label bias in section 1.

### Gaps
- Other nuts (walnut, pistachio), FAO/INFOODS conversion-factor reports, and cooked/processed starch digestibility figures not retrieved.
