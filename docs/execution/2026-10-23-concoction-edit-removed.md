# Consumption of a concoction: no "Edit the concoction" checkbox

- **Date:** 2026-10-23
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); request in chat
- **Supersedes:** [concoction-edit-off](2026-10-23-concoction-edit-off.md),
  [edit-concoction-consumption](2026-10-18-edit-concoction-consumption.md)

## Context

The user, after the checkbox was made opt-in: "No, take away the concoction edition checkbox".

## Decision

- Editing a consumption shows no concoction section: Item, amount, time. Concoctions are edited under Foods.
- The "New concoction (made at this time)" checkbox on a new consumption stays.
- The code for editing an existing concoction from the sheet (loading it, keeping a hand-typed amount or made-at
  time, saving both, merging repeats) is gone.
