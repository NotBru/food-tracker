# Consumption editor: old concoctions listed last

- **Date:** 2026-10-19
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (user request in chat)

## Context

The food picker lists concoctions first (newest made first), then everything else
alphabetically. In a new consumption, old batches crowd the top though they're
most likely eaten up. The user asked for concoctions made before yesterday (not
including yesterday) to come later.

## Decision

- `ItemPicker` takes an optional `oldBefore` (ISO time). Concoctions made before it go
  after every other food, newest first among them. Without it, the order is unchanged.
- The consumption editor passes the start of yesterday's *logical* day (config
  `dayStart`, as everywhere else), counted from today, not from the consumption's date.
  So with a 05:00 day start, a batch made yesterday at 06:00 stays at the top, and one
  made yesterday at 04:00 (still the day before) goes last.
- It applies to both pickers in the consumption editor: the food eaten and the
  components of a new concoction. The food editor's component picker and the Foods list
  keep the old order.

## Alternatives considered

- **Count from the consumption's date**, so logging a past day treats batches made around
  then as fresh. Not done because the request said "yesterday", meaning relative to today.

## Consequences

The Android port still sorts every concoction first; port the same rule when it's next touched.
