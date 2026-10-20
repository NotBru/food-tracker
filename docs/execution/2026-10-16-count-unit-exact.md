# Amounts in "u" default to an exact count

- **Date:** 2026-10-16
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) ("Every value should also have a corresponding error")

## Context

User: "When measuring in `u` (units), default error to 0."
- A blank Δ defaulted from the digits (see [error bars](2026-10-15-error-bars.md), "amount errors default from
  the digits"). So "2 u" meant 1–3 units, though a count of eggs or biscuits is exact.

## Decision

- **Rule:** an amount whose unit is `u` (trimmed, any case) has a default Δ of **0** instead of the digits
  default. A typed Δ still overrides it, e.g. "2 ± 0.5 u" for "two-ish".
- **Helper:** `isCountUnit` and `autoAmountDelta(text, unit)` (`nutrients.js`) are the one place this is decided.
  - `measure(text, deltaText, unit)` uses it, and the ± field's placeholder (`DeltaInput unit=…`) shows "0".
  - It applies to every amount: consumptions, a food's "per amount", both sides of unit conversions, and
    recipe components.
- **Existing data:** Dexie **v11** runs `countUnitDeltas` over items and consumptions.
  - It sets every *automatic* Δ on an amount in `u` to 0. Explicit Δs are kept.
  - Imports run it too (idempotent), so older export files get the same treatment. The export format is
    unchanged.
- Only `u` counts as a count. Words like "slice" or "portion" keep the digits default, because a slice isn't
  always a full slice. More count units can be added to `isCountUnit` if wanted.

## Verification

Headless Chromium:
- `measure`: "2 u" and "2 ' U '" give ±0; "2 g" gives ±1; "2 ± 0.5 u" stays ±0.5.
- Import of rows with automatic ±1 in `u`:
  - the log's Δ becomes 0;
  - the unit conversion's "1 u" side becomes 0, and its "50 g" side keeps ±1;
  - an explicit ±0.5 log is kept.
- Consumption editor: Egg, 2 u gives placeholder "0" and preview 140 ±10 kcal (only the food's own error).
  Switching the unit to g gives placeholder "1".
- No console errors.
