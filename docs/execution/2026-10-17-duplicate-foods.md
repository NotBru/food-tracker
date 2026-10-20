# Repeated foods ignored; same ID with different values flagged

- **Date:** 2026-10-17
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen: "attributes … change the ID of the product"); chat request: "ignore repeated entries that are equal; flag entries that have different values but the same ID"

## Context

The request doesn't say which entries. Foods are the only records with an ID separate from their database
key (design.md: name, brand and attributes make a product's ID), so this applies to foods. Consumptions have no
such ID.

## Decision

- **ID** = `itemKey` (name, brand, attributes; case and attribute order ignored) plus `madeAt`. Two batches of
  the same soup made at different times are different foods, not a clash.
- **Equal** = same ID and every other stored field the same (amount, Δs, typed text, unit, units, components,
  nutrients, source). NaN counts as equal to NaN.
- **Ignored repeats:**
  - Saving a new food that repeats an existing one adds nothing; the existing food is used (also as the
    component when made from a recipe's "+").
  - Editing a food into a copy of another merges them.
  - On import, and once for existing data (DB v12), repeats merge.
  - Merging keeps the oldest (lowest id). Consumptions and components that used a removed copy point at the kept
    one. Recipes that only differed by which copy they used then become repeats too, so they merge as well.
- **Flagged clashes:** a "⚠ same ID" tag in the Foods list, and in the food screen a warning that links to the
  other food(s). Nothing is blocked or merged. Which values are right is the user's call.

## Alternatives considered

- **Block saving a clashing food.** No: the request says to flag, and a second version can be on purpose (e.g. a
  recipe that changed).
- **Hide repeats in lists but keep the rows.** No: they would still show up in exports and pickers.

## Consequences

- The Android port doesn't do this yet. Its import of a web export with repeats keeps them.
- Name casing differs between merged repeats ("Apple" and "apple"): the oldest one's spelling is kept.

## Open questions

- Should consumptions also be checked for exact repeats (same food, amount and time)? Not done. Logging the same
  thing twice can be on purpose.
