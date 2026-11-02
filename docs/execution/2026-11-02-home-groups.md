# Homescreen: Logs and Database buttons that expand

- **Date:** 2026-11-02
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen); request in chat

## Context

The user asked for the six buttons below Time graphs (Consumptions, Foods, Targets, Body measurements,
Import, Export) to become two: Logs (Consumptions, Targets, Body measurements) and Database (the rest).

## Decision

- Logs and Database side by side, always at the bottom. Tapping one opens its group; tapping it again
  closes it. Only one group is open at a time.
- The group opens **above** the two buttons, so they don't move under the thumb; the dashboard above
  gives up the room (it already scrolls on its own).
- Closed: the panel colour with a mustard outline and text, and a chevron pointing up. Open: filled
  mustard, chevron pointing down. The group's buttons are unchanged (mustard, with their +).
- Logs' three buttons are one per row on a phone, three in a row when wide (≥ 700 px). Database: Foods (+),
  then Import and Export side by side, as before.
- The open group is kept in a module variable, so coming back from a screen finds it as it was. A
  reload starts closed.
- `aria-expanded` / `aria-controls` on the two buttons.

## Alternatives considered

- **Group below the buttons** — the buttons jump up as it opens, away from the finger.
- **Both groups open at once** — on a short phone the dashboard would be squeezed to nothing.
- **Remember the group across reloads (localStorage)** — not asked for; easy to add.

## Consequences

- One extra tap to reach any of the six screens/actions, unless the group was left open.
- The old grid rules for the menu (two/three columns, stacked when tall) are gone.
