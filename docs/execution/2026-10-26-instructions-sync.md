# Instructions brought up to date; no longer read-only

- **Date:** 2026-10-26
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md), [`docs/instructions/README.md`](../instructions/README.md)

## Decision

- User's request: update the instructions to match the app, in their terse form, and drop the "AI read-only" rule;
  say instead that they keep their terse structure for easy human review (`docs/instructions/README.md`, `CLAUDE.md`).
- `design.md` now covers what the execution log added since: last-7-days window, day arrows, the 7-day calorie
  correction and ghost, breakdown and explore, time graphs, consumption info and entry error, the error model's
  category, reference databases (CIQUAL, USDA) and OFF, body measurements, and the config options.
- Kept the user's sections, order and wording; new screens got a short section each. The "TO AI: am I missing some
  field?" checkbox was replaced by the current nutrient list.
