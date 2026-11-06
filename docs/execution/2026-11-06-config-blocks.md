# Config in blocks: General, Dashboard, Food database

- **Date:** 2026-11-06
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen)

## Context

The user asked for Config split into blocks, one of them the dashboard.

## Decision

- Three panels with a small uppercase heading: General (backup, day start, error intervals, app version),
  Dashboard (style, 7-day correction caps, energy pie, only nutrients with a target, ghost bar), Food database
  (reference databases). The caps and the ghost go under Dashboard: they shape its calorie bar.
- Inside a block, inputs and switch lists take the lighter panel colour (else they vanish into the block).
- Switch labels drop their "Dashboard:" prefix (the block says it).

## Consequences

- Android's native Config still lists them in one column (next port).
