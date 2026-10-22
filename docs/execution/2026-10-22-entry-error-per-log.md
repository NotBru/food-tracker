# Entry error set per consumption

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); model from [`docs/notes/error-handling.md`](../notes/error-handling.md)

## Context

[entry-error](2026-10-22-entry-error.md) put the entry error on the food. The user: a food describes its label, so the
error belongs to the log.

## Decision

- `log.entryError` (fraction). The consumption form has the field (%, prefilled 10) for anything but a concoction or
  a recipe; the consumption's info shows it. Missing = `DEFAULT_ENTRY_ERROR` (0.1).
- Foods no longer have it (form, info, calc). Recipe components and the food Info / Explore screens use the default.
- The user's export: `entryError: 0` moved from the 12 label foods to their 40 logs (`food-tracker-updated.json`,
  not committed).

## Consequences

- A label food's new logs start at 10%: the user sets 0 each time.
- Components read off a label (La Salteña dough in a concoction) get 10%; they have no field of their own.
