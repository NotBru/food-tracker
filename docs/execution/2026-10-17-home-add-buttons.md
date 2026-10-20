# Homescreen: + buttons beside Consumptions, Foods and Targets

- **Date:** 2026-10-17
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen); request in chat

## Context

The user asked (in chat) for a smaller + button to the right of the Consumptions, Foods and Targets
homescreen buttons, opening the "add" for each straight away. design.md doesn't mention it; it adds a
shortcut and doesn't change the existing buttons.

## Decision

- Each of the three buttons is now a `.menu-item`: the button plus a 48 px round `+` (panel background,
  accent-coloured sign), so the + reads as secondary to the screen button.
- **Foods +** goes to `#/foods/new`, the existing new-food screen.
- **Consumptions +** and **Targets +** go to the screen with a `new` flag (`#/consumptions?new`,
  `#/targets?new`). The screen opens its usual new-item editor once its data has loaded, then
  replaces the URL without the flag. That way, closing the editor or reloading doesn't reopen it, and
  going back still returns to the list.
- On a past day on the daily dashboard, Consumptions + keeps that day (`?day=…&new`), as the
  Consumptions button does. The new consumption then defaults to noon of that day, as it already did.
- A new target from + starts like one from "+ add target": now, with the latest target's values.

## Alternatives considered

- **Open the editor as a sheet over the homescreen.** That needs the editors' data (the food context,
  the current user) on the homescreen, and closing it would leave the list unseen. Going through the
  screen reuses everything already there.
- **Keep the `new` flag in the URL.** Then reloading or coming back with forward would pop the editor
  up again.

## Consequences

- Web app only. The Android port (`android/`) doesn't have these buttons yet.
