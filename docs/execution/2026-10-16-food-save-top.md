# New food: a second Save at the top

- **Date:** 2026-10-16
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen)

## Context

User: "I want the save button for new food both at the bottom and at the top right (right next to the 'Search
external databases' but smaller) in the 'add food' screen."

## Decision

- On the **new food** screen, "Search external databases…" now shares a row with a compact **Save** button on its
  right.
  - The search button takes the remaining width.
  - Save is sized to its text (`button.save-top`: `flex: 0 0 auto`, slightly less horizontal padding).
- The bottom Save is unchanged. Both call the same `save()`. Validation problems are alerts, so they show
  whichever button was pressed.
- The **edit food** screen has no search button and keeps only the bottom Save/Delete row, since the request
  was about adding a food.

## Verification

Headless Chromium (412 px wide):
- The row renders as described.
- Typing a name and pressing the top Save stored the food and returned to the previous screen.
- No console errors.
