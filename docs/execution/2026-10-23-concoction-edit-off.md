# Consumption of a concoction: "Edit the concoction" starts unticked

- **Date:** 2026-10-23
- **Status:** superseded by [concoction-edit-removed](2026-10-23-concoction-edit-removed.md)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); request in chat
- **Supersedes in part:** [edit-concoction-consumption](2026-10-18-edit-concoction-consumption.md) (opening on the concoction)

## Context

The user: "Why would I want to edit the concoction??? and why is it default on?" Opening a consumption of a
concoction ticked "Edit the concoction (for every consumption of it)" and showed its components, when the usual
edit is the consumption itself.

## Decision

- The sheet opens on the consumption: Item picker, amount as stored. The checkbox is still there, unticked.
- Ticking it loads the concoction as before, and an "all of it" consumption turns into a blank amount ("all") then.

## Consequences

- Editing a concoction's components from one of its consumptions is now one tap more.
