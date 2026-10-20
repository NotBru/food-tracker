# Homescreen: mustard screen buttons; Config moved to the top

- **Date:** 2026-10-17
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen); request in chat

## Context

The user asked (in chat) for the Consumptions, Foods and Targets buttons to be a different colour
(mustard), and for Config to move to the left of the user button.

## Decision

- New colour token `--mustard: #d9a42b` (`styles.css`). The three screen buttons are filled with it,
  and their + buttons keep the panel background with a mustard sign. The text stays dark, like on the
  other filled buttons.
- Config is now a pill like the user button ("⚙️ Config"), on its left in the top bar.
- The menu now has three items. On a short phone it is two columns, with Targets spanning the second
  row (still two rows, as before). It is three columns when wide (was four) and stacked when tall
  (unchanged).

## Consequences

- Web app only; the Android port still has Config in the menu.
