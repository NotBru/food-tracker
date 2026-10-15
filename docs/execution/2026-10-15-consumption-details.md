# Consumption editor: nutrient details drop-down

- **Date:** 2026-10-15
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Consumptions screen) and a chat request:
  "In the edit consumption, add a button to drop details down (coffee for example)"

## Context

The editor only previews P/F/C/kcal. For something like a coffee those are ~0, and what matters (caffeine,
potassium…) was invisible.

## Decision

A "▸ Details" link under the macro preview toggles a list of every nutrient for the consumption as currently
entered (live with amount/unit edits), each with its ± error. Collapsed by default.

- Nutrients no contributing food has a value for are omitted, so the list isn't 40 rows of "–".
- A nutrient only some components know is shown with "+?" (the sum is a lower bound).
- Energy is left out; it's already on the macro line.
- Hidden when the nutrients can't be computed (unit conversion missing).

## Alternatives considered

- **Always show all nutrients** — too long for the sheet; the request asked for a drop-down.
- **Also on list rows** — not requested; the list stays compact.

## Open questions

- Should the list rows (not just the editor) get a way to show details too?
