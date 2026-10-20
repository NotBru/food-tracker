# Consumption info screen, with an energy donut

- **Date:** 2026-10-20
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); request in chat
- **Extends:** [food Info tab](2026-10-16-food-info.md), [consumption details](2026-10-15-consumption-details.md)

## Context

User: "I want clicking a log entry to go to an info tab for that instead. Have it show the details of every
nutrient, and also a pie chart on top, with the total amount of calories centered, and then what fraction of them
comes from fat (subdivide per kind), protein, and carbs (also subdivide per kind). Use the inferred conversion from
grams to kcal instead of the total kcals registered. I want the info entry to correspond to exactly the amount
consumed in that log, not to the reference value."

## Decision

- Tapping a consumption opens `#/consumptions/<id>` (`ConsumptionInfo.jsx`), not the editor sheet. Its ✎ (top
  right) opens the same editor sheet over it; deleting from there goes back to the list.
- Everything is computed with `consumptionNutrients` on the log itself: the amount eaten ± its Δ, worst case, as
  the dashboard counts it. There is no "per" picker, unlike the food's Info tab.
- Top: amount eaten, a link to the food's Info tab, and the macro line.
- **Donut:** energy computed from grams with the app's own estimate (`calories()` fallback): 9 kcal/g fat,
  4 proteins, 4 carbohydrates, plus 7 alcohol when there is any (it's part of the same estimate, and leaving it
  out would make the total wrong for drinks). The registered energy is not used; it's shown as a note under it
  when it is known.
  - Centre: total ± Δ (Δs of the macros × their factors, added up). Hovering or tapping a slice shows that slice.
  - Fat: saturated, monounsaturated, polyunsaturated (split into omega-3 / other polyunsaturated), trans, and
    "unspecified fat" for whatever the listed kinds leave over.
  - Carbohydrates: sugars (split into added / other sugars) and "starch & other" for the rest.
  - Kinds not listed by any food in the consumption are left out (their grams fall into the rest). Kinds that
    add up to more than their macro (rounded labels) are scaled down to fit, so the macro's share stays right.
  - Each macro keeps its usual colour (proteins red, fat purple, carbs orange); its kinds are shades of it,
    2 px gaps between slices.
- Legend table under it: per macro g ± Δ, kcal ± Δ, %; per kind g, kcal, %.
- **Nutrients:** the same table as the food's Info tab (`NutrientTable`, moved out of `FoodInfo.jsx` and shared).

## Assumptions

- **Fibre is not part of carbohydrates** (EU labelling, CIQUAL, Open Food Facts EU data), so it isn't a carb
  slice and adds no kcal. That matches the 4 kcal/g carbs estimate the rest of the app uses. Foods entered with
  US-style carbohydrates (fibre included) will have their fibre inside "starch & other".
- ~~The breakdown screen still opens the food's Info tab.~~ Revised the same day (user: "I also want it to work
  when I click into it from the dashboard (e.g. calories -> specific food)"): a breakdown row (or a group's
  member) opens the consumption's info too, `#/consumptions/<id>?nutrient=<key>`. Its link to the food passes
  the nutrient on, so the food's Info tab still ranks the components by it, one tap further.

## Consequences

- Web app only, like the other recent screens; the Android port doesn't have it.

## Verification

Headless Chromium, Granola per 100 g: P 10, F 20 (sat 5, mono 9, poly 4 of which omega-3 1), C 60 (sugars 20 of
which added 12), 470 kcal registered. Logged 150 g.
- The list entry opens `#/consumptions/1`. Fat 30 g → 270 kcal (sat 68, mono 122, omega-3 14, other poly 41,
  unspecified 27), proteins 60, carbohydrates 360 (added sugars 72, other sugars 48, starch & other 240):
  690 kcal in the centre, against 705 registered, which is noted under the chart.
- Hovering the first slice shows "68 kcal · 10% · Saturated" in the centre.
- ✎ opens the editor; deleting there goes back to the list. No console errors.

## Revision: the food's Info tab too

User: "Actually, apply this info view to the info tab in the foods menu as well".

- The donut and its legend live in `EnergyChart.jsx`, shared by both screens.
- The food's Info tab now reads top to bottom like the consumption's: the "per <amount> <unit>" picker first,
  then **Energy by macro** for that amount, then the nutrient table, then **Amounts** (the per-amount, unit
  conversions and components, ranked by a breakdown's nutrient when opened from one), which used to come first.
  The picker drives both the chart and the table, so it has to sit above them.
- Hidden while the amount can't be computed (missing food or conversion), as a partial pie would mislead.
- Verified: Granola per 100 g shows 460 ±5 kcal (fat 180, proteins 40, carbs 240; 470 registered); per 50 g,
  230 ±3 kcal.
