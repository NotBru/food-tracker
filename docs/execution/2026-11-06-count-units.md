# Every unit but a measure defaults to an exact count

- **Date:** 2026-11-06
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) ("Units": "Amounts in any unit but a
  measure default to an exact count")

## Context

User: "Why does my recently inserted greek yogurt have such error for its calories?", then "Do both" (fix the entry,
and change the rule).
- The yogurt was logged as "1 potesito" (the food's own unit, 1 potesito = 190 g) with a blank Δ.
- Only `u` was a count ([count-unit-exact](2026-10-16-count-unit-exact.md)), so the Δ came from the digits: ±1, i.e.
  0–2 pots, ~154 ± 154 kcal.
- The digits default fits measures ("190 g" ±1 g), not a count of one: there it is as large as the amount.

## Decision

- **Rule:** a unit is a count unless it's a built-in measure (`BUILTIN_UNITS`: g, kg, mg, oz, lb, ml, l, cl, dl,
  tsp, tbsp, cup, fl oz). So "potesito", "slice", "portion", "serving", "package" and `u` default to Δ 0. A blank
  unit keeps the digits default. A typed Δ still overrides it ("1 ± 0.5 slice").
- **Code:** `isCountUnit` (`nutrients.js`) stays the one place it's decided. The built-in table moved there from
  `calc.js` (which imports it), so the measures are listed once.
- **Existing data:** Dexie **v18** runs `countUnitDeltas` again with the wider rule; imports already run it. Explicit
  Δs are kept. On the user's data it changes nothing besides the yogurt, which was set to 1 ± 0 by hand (log-food
  tool).

## Alternatives considered

- **Units the food defines** (its `units` conversions): needs the food at every call (`measure`, the ± placeholder,
  the migration); and every non-measure unit is one the food defines anyway (or `portion`). Not worth it.
- **Add "potesito" to a list**: the next custom unit would hit the same.

## Consequences

- Cup, tbsp and tsp keep the digits default: they're measures, often eyeballed.
- A slice that isn't a full slice now needs a typed Δ; the earlier entry left words like "slice" out for that reason.
  The user chose exact.

## Verification

Headless Chromium (dev server):
- `isCountUnit`: u, " U ", potesito, slice, portion → true; g, KG, ml, cup, fl oz, blank → false.
- `measure`: "1 potesito" ±0 (auto); "1 ± 0.5 potesito" ±0.5; "190 g" ±1; "2 u" ±0. The ± placeholder reads 0.
- Database opens at v18; `countUnitDeltas` over the backup's items and consumptions changes no row. No console errors.
- `vite build` passes.
