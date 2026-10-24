# Forms: Enter saves where it doesn't jump to a field

- **Date:** 2026-10-24
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); request in chat

## Context

The user: "Enter, in the places where it doesn't jump to a specific field in a form, should hit save".

## Decision

- `components.jsx enterSaves(save)`: an onKeyDown on the form's container (food editor, consumption, body
  measurements and targets sheets, Config). Enter in a text box saves unless the box's own handler took it, i.e.
  called `preventDefault`: a jump (`enterTo`, `enterNext`, Body's next value, a component row's "+ add component")
  or a pick from an open list (`useListNav`).
- So Enter saves from the name, brand, attributes, dates, a ± Δ, Config's numbers, and a picker with no match.
- Not text areas (Enter is a new line) nor buttons (Enter presses them). Not while an IME is composing.
- The user form already saved on Enter (a `<form>`); unchanged.

## Consequences

- A handler that should keep Enter from saving has to `preventDefault`.
