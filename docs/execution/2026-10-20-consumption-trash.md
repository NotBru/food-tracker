# Consumptions list: delete button on each entry

- **Date:** 2026-10-20
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Consumptions screen); request in chat

## Context

User: "Add a trash bin next to the consumption list items, to delete them".

## Decision

- Each entry of the Consumptions list has a round trash button at its right (an SVG icon, like the chevrons).
- It asks first ("Delete “Granola” at 17:07?"), as the editor's Delete does: one tap beside a row that opens the
  info screen is easy to hit by mistake, and there is no undo.
- The tap doesn't reach the row, so it doesn't open the info screen.

## Verification

Headless Chromium: two entries, the first's bin asks with its name and time, deletes it on OK and stays on the
list; tapping the remaining row still opens its info screen.
