# Newest first everywhere; consumption unit as text with autocomplete

- **Date:** 2026-10-15
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Consumptions screen, Targets screen)

## Context

User: "Everything that's dated should be sorted by most recent first." and "The units field in the logs should be
a text with autocomplete."

## Decisions

- **Newest first:**
  - **Changed:** a day's consumptions were oldest first; they are now newest first (Dexie `reverse().sortBy('datetime')`).
  - **Already newest first:** targets (by valid-from), concoctions in the Foods list and in the food picker (by
    made-at), and the execution-log index.
  - Undated foods stay alphabetical after the dated ones.
- **Consumption unit:**
  - `UnitSelect` is replaced by `UnitCombo`: a text field with an autocomplete list of the units the food converts
    to (`unitsFor`, the food's own unit first).
    - It's disabled until a food is picked ("pick a food first").
    - Picking a food fills in its own unit, as before.
    - Typing filters the list. When the text is exactly one of the units, the full list shows.
    - ↑/↓/Enter/Esc work as in the other pickers.
  - **Free text is allowed.** A unit without a conversion shows "No conversion to "X" for this food". Saving
    asks "Save anyway?"; such a consumption shows "can't compute" until the unit is added under the food's
    Units.
  - design.md still says "Unit (only selectable once the food is set; offers the units available for that food)".
    The first part still holds. "Offers" now means suggestions rather than a closed list; only the user edits
    that file.

## Verification

Headless Chromium:
- Consumptions at 08:00, 13:00 and 20:00 were listed 20:00 / 13:00 / 08:00.
- **Unit field:**
  - disabled before a food is picked; after picking Bread it showed "g";
  - suggestions: g, kg, lb, mg, oz, slice;
  - "sl" → slice, picked with Enter; 2.0 slice → 150 ± 14 kcal.
- **Unknown unit:**
  - "bowl" showed the no-conversion hint;
  - dismissing the confirmation kept the sheet open;
  - confirming saved it, listed as "can't compute".
- No console errors.

## Instructions edited (user-authorized exception)

The user asked: "update design in the same tone and brevity". Brief edits to `design.md`, keeping its structure:
- **UI:** "Everything dated is listed newest first."
- **Homescreen:**
  - Gauges/bars tinted by region, the hatched error range, and "reached" meaning the whole range is within the target.
  - The export filename has the date and time to the second.
- **Consumptions:** amount with Δ; unit as text with autocomplete.
- **Foods:**
  - The amount has a Δ.
  - "Every value **and every amount**" has a Δ defaulting from the digits.
  - The V2 external-databases item is checked and described (CIQUAL, OFF, `provenance` attribute).
- **Targets:** a min and/or max per field.
- **Config:** dashboard style (gauges or bars).
- Left untouched: the "TO AI" checkbox and the Stack section.

## Update: "+ add" first in every list

The user asked for the "+ add" row to come first in every list (first for dated lists, then "sorry, every list").
It now leads Consumptions, Targets, Foods, Users, a food's units, components and attributes, and the nutrient
adders (food and target editors). New unit, component and attribute rows are inserted at the top, right under the
button, so what you just added is where you tapped.

Conflict: design.md (Foods screen) still says "last element is “add new food”". Not edited (human-only); flagged to
the user.

## Update: food editor keeps "+ add" below; Enter → "add nutrient"

The user corrected: inside the food editor, "+ add" stays below (units, components, attributes, add nutrient), and
new rows are appended again. The top-level lists (Consumptions, Targets, Foods, Users) keep it first.

Enter in a nutrient's value or Δ now moves the cursor to "add nutrient", so several nutrients can be typed in a row
(type name, Enter, value, Enter, next name…). The target editor got the same: its "add nutrient" went back below
the rows (it's the same nutrient table, and Enter jumping upwards would be odd), and Enter in a min or max jumps
to it.

## Fix (2026-10-16): Enter on an exactly-typed unit kept the first unit

User: "In new consumption, if I go to the units field, press `u` and Enter, it goes back to grams."
- **Cause:** when the text is exactly one of the food's units, `UnitCombo` lists *all* units, so a prefilled
  unit can still be switched. The highlighted row was the first in the list, which is the food's own unit (g),
  so Enter replaced "u" with "g".
- **Fix:** in that case the exact match is listed first (`[q, ...others]`), so it is the highlighted row and
  Enter keeps it. Partial text still filters as before.
- **Verified** (headless Chromium, Egg with 1 u = 50 g, keyboard only):
  - "u" + Enter keeps "u";
  - "g" + Enter keeps "g";
  - "c" (no match) + Enter keeps "c".
  - No console errors.
