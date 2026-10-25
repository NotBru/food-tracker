# USDA FoodData Central foods in the food database

- **Date:** 2026-10-25
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen, external databases); request in chat
- **Amends:** [External food databases](2026-10-15-external-databases.md) ("Not done / open": USDA)

## Context

The user asked whether USDA could be included. The live FDC API needs a personal api.data.gov key, which can't go in
a public repo. The bulk downloads are public domain (CC0) and were already in the repo's research notes
(`docs/notes/research_notes/Nutrient content variability/data/raw/`). The user chose to bundle them, like CIQUAL.

## Decision

- **Data:** Foundation Foods (2026-04-30) and SR Legacy (2018-04). `app/scripts/fdc.py` (stdlib only) converts them
  to `app/public/fdc.json`: **8094 foods** (400 Foundation, 7694 SR Legacy). The file is 3.0 MB, or 730 KB gzipped,
  and loads on first use like `ciqual.json`. A food in both datasets with the same name is kept once, from Foundation.
- **In the app:** the same as CIQUAL. USDA foods are read-only foods (`fdc:<fdcId>`) with the attribute
  `database = USDA`. They are listed after your own foods in food search and pickers, and in Explore. Editing one
  saves a copy. Config has its own toggle, "USDA's generic foods (FoodData Central) in the food database", which is on
  by default. `ctx.ciqual` became `ctx.generic` (both tables). The source links to `fdc.nal.usda.gov/food-details/<id>`.
- **Nutrients:** 41 FDC nutrients are mapped. Choices where FDC differs from the app:
  - Carbohydrates: by difference − fibre. FDC includes fibre and the app (EU, CIQUAL) doesn't. When there's no
    by-difference value, the by-summation value is used, which already excludes fibre. When there's no fibre, the
    by-difference value is used as is.
  - Energy: Energy (1008). Foundation mostly lacks it, so it falls back to Atwater specific, then Atwater general.
  - Folate total (DFE if total isn't given), vitamin A RAE, vitamin K1, vitamin E alpha-tocopherol.
  - Fluoride: µg → mg. Salt: sodium × 2.5, as in CIQUAL.
  - Omega-3: ALA + EPA + DHA as in CIQUAL, given only when all three are. SR Legacy mostly has 18:3 undifferentiated
    rather than 18:3 n-3, and that is used as ALA.
- **Δ:** calc.js takes the label error from the digits only, so values are texts. FDC's CSVs drop trailing zeros
  ("3.5" for 3.50), so each value is padded to the decimals that nutrient usually has. Zeros get them too ("0.00"
  ± 0.01, not "0" ± 1). Min/max are not used: the category CVs (fitted to these same USDA data) cover sample spread.
- **Category:** FDC's 28 categories are coarser than CIQUAL's subgroups, which the error model uses. Each food gets a
  CIQUAL subgroup from its FDC category, refined by name (raw/cooked meat, fish vs shellfish, cheese/milk/cream,
  breads/cookies/cakes, …). 165 foods (American Indian/Alaska Native foods, a few others) stay "unknown".
- **Units:** household measures ("1 large = 50 g", "1 cup, chopped = 136 g"). Mass measures (oz, lb) are skipped,
  since they're built in. "cup", "tbsp", "tsp" and "fl oz" (also "cup (8 fl oz)", "tablespoon") keep the built-in
  names, so a liquid's ml follow from them. "cup, chopped" stays separate, since it isn't the volume cup's weight. The
  first measure of a name wins.
- Food search runs over ~11.6k read-only foods now, so `searchText` caches their folded text.

## Alternatives considered

- **Live FDC API:** each user would need to paste their own key; Branded foods mostly overlap with Open Food Facts.
- **FNDDS (Survey foods):** another ~5k foods, mostly mixed dishes as eaten in the US. Not added; can be later.
- **Δ from min/max, as CIQUAL's:** that stored Δ isn't used in the maths any more ([error-model](2026-10-22-error-model.md)).

## Consequences

- `docs/instructions/design.md` still lists external databases as an unchecked V2 item. Only the user edits that file.
- The **Android port** is not updated. It has CIQUAL only in its External screen. It would need `fdc.json` in its
  assets and a USDA tab.
- SR Legacy is frozen (2018). Updating means re-running the script on new downloads.

## Verification

Headless Chromium (412×915), `vite preview`:
- Foods, "egg whole hard-boiled" → "Egg, whole, cooked, hard-boiled (database: USDA)", 155 kcal, P 12.6, F 10.6,
  C 1.1. Its editor shows "From USDA SR Legacy 2018-04 · FDC #173424" and the units 1 cup, chopped = 136 g,
  1 tbsp = 8.5 g, 1 large = 50 g. Info shows energy 155 −25 +28 kcal.
- Config shows the USDA toggle, on. No console errors. `vite build` passes.
- Spot checks in the JSON: whole milk (Foundation) has 1 cup = 229 g and carbohydrates 4.67. Raw broccoli (Foundation)
  has carbohydrates 3.89 (fibre 2.4 taken out). Raw flank steak → category 0402 raw meat, broiled → 0401 cooked meat.
