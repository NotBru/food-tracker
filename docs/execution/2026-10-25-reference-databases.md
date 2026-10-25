# Config: "Reference databases", one switch per database

- **Date:** 2026-10-25
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); request in chat
- **Amends:** [USDA foods](2026-10-25-usda-foods.md) (its Config checkbox)

## Context

The user: group the databases into a "Pre-filled databases" config field ("change 'Pre-filled', I couldn't think of a
good adjective"), each database with a short explanation and a toggle on the right.

## Decision

- Named **"Reference databases"**: the usual term for food composition tables, and it sets them apart from the
  user's own foods and from Open Food Facts (searched live, not listed).
- One field, a panel with a row per database: its name, a one-line description below it, and the on/off switch
  that Explore already uses (`input.switch`) on the right. The config keys (`ciqual`, `usda`) are unchanged.
- The list is `REFERENCE_DBS` in `Config.jsx`, so another bundled table is one more line there.

## Alternatives considered

- **"Bundled" / "Built-in"**: say how they ship, not what they are. **"Generic"**: fits the foods, less so the databases.

## Verification

Headless Chromium (412×915): the panel shows CIQUAL and USDA with their descriptions and switches. Turning USDA off
and saving keeps it off after reloading Config. No console errors.
