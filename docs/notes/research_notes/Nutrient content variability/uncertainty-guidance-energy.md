# Official guidance on food-composition uncertainty, and the uncertainty of food energy values

Main sources fetched directly:
- **G&S 2003**: Greenfield H, Southgate DAT. *Food composition data: production, management and use*, 2nd ed. FAO, Rome, 2003. Online at https://www.fao.org/4/y4705e/y4705e00.htm (chapters are separate pages, e.g. ch. 5 = y4705e10.htm, ch. 8 = y4705e13.htm, ch. 9 = y4705e14.htm, ch. 11 = y4705e16.htm, Appendix 2 = y4705e19.htm).
- **FAO 2003**: FAO. *Food energy – methods of analysis and conversion factors*. Report of a technical workshop, Rome, 3–6 Dec 2002. FAO Food and Nutrition Paper 77, 2003. Chapter 3: https://www.fao.org/4/y5022e/y5022e04.htm
- Human feeding studies from USDA-ARS Beltsville (Novotny, Baer, Gebauer). Abstracts and the almond full text were retrieved from Europe PMC.

## 1. What G&S 2003 / FAO-INFOODS, EuroFIR and analytical-QA literature say about natural variability, sampling, sample numbers and the uncertainty of table values

### Takeaway
The FAO/INFOODS reference text treats any table value as an estimate of a mean, not a prediction for the food in front of you. It says a database "is unlikely to predict within narrow limits the composition of a particular sample of food" and is "at best, an approximate quantitative guide" for nutrients such as vitamin C, folate and sodium. It gives no single CV for table values. Its own worked example shows that the usual ~10 samples are too few to bring the mean within ±10% for fat (37 needed) or cholesterol (76 needed). Analytical (between-lab) error for major constituents is usually only a few percent (Horwitz: about 3–4% at g/100 g levels). Natural and sampling variation is typically larger.

### Cited Findings
**Natural variability (G&S 2003)**
- "All foods are biological materials and exhibit natural variations in composition." The listed sources of variation are geography (soil, climate), season ("Plant foods are especially prone to variation, particularly in their water, carbohydrate and vitamin content"; fish fat varies by season), maturity, cultivar/breed, and soil and fertiliser — [G&S 2003 ch. 5 "Sampling"](https://www.fao.org/4/y4705e/y4705e10.htm)
- Protein content in cereals "can vary by a factor of two, depending on variety and fertilizer usage". "Composite dishes show the greatest variations in composition". Even an ideal database "would only predict the expected range of composition for any individual food" — [G&S 2003 ch. 11 "Guidelines for the use of food composition data"](https://www.fao.org/4/y4705e/y4705e16.htm)
- "A database is unlikely to predict within narrow limits the composition of a particular sample of food". "For some nutrients, a database is, at best, an approximate quantitative guide", with vitamin C, folates and sodium as examples. Studies comparing analysed with calculated diets gave "greatly varying findings" — [G&S 2003 ch. 11](https://www.fao.org/4/y4705e/y4705e16.htm)
- Using another country's table is a further source of error. UK and US tables overestimated the fat in Australian meat by about 60%. In EPIC, treating missing values as zero changed dietary fibre intakes by up to 25% — [G&S 2003 ch. 11](https://www.fao.org/4/y4705e/y4705e16.htm)
- On precision: "Because foods vary in composition, it is also fundamentally incorrect to cite values that imply that the composition is defined to a higher level than its natural variation." "Because it is rare to measure proximate or major constituents to an accuracy greater than 1 percent, three significant figures are a maximum." Energy should be reported to at most 3 significant digits, limited to 1 kJ/kcal (Table 9.1) — [G&S 2003 ch. 9 "Conventions and modes of expression"](https://www.fao.org/4/y4705e/y4705e14.htm)

**Sampling and number of samples (G&S 2003)**
- "Most sampling schemes adopt a standard of at least ten units". US nutrition-labelling data must be based on 12 units. "Many nutrients, especially vitamins, show greater variability than, say, protein, so the number of samples required formally will be greater". The calculation assumes a uniform distribution, which is "often not true for trace elements". A primary sample of 100–500 g is suggested. Duplicate analytical portions are "the minimum acceptable" — [G&S 2003 ch. 5](https://www.fao.org/4/y4705e/y4705e10.htm)
- Appendix 2 gives the sample-size formula (after Proctor & Meullenet 1998): n = t²(α, n−1) · SD² / (accuracy × mean)², where accuracy 0.1 means the sample mean is within 10% of the population mean at 95% confidence. Worked example (Table A2.1, 24 samples of retail French fries; Greenfield, Makinson & Wills 1984):
  - moisture: mean 49.9 g/100 g, SD 8.5 (CV ≈ 17%)
  - fat: mean 13.4, SD 3.9 (CV ≈ 29%)
  - cholesterol: mean 16, SD 6.7 (CV ≈ 42%; units as printed in the table)

  Samples needed for ±10% accuracy: 13 (moisture), 37 (fat), 76 (cholesterol). For ±5%: 50, 146 and "over 300". The text says "ten samples (a commonly used sample size) would be inadequate … in any of the three cases" and "In practice most designers of sampling protocols have to make intuitive judgements" — [G&S 2003 Appendix 2 "Calculation of sample size"](https://www.fao.org/4/y4705e/y4705e19.htm)
- Compositional data "can only be an estimate of the composition of the food". Analysing primary samples individually helps define confidence limits for the mean — [G&S 2003 ch. 5](https://www.fao.org/4/y4705e/y4705e10.htm)

**Analytical quality (G&S 2003)**
- On how much precision to pursue: "improvement to values that fall within less than 10 percent of the mean may be unnecessary". Precision targets should depend on the method and the expected nutrient level. Recoveries above 90% are needed for a method to count as satisfactory. Proximate components summing to 97–103% of sample weight are "generally acceptable". Within-lab variation should be no larger than between-lab variation — [G&S 2003 ch. 8 "Assuring the quality of analytical data"](https://www.fao.org/4/y4705e/y4705e13.htm)
- On energy: "It is important not to imply great accuracy in the citation of energy values." The text says the convention rests on "questionable assumptions":
  - the gross energy of different proteins, fats and carbohydrates is constant across foods
  - apparent digestibility accurately indicates available energy
  - digestibility coefficients are constant across foods
  - "Digestibility does not vary significantly among individuals"

  — [G&S 2003 ch. 9](https://www.fao.org/4/y4705e/y4705e14.htm)
- Carbohydrate "by difference" is "an unsatisfactory expression that should be phased out (FAO/WHO, 1998)". It "includes all the non-carbohydrate material not analysed in the other proximate analyses and the cumulative errors from the other measurements" — [G&S 2003 ch. 9](https://www.fao.org/4/y4705e/y4705e14.htm)

**Analytical (between-lab) uncertainty: Horwitz**
- The Horwitz equation for predicted among-laboratory relative SD is PRSD_R(%) = 2·C^(−0.15), where C is a mass fraction. HorRat = observed RSD_R / PRSD_R. It is "more or less independent of analyte, matrix, method". It is an acceptability criterion for AOAC, EU, CEN and NMKL food methods. Values below 0.5 or above 2 are flagged. Horwitz W, Albert R. J AOAC Int 2006;89(4):1095–1109, doi:10.1093/jaoac/89.4.1095 — [Europe PMC record](https://europepmc.org/article/MED/16915851) / [DOI](https://doi.org/10.1093/jaoac/89.4.1095)
- The Horwitz curve "does not effectively predict the results of dietary fiber collaborative studies", so HorRat should not be used to accept or reject fibre methods. Wehling P, DeVries JW. J AOAC Int 2012;95:1541–1546, doi:10.5740/jaoacint.12-078 — [DOI](https://doi.org/10.5740/jaoacint.12-078)
- The UK Food Standards Agency describes HorRat values of 0.5–2 as generally acceptable — [FSA](https://www.food.gov.uk/print/pdf/node/16231). This comes from a search summary; I did not fetch the page.

**EuroFIR**
- EuroFIR's quality framework, described by Westenbrink and co-authors, harmonises food description, component identification, value documentation, recipe calculation, quality evaluation of values, and assessment of analytical methods. The EuroFIR Nexus work on measurement uncertainty follows the GUM. Its simplest route starts from the repeatability and reproducibility SDs of official methods, then checks that internal QC covers sample preparation — [INSA repository (EuroFIR Nexus MU work)](https://repositorio.insa.pt/entities/publication/d418e725-6e36-4539-8c7a-1c998978d9f7/full); [Quadram: "EuroFIR quality approach … where are we in 2014?"](https://quadram.ac.uk/publications/eurofir-quality-approach-for-managing-food-composition-data-where-are-we-in-2014/). Both come from search summaries only; I did not read the full text.
- Bastide et al. (2nd IMEKOFOODS, 2016) apply JCGM/GUM propagation of uncertainty to recipe calculation. They note "there is today no reported method in food composition data" for handling remaining variability and uncertainty in recipe calculation — [IMEKO TC23-2016-013](https://imeko.org/publications/tc23-2016/IMEKO-TC23-2016-013.pdf)

### Inferences
- My calculation from Horwitz & Albert's equation gives the following expected between-lab RSD:

  | Level in food | Mass fraction C | Expected RSD | Example |
  |---|---|---|---|
  | 10 g/100 g | 0.1 | ≈2.8% | protein |
  | 1 g/100 g | 0.01 | ≈4.0% | |
  | 10 mg/100 g | 1e-4 | ≈8% | vitamin C range |
  | 0.1 mg/100 g | 1e-6 | ≈16% | |

  Natural CVs in the G&S example are 17–42%, so for macronutrients, natural and sampling variability usually dominates analytical error. For trace nutrients, analytical error is a meaningful extra share.
- Because G&S say ~10 units is the norm, and their own example needs 13–76 units for ±10%, a typical table mean may realistically be uncertain by more than ±10% for fat in variable foods. For any single item eaten, the uncertainty is the full natural spread (SD), not the standard error of the mean.
- Carbohydrate by difference carries the accumulated error of the water, protein, fat and ash measurements. This affects energy wherever carbohydrate is computed that way.

### Gaps
- G&S 2003 gives no single "expected CV of table values" by nutrient. The only numeric variability example is the French fries table.
- I did not fetch a primary EuroFIR guideline document on expressing uncertainty (for example, the EuroFIR data quality / value documentation guidelines or the "Methods to Express Dispersion" poster). EuroFIR statements above come from repository summaries.
- I found no systematic study fetched here that directly partitions analytical vs natural variance across many foods. Proficiency-testing data specific to food-composition labs (for example, FAPAS nutrient rounds) were not retrieved.
- The FAO/INFOODS "Guidelines for checking food composition data" and Rand et al. (1991) *Compiling data for food composition data bases* (INFOODS) were not fetched.

## 2. Energy conversion systems (FAO 2003): general vs specific Atwater, ME vs NME, fibre, carbohydrate definitions

### Takeaway
Under FAO 2003, using Atwater specific factors instead of general factors shifts total diet energy by only a few percent (about −3% to +2%). Switching to net metabolisable energy (NME) lowers mixed-diet energy by about 4–6%, and by up to 24–27% for high-protein or high-fibre foods. FAO recommends staying with ME for now. FAO puts the "typical error for practical purposes" at about 5%.

### Cited Findings
All from [FAO 2003, ch. 3 "Calculation of the energy content of foods – energy conversion factors"](https://www.fao.org/4/y5022e/y5022e04.htm):
- **General Atwater factors (§3.5.1).** Protein 17 kJ/g (4 kcal/g), fat 37 kJ/g (9), carbohydrate 17 kJ/g (4), alcohol 29 kJ/g (7). There is a single factor per substrate regardless of food. Carbohydrate "is determined by difference, and thus includes fibre."
- **Extensive general system (§3.5.2).**
  - Available carbohydrate as monosaccharide equivalents: 16 kJ/g (3.75 kcal/g), from Southgate & Durnin 1970.
  - Dietary fibre: 8 kJ/g (2 kcal/g), recommended by FAO 1998 but "has not yet been implemented".
  - Polyols 10 kJ/g (2.4 kcal/g); organic acids 13 kJ/g (3 kcal/g).
- **Atwater specific factors (§3.5.3).** These come from Merrill & Watt 1955. Protein factors range from 10.2 to 18.2 kJ/g (2.44–4.36 kcal/g), fat from 35 to 37.7 kJ/g, and carbohydrate from 11.3 to 17.4 kJ/g. The system "may not be vastly superior" to the extensive general system.
- **Specific vs general factors.** The difference per macronutrient is:

  | Macronutrient | Specific vs general factor | Effect on total diet energy |
  |---|---|---|
  | Protein | −2% to +9% | ≈1% (15% energy-from-protein diet) |
  | Fat | −5% to +2% | −2% to +0.8% (40% fat diet) |
  | Carbohydrate | −6% to +3% (most major foods) | −3% to +1.5% (50% carbohydrate diet) |

  Chocolate's carbohydrate factor varies more than threefold. Dietary fibre energy ranges from 0 to 8 kJ/g across common foods. There are 975 theoretical combinations of component definitions, so "a more uniform system is needed".
- **Carbohydrate weight vs monosaccharide equivalents.** 100 g glucose, 105 g disaccharide and 110 g starch each contain 100 g anhydrous glucose. This is why the factors are 16.7 kJ/g by weight but 15.7 kJ/g as monosaccharide equivalents.
- **NME system (§3.5.4).** NME subtracts fermentation losses and obligatory thermogenesis from ME. Relative to ME:
  - Protein 13 kJ/g (3.2 kcal/g), 24% below 17 kJ/g.
  - Fibre 6 kJ/g (1.4 kcal/g) in conventional foods, 25% below 8 kJ/g.
  - Fermentable fibre 8 vs 11 kJ/g.
  - Alcohol 26 vs 29 kJ/g, 10% lower.
- **Size of the ME vs NME gap.**
  - Mixed diets: about 4–6% lower energy under NME than general Atwater. Table 3.5 diets range from about 2% to 18.6% lower; the largest gaps are in high-protein, high-fibre and therapeutic diets.
  - Food balance sheets: ME general factors are 2–5% above NME.
  - Infant formulas: 3–5% lower for milk-based, 0–2% for soy-based.
  - Baby foods: from 2% (apple sauce) to 9% (chicken with gravy).
  - Individual foods: minimal for low-protein, low-fibre foods, but up to 24% (protein) and 27% (fibre supplements).
  - "Typical error for practical purposes is about 5%".
- **Recommendation (§3.6, conclusion).** "The continued use of ME rather than NME factors is recommended for the present", because "the problems and burdens ensuing from such a change would appear to outweigh by far the benefits." Energy requirements are ME-based (doubly labelled water, calorimetry). Harmonising carbohydrate definitions matters as much as the factors themselves.
- G&S 2003 adds that Merrill & Watt-type specific factors address variation in heat of combustion and digestibility between foods. They do not address the assumptions that apparent digestibility reflects available energy, or that digestibility does not vary between individuals — [G&S 2003 ch. 9](https://www.fao.org/4/y4705e/y4705e14.htm)

### Inferences
- For a typical mixed diet, the choice of conversion system moves the kcal figure by roughly 2–6%. For individual foods rich in protein, fibre or polyols, the gap can reach about 25%.
- Carbohydrate defined by difference and multiplied by 4 kcal/g counts fibre at 4 kcal/g, versus about 2 kcal/g (ME) or 1.4 kcal/g (NME). For a food with 10 g fibre/100 g, that is about 20–26 kcal/100 g of difference. This is my arithmetic from the factors above.

### Gaps
- I did not fetch FAO 2003 chapter 2 (analytical methods for carbohydrate and fibre) or Table 3.5 itself. The figures above come from the chapter text as extracted.

## 3. Measured metabolisable energy vs label/Atwater for whole foods (nuts, processing, cooking/starch, microbiome)

### Takeaway
Controlled human feeding studies at USDA Beltsville found that Atwater factors overestimate the ME of tree nuts:

| Nut | Overestimate |
|---|---|
| Almonds | 32% |
| Walnuts | 21% |
| Cashews | 16% |
| Pistachios | 5% |

Food form matters. Almond butter matched the Atwater prediction (6.53 kcal/g), while whole natural almonds gave only 4.42 kcal/g.

### Cited Findings
- **Almonds.** Measured ME was 4.6 ± 0.8 kcal/g (129 kcal per 28 g), against 6.0–6.1 kcal/g (168–170 kcal) by Atwater specific and general factors, a 32% overestimate. There were 18 adults in a crossover design at 0, 42 and 84 g/d, with 9-day urine and faeces collections. The USDA SR specific factors for nuts are 3.47 (protein), 8.37 (fat) and 4.07 (carbohydrate) kcal/g. An 84 g/d dose lowered whole-diet energy digestibility by about 5%. Novotny JA, Gebauer SK, Baer DJ. Am J Clin Nutr 2012;96(2):296–301, doi:10.3945/ajcn.112.035782 — [PMC3396444](https://pmc.ncbi.nlm.nih.gov/articles/PMC3396444/)
- The same paper notes that the Atwater/Merrill-Watt specific factors historically used protein digestibility coefficients of 20–97% and carbohydrate coefficients of 32–98%. Fat coefficients were narrow (90–95%), and nuts were assigned 90% fat digestibility — [PMC3396444](https://pmc.ncbi.nlm.nih.gov/articles/PMC3396444/)
- **Walnuts.** 146 kcal per 28 g (5.22 kcal/g) vs 185 kcal (6.61 kcal/g) calculated, 21% lower (P < 0.0001). n = 18, crossover, 42 g/d. Baer DJ, Gebauer SK, Novotny JA. J Nutr 2016;146(1):9–13, doi:10.3945/jn.115.217372 — [DOI](https://doi.org/10.3945/jn.115.217372)
- **Pistachios.** 22.6 kJ/g vs 23.7 kJ/g by Atwater general factors, 5% lower. n = 16, 0/42/84 g/d. Baer DJ, Gebauer SK, Novotny JA. Br J Nutr 2012;107(1):120–125, doi:10.1017/S0007114511002649 — [DOI](https://doi.org/10.1017/S0007114511002649)
- **Cashews.** 137 kcal per 28 g (±3.4 SEM), 16% below labels (P < 0.0001), with individuals ranging from 105 to 151 kcal per serving. Diet energy digestibility was 92.9% with cashews vs 94.9% control, and fat digestibility 96.1% vs 97.8%. Baer DJ, Novotny JA. Nutrients 2019;11(1):33, doi:10.3390/nu11010033 — [PMC6356908](https://pmc.ncbi.nlm.nih.gov/articles/PMC6356908/)
- **Processing (almonds).** Five-period crossover, n = 18, 42 g/d. Measured ME:

  | Almond form | ME (kcal/g) |
  |---|---|
  | Whole natural | 4.42 |
  | Whole roasted | 4.86 |
  | Chopped | 5.04 |
  | Almond butter | 6.53 |

  Almond butter was not different from the Atwater prediction (P = 0.08). Roasted almonds were softer (298 vs 345 N fracture force), and whole natural almonds fractured into fewer, larger particles, limiting lipid release. "The amount of calories absorbed from almonds is dependent on the form in which they are consumed." Gebauer SK, Novotny JA, Bornhorst GM, Baer DJ. Food Funct 2016;7(10):4231–4238, doi:10.1039/c6fo01076h — [DOI](https://doi.org/10.1039/c6fo01076h)
- **Cooking.** A review argues that cooking raises net energy value through starch gelatinisation, protein denaturation, and lower digestion and defence costs. It gives mechanisms rather than human ME percentages. Carmody RN, Wrangham RW. J Hum Evol 2009;57(4):379–391, doi:10.1016/j.jhevol.2009.02.011 — [DOI](https://doi.org/10.1016/j.jhevol.2009.02.011)
- **Diet structure and microbiome (controlled metabolic ward).** A high-fibre, minimally processed "Microbiome Enhancer Diet" led to 116 ± 56 kcal/d more faecal energy loss than a calorie-matched Western diet. Host ME was 89.5% (range 84.2–96.1%) vs 95.4% (range 94.1–97.0%). Interindividual variability on the high-fibre diet was "substantial" and partly explained by faecal SCFAs and microbial biomass. Corbin KD et al. Nat Commun 2023;14:3161, doi:10.1038/s41467-023-38778-x — [PMC10232526](https://pmc.ncbi.nlm.nih.gov/articles/PMC10232526/)

### Inferences
- For whole nuts, label energy (Atwater) is systematically high by 5–32% depending on the nut. Food form matters as much as composition: almond butter is about 48% more available energy per gram than whole natural almonds (6.53 vs 4.42).
- A whole-diet fibre and processing contrast moved absorbed energy by about 6 percentage points (89.5% vs 95.4%), which is larger than the general vs specific Atwater differences.

### Gaps
- I did not retrieve primary human ME data for cooked vs raw starch or resistant starch (for example, RS-specific energy values, or Carmody et al. 2011 PNAS, which is a mouse study). The cooking evidence above is review-level only.
- Peanut studies (Levine & Silvis 1980 NEJM; Traoret et al. 2008) are cited in Novotny 2012 but were not fetched.

## 4. How much does an individual's energy uptake from the same food vary between people?

### Takeaway
Between-person variation in absorbed energy from the same food is large for poorly digestible foods. For almonds, individual measured ME ranged from 2.2 to 6.0 kcal/g (between-subject SD 0.8 kcal/g, about 17% of the mean), while within-person repeatability was much tighter (CV 6%). For cashews the range was 105–151 kcal per 28 g. Absorption of highly processed diets varies little between people (range 94–97%). High-fibre diets widen the spread (84–96%), and gut microbiota are associated with differences of about 150 kcal/d.

### Cited Findings
- **Almonds.** "Measured values for individual volunteers ranged from 2.2 to 6.0 kcal/g." Replicate measurements in the same subject gave 4.6 ± 0.7 and 4.6 ± 1.0 kcal/g (SD), with "mean intraindividual CV" of 6%. There was no effect of age or BMI on digestibility or energy density. Only 2 of 36 observations were at or above the Atwater value — [Novotny et al. 2012, PMC3396444](https://pmc.ncbi.nlm.nih.gov/articles/PMC3396444/)
- **Cashews.** Individual values ranged from 105 to 151 kcal per 28 g serving (mean 137) — [Baer & Novotny 2019, PMC6356908](https://pmc.ncbi.nlm.nih.gov/articles/PMC6356908/)
- **Whole diets.** Host ME (fraction of intake) on a Western diet was 95.4 ± 0.21% (range 94.1–97.0%). On a high-fibre diet it was 89.5 ± 0.73% (range 84.2–96.1%) — [Corbin et al. 2023, PMC10232526](https://pmc.ncbi.nlm.nih.gov/articles/PMC10232526/)
- **Microbiome association.** In 12 lean and 9 obese inpatients fed 2400 vs 3400 kcal/d, a 20% increase in Firmicutes (with a matching decrease in Bacteroidetes) was associated with about 150 kcal more energy harvest. This is an association, not causation. Jumpertz R et al. Am J Clin Nutr 2011;94(1):58–65, doi:10.3945/ajcn.110.010132 — [PMC3127503](https://pmc.ncbi.nlm.nih.gov/articles/PMC3127503/)
- The FAO/INFOODS reference text lists "Digestibility does not vary significantly among individuals" among the "questionable assumptions" behind table energy values — [G&S 2003 ch. 9](https://www.fao.org/4/y4705e/y4705e14.htm)

### Inferences
- For highly digestible, processed foods, between-person differences in absorbed energy are probably only a few percent. On a Western diet the whole-diet ME range was 94–97%, so about ±1.5%.
- For whole nuts and high-fibre foods, the between-person CV of absorbed energy is probably 15–20%, judging from the almond SD of 0.8 on 4.6 kcal/g. This is larger than the label-vs-table differences from conversion systems.
- Within a person, absorption from a given food appears fairly stable (almond CV 6%). So inter-individual differences are partly systematic, not just noise.

### Gaps
- Between-subject SDs for walnut and pistachio ME were not extracted; only abstracts were read.
- I found no large-sample study that quantifies the population distribution of absorption efficiency for a standard mixed diet. Older balance studies (for example, Southgate & Durnin 1970) were not fetched.
