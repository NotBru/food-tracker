# Entry error set per consumption

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); model from [`docs/notes/error-handling.md`](../notes/error-handling.md)

## Context

[entry-error](2026-10-22-entry-error.md) put the entry error on the food. The user: a food describes its label, so the
error belongs to the log.

## Decision

- `log.entryError` (fraction). The consumption form has the field (%, prefilled 10) for anything but a concoction or
  a recipe; the consumption's info shows it. Missing = `DEFAULT_ENTRY_ERROR` (0.1).
- Foods no longer have it (form, info, calc). The food Info and Explore screens use the default.
- Picking a food (consumption or component) starts it at the entry error of that food's latest consumption, else of
  a component of it, else the default (`calc.js lastEntryError`).
- Recipe and concoction components have their own (`component.entryError`): an "ε 10%" button in the component's
  row that turns into a box when tapped.
- The user's export: `entryError: 0` moved from the 12 label foods to their 40 logs (`food-tracker-updated.json`,
  not committed).

## Consequences

- A food first logged at the wrong value carries it on until changed.
- The user's later export (15-33-25): the 12 label foods' 0 moved to their 41 logs and 28 components.
