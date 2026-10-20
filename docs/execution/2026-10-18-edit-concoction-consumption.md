# Consumption editor: edit a concoction's components from its consumption

- **Date:** 2026-10-18
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Consumptions screen; Foods screen → Made at, Components); request in chat

## Context

The user reported (in chat) that opening a consumption of a concoction from the Consumptions screen didn't let
them edit its constituents. The concoction section of [the sheet](2026-10-18-consumption-concoction.md) only
appeared on new consumptions; an existing one only had the plain Item picker.

## Decision

- **Opening a consumption of a concoction opens the concoction section on it.** It shows Name, Brand,
  Attributes and Components, filled in from the concoction. A checkbox reads **"Edit the concoction (for every
  consumption of it)"**. The concoction is one food, so changes apply wherever it is used. Unticking it brings back
  the Item picker (e.g. to swap the food) and drops unsaved edits to the concoction. The checkbox also shows when
  a different concoction is picked in an existing consumption.
- **Save writes both** the concoction and the consumption in one transaction, then merges exact repeats
  (`mergeEqualFoodsInDb`), as the food editor does after an edit.
- **Amount of the concoction.** If its stored amount was the sum of its components (as "Auto" or the new-concoction
  sheet sets it), it keeps following the sum, in its own unit when it can. If it was typed by hand (e.g. a cooked
  weight after water boiled off), it is kept. The total line then says so and points to Foods to change it.
- **Made at** follows the consumption's date and time only if the two were the same. Otherwise it is kept, so
  correcting when you ate leftovers doesn't move when they were cooked.
- **"All of it".** A consumption that was the concoction's whole amount, with Δ 0, opens with a blank amount
  ("all"), so it stays all of it as the components change. Unticking the checkbox turns the blank back into
  the number.
- Other fields of the concoction (units, source and so on) are kept as they are.

## Alternatives considered

- **A link to the food editor from the sheet.** That would take more steps and lose the live preview of the
  consumption's nutrients. It would also face the same modal-vs-navigation problem noted in the new-concoction
  entry.
- **Always recompute the amount from the sum.** That would overwrite cooked weights entered by hand.

## Consequences

- Web app only. The Android port doesn't have it.

## Follow-up: macros per component (same day)

The user noticed (in chat) that the sheet's component rows didn't show each component's details the way the
food editor does ([component macros](2026-10-18-component-macros.md)). Each row in the sheet now has the same
live `MacroLine` (P · F · C · kcal with ± errors) once it has a food and an amount. This applies to new
concoctions too. While a concoction is being edited, it is left out of its own component search, as in the food editor.
