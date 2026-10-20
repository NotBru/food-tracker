# Food Info tab: energy and macros first

- **Date:** 2026-10-19
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (user request in chat)

## Context

The Info tab listed nutrients in the global `NUTRIENTS` order, where fat's sub-types
(saturated, mono/poly-unsaturated, omega-3, trans) and cholesterol sit between Fat and
Carbohydrates. The user asked for energy, proteins, fat and carbs to come first.

## Decision

`FoodInfo.jsx` orders its table as Energy, then `MACROS` (proteins, fat, carbohydrates),
then every other nutrient in the usual `NUTRIENTS` order. Only the Info tab changes;
`NUTRIENTS` itself (used by the editor, breakdown and dashboards) is untouched.

## Alternatives considered

- **Reorder `NUTRIENTS` globally** — would also move Carbohydrates away from its
  sub-items (sugars, fibers) in the food editor, which wasn't asked for.

## Consequences

The Android port has no Info tab yet; when it gets one, use the same order.
