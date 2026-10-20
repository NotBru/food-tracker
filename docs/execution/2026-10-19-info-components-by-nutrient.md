# Food Info tab: components ranked by the breakdown's nutrient

- **Date:** 2026-10-19
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (user request in chat)

## Context

From the dashboard, a nutrient opens its breakdown, and a consumption there opens its food's
Info tab. For a food made of components, the user wants the components sorted by that nutrient
(largest first), with each component's amount of it shown clearly at its left.

## Decision

- The breakdown opens `/foods/<id>?tab=info&nutrient=<key>`; `FoodEditor` passes `nutrient` to
  `FoodInfo` and keeps it when switching between the Edit and Info tabs.
- With a known `nutrient`, `FoodInfo` computes each component's amount of it (the same
  `nutrientsFor` call that gives its kcal; Calories via `calories()`), sorts the components
  descending — ones that can't be computed last, ties in recipe order — and shows a bold value
  with `±Δ unit` beneath in a left column. A muted line above says "Components by <nutrient>,
  largest first". Labels come from the dashboard's `ROWS` (Calories, Protein, …), else `NUTRIENTS`.
- The amounts are for the component's amount in the recipe (per the food's base amount), not for
  the "per" amount chosen in the Nutrients section below.
- Opened any other way (no or unknown `nutrient`), the tab is unchanged.

## Consequences

The Android port has no Info tab yet; when it gets one, carry the nutrient across the same way.
