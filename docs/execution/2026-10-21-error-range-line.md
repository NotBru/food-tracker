# Dashboard: the error range on its own line, in its own colour

- **Date:** 2026-10-21
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (dashboard, error bars); request in chat

## Context

User: "Write the estimated range (from errors) below the 'units ± error', in another color, for the dashboard".
The range (value ± Δ, floored at 0) was appended to the same muted line: "kcal ±150 · 1650–1950".

## Decision

- Web dashboard, both styles (gauges and bars): "unit ±Δ" stays as it was; the range ("1650–1950") moves to a
  line of its own just under it.
- Colour: a new `--range` token, cyan `#56d4dd` — not used elsewhere, so it isn't read as a nutrient
  (red/orange/purple/green), a target status (green/yellow/red) or a link (blue).
- With no error (Δ = 0) the line is blank but keeps its height, so tiles and rows stay aligned (as the target
  line does).

## Alternatives considered

- **Muted colour, like the line above** — the request asks for another colour.

## Consequences

The Android port doesn't show the range at all yet; not changed here.

## Verification

Headless Chromium, one consumption with errors on all but fat: both styles show "1650–1950", "55–65", "180–220"
in cyan under "unit ±Δ", and a blank line under "g ±0".
