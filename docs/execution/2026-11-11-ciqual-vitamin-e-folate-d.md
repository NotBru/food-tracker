# CIQUAL: vitamin E as alpha-tocopherol; folate and vitamin D from their parts when there's no total

- **Date:** 2026-11-11
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (reference databases); request in chat

## Context

The user asked for research on the most common micronutrient deficiencies, worldwide and in Argentina, then which
nutrients CIQUAL or USDA have that the app doesn't use. Vitamin E (#2 worldwide by inadequate intake, Passarelli et
al. 2024), folate (top 8 worldwide) and vitamin D (#1 in Argentina) sit in CIQUAL constituents `ciqual.py` didn't
read. The user: "Yes, add those three, not more" (choline from USDA and a partial vitamin A were also offered).

## Decision

`app/scripts/ciqual.py`:
- **Vitamin E:** alpha-tocopherol (71010, 1734 foods), as USDA's (1109). CIQUAL's "Vitamin E" (53100, 595 foods),
  read until now, is the fallback; no food has both.
- **Folate:** total folates (56700); without it, intrinsic folate (56704) + folic acid (enrichment) (56708), which
  is what the total is made of. Not used: folic acid alone (no natural folate given) and DFE (weights folic acid ×1.7,
  so it isn't the total).
- **Vitamin D:** the total (52100); without it, D3 + D2, or D3 alone. No food that lacks the total has D2.
- A `FALLBACK` table (options of constituents, summed with `total()`, used only when all are given) holds these and
  omega-3, which worked this way already. The "< x" limits behind the Δ of "traces" and zeros are now per
  constituent, not per key (the same thing for the old one-constituent keys).

Foods with a value: vitamin E 582 → 2299, folate 1493 → 2401, vitamin D 2146 → 2576 (of 3444). No value already
there changed. The 430 vitamin D additions are all 0 ("traces" or 0 in D3, no mushrooms): mostly plant foods, now a
known zero instead of a gap.

## Alternatives considered

- **Folate from DFE:** not the same quantity; enriched foods would be overstated against the other foods.
- **Vitamin D from D3 with D2 unknown, for mushrooms:** none is in that case, so no rule is needed.

## Consequences

- Reference foods are read from `ciqual.json` at run time, so past consumptions of CIQUAL foods get the new values.
- CIQUAL's folic acid is France's, where flour isn't mandatorily enriched: its breads and pastries understate the
  folate (and iron) of Argentine ones (law 25.630). Not addressed.
- Android 0.2.5 carries the new table.
