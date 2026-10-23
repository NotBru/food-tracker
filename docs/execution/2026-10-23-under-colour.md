# "Below min" in the same red as "above max"

- **Date:** 2026-10-23
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen dashboard); request in chat

## Context

The user: "Have the yellow you're using for 'bellow minimum' be the color that you're using for 'above maximum',
everywhere".

## Decision

- Below min now uses `--prot` (red), like above max, everywhere it's drawn. That covers the bar and gauge regions,
  fill pieces, range labels, gauge status, and the time graphs (which use the same classes).
- `--warn` stays yellow for warning text ("can't be computed" and the like).

## Consequences

- Under and over differ only by side and by the ↓/↑ mark, not by colour.
