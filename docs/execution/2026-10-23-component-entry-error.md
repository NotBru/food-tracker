# A component's entry error starts from the food's last concoction

- **Date:** 2026-10-23
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); request in chat
- **Supersedes in part:** [entry-error-per-log](2026-10-22-entry-error-per-log.md) (the default for a component)

## Context

The user: the concoction components in "new consumption" keep defaulting to 10%, not to the error of the last entry
for the same concoction. `lastEntryError` took the food's latest consumption first, and a food ever logged on its
own with a blank error (the default) gave 10% to every component of it after.

## Decision

- A component picked (consumption sheet's concoction, food editor) starts at the food's error in the latest
  concoction made with it (by made-at time), then in a recipe, else its latest consumption, else the default.
- A consumption picked is unchanged: latest consumption first, then a component of it.
- A component with no error of its own counts as the default (10%), like a log.

## Consequences

- Within a concoction, the food's own consumptions no longer set a component's default.
