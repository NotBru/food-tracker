# Food editor: energy and macros per component

- **Date:** 2026-10-18
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen → Components); request in chat

## Context

When making a recipe or concoction, the editor only showed the total ("Per … : P · F · C · kcal"). The user
wants each component's own energy and macros while editing, to see what each one brings in.

## Decision

- Each component row in the editor gets a `MacroLine` (P · F · C · kcal, with ± errors) under its amount row.
- It is live: computed from the form as typed (`measure` for amount and Δ, then `nutrientsFor` on the
  component's food), so it updates as the amount, Δ or unit change, before saving.
- Shown once the row has a food and an amount; a unit that can't be converted shows the usual
  "can't compute" warning.
- Same line and colours as everywhere else, so it reads like the total underneath.

## Alternatives considered

- **Calories only, like the Info tab.** The request is for energy and macros; the Info tab is left as is.

## Consequences

- Web app only. The Android port doesn't have it.
