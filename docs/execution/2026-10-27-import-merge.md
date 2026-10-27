# Import: merge into the current data, or replace it

- **Date:** 2026-10-27
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen: import databases)
- **Amends:** [MVP scaffold](2026-10-15-mvp-scaffold.md) ("Import replaces all data")

## Context

User in chat: "Import should let you choose whether to overwrite or merge".

## Decision

- Picking a file opens a sheet: **Merge** (main button), **Replace** (red, asks once more), Cancel.
- Merge (`mergeTables` in `db.js`), after the file goes through the usual import migrations:
  - The file's rows get new ids after this device's; components, consumptions, targets and body measurements follow
    them. Reference foods (`ciqual:…`, `fdc:…`) keep theirs. Breakdown group ids are random strings and stay.
  - A user whose name matches one here (trimmed, case and accents ignored) is that user; others are added.
  - Foods: the existing `mergeEqualFoods` (exact repeats into the oldest, i.e. this device's; recipes repointed
    until stable). Same ID with different values stays two foods, flagged as before.
  - Consumptions, targets, body measurements: an imported row equal to one here (all fields but `id`, key order
    ignored) is skipped, one for one: two identical eggs here and one in the file stay two; three in the file make
    three.
  - Config (settings, current user) stays this device's.
- Backup restore still replaces (unchanged).

## Alternatives considered

- **Imported rows win on clashes** (e.g. a consumption edited on both devices): there is no shared row identity
  across devices, so an edited row can't be told from a new one; it's kept as a second row, visible and deletable.
- **Users matched by id**: every device starts with user 1 "Default", whoever it is; names are what people see.
- **Dropping every repeat, also among the file's own rows**: two identical consumptions are legitimate.

## How it was checked

`npm run build`; `vite preview` and headless Chromium, importing hand-made export files through the sheet:
- Replace with file 1 (a user, an egg, a soup made of egg + a CIQUAL food, two identical egg consumptions, a soup
  consumption, a target).
- Merge file 1 again: nothing changes.
- Merge file 2 (users "Zed" and "default"; the same egg, plus rice; consumptions for both): "default" goes into
  "Default", Zed is added, the egg isn't duplicated, the egg consumption already here is skipped and the new one is
  added under Default, rice and Zed's consumption are added, and the config's day start stays this device's.
