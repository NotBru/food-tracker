# Unified items: ingredients, recipes and concoctions are one thing

- **Date:** 2026-10-15
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Database screen), plus user feedback in chat:
  "I shouldn't need to choose between 'ingredients' and the rest. Ingredients, recipes, and concoctions are
  exchangeable (should be)".

## Context

The MVP stored three separate tables and referenced items as `{type, id}`. Pickers were grouped by kind, and
recipe components could not include concoctions. To use an item, the user had to know what kind it was. Turning
an ingredient into a recipe would have meant re-creating it and breaking every reference to it.

## Decision

- One `items` table. Every item has the same fields:
  `name, brand, attributes, amount?, unit?, nutrients, components: [{itemId, amount, unit}], madeAt?`.
- The kind is **derived, never stored**: `madeAt` → concoction, `components` non-empty → recipe, otherwise ingredient
  (`kindOf()` in `app/src/db.js`). Changing an item's fields changes its kind, and its id and references stay the same.
- **Nutrients:** inferred from components when there are any, otherwise taken from the item's own nutrients.
  The editor hides the nutrient table while components exist. The values stay stored, so removing the components
  brings them back.
- **No amount/unit** → the item counts as 1 portion (the whole thing). The same rule now applies to every item.
- Logs, components and conversions reference a plain `itemId`.
- **Picker:** a single search box over all items (all typed words must match name/brand/attributes/made-date).
  Concoctions are listed first (newest first), then everything alphabetically. Recipes and concoctions show a small
  kind tag for information only. Any item can be a component of any other, except itself; cycles are
  caught when computing.
- **Database screen:** keeps the four buttons from `design.md`. Ingredients, Recipes and Concoctions are filtered
  views of `items`, and their "add new" only presets the form (100 g; one empty component; made-at = now).
  All three open the same editor.

## Migration

- Dexie v2 copies the v1 tables into `items` with new ids and rewrites refs in `logs` and `conversions`.
  v3 drops the old tables. The pure function `migrateV1()` does the mapping.
- Exports are now `version: 2`. Importing a `version: 1` file goes through the same `migrateV1()`.
- Verified in headless Chromium: a raw v1 IndexedDB database was upgraded with correct totals, and a v1 export file
  was imported.

## Alternatives considered

- **Keep three tables and only merge the pickers**: fixes the picker, but the kind of an item still can't change and
  references stay type-qualified.
- **Store an explicit `kind` field**: it could disagree with the data (a "recipe" with no components).
  Deriving it avoids that.

## Open questions

1. `design.md` still describes the three kinds as separate lists with their own fields. Should the instructions
   be updated to match? (Humans only; I won't edit them.)
2. Should the Database screen also get an "All items" list?
