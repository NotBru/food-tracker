# UI feedback round 1: shape, units, day history, nutrient list

- **Date:** 2026-10-15
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md), plus user feedback in chat (quoted below)

## "Too square"
Rounded the whole UI: pill-shaped buttons and inputs, round icon buttons, list rows as rounded cards
(dashed card for "+ add"), dashboard on a rounded card, bottom sheet with a 32px radius and a grab handle,
and buttons that shrink slightly when pressed. CSS only (`app/src/styles.css`).

## "Unit should be a dropdown with the available options from the database"
First attempt (superseded): dropdowns everywhere, including the database screens. The user corrected this:
"Units in database edition should be a normal text square. Units in the new log should wait for you to set the
ingredient ID and then fetch what units are available."

Now:
- **Database screens** (item unit, recipe components, conversions): plain free-text input (`UnitInput`).
  This is where units get defined.
- **Log editor**: the unit `<select>` is disabled ("pick an item first") until an item is chosen, then lists only
  units convertible to that item's unit (`unitsFor()`), with the item's own unit first. Candidates are all units
  known in the database (built-ins, `portion`, units used by items, components and conversions). Switching item
  keeps the unit if it still converts, otherwise it resets to the item's unit (`keepUnit()`).
- An existing log whose unit no longer converts (e.g. its conversion was deleted) shows it as
  "<unit> (no conversion)" instead of silently switching.

## "Pressing back shouldn't go to another day if you've been scrolling days"
Day changes on the Logs screen (‹ ›, calendar) use `location.replace`, so they change the URL without adding a
history entry. Back from Logs always returns to wherever you came from. The day stays in the URL, so a reload
keeps it.

## "Nutrients … only the ones which have already received a value. Energy, proteins, carbs, and fat fixed on top"
- Energy, Proteins, Carbohydrates and Fat are always shown first, in that order.
- Any other nutrient appears only if it has a value or a Δ, or was just added with the "+ add nutrient…"
  dropdown below the list. An added row left empty disappears again on next open, because nothing was stored.
- The collapsible "Nutrients ▸" toggle was removed because the short list no longer needs it.
- Follow-up ("Add nutrient should be a text field, with autocomplete"): the dropdown is now a text box (`NutrientAdder`)
  with suggestions for nutrients not shown yet. Every typed word must appear in the label ("vit b" → Vitamin B1…),
  labels starting with the text come first, and tapping a suggestion or pressing Enter (first match) adds it. On focus it
  scrolls to the top so the phone keyboard doesn't cover the suggestions.
- Follow-up ("Arrows don't work to select from the autocomplete dropdown"): shared `useListNav()` hook in
  `components.jsx`, used by both autocompletes (nutrient adder and food picker). ↑/↓ move the highlight (scrolled
  into view), Enter picks the highlighted entry (first by default), Esc closes, and hovering moves the highlight.
  Typing resets the highlight to the top. Removed the unused "any item" option from the food picker.
- Follow-up ("Hitting enter on a new nutrient should take the cursor to its 'value' field"): after a nutrient is added
  (Enter or tap), its value input is focused and scrolled to the middle of the screen (`focusKey` + per-row refs in the
  food form).

## Verification
Headless Chromium (Pixel 7): new ingredient shows only the 4 core rows; adding Fibers keeps it after reopening;
typed unit `slice` in the item's text box; the log unit select is disabled before an item is picked; a conversion `1 slice = 30 g` makes the log dropdown for Bread offer
`slice, g, kg, lb, mg, oz` (no volume units); browsing back 3 days and then pressing back lands on home.
No console errors.

## "Sort all fixed nutrients fields so that it's proteins, fats, and only then carbs"
Fixed order is now **Energy, Proteins, Fat, Carbohydrates** everywhere: food editor core rows (`CORE`), dashboard rows,
the macro line (`P · F · C · kcal`), and `MACROS`. For consistency the master `NUTRIENTS` list also moves the fat group
(saturated/mono/poly/trans, cholesterol) before the carbohydrate group (sugars, added sugars, fibers). Target editor
rows and target cards are sorted by that list instead of insertion order.

## "Nutrients in 'New food' can't be removed. Add an 'x'"
Optional nutrient rows in the food editor get a × (`removeNutrient()`): it clears value and Δ, so the nutrient is
stored as NaN again, and hides the row. It can be re-added via "+ add nutrient". The four fixed rows (energy, proteins,
fat, carbs) have no × because design.md keeps them fixed, and their value fields can simply be emptied. Food rows use
a 4-column grid (`.n-row.with-x`); the target editor keeps its own 3-column layout.

## "Got no iodine ('yodo')"
Added **Iodine (µg)**, plus the remaining minerals EU labels may declare (Reg. 1169/2011 Annex XIII): chloride,
phosphorus, copper, manganese, fluoride (mg) and selenium, chromium, molybdenum (µg). The mineral block is ordered
sodium, salt, potassium, chloride, calcium, phosphorus, magnesium, iron, zinc, copper, manganese, fluoride, selenium,
chromium, molybdenum, iodine. No migration is needed: missing keys are simply unset (NaN).
