# Android app: dashboard bar notes and the "only nutrients with a target" switch, ported

- **Date:** 2026-11-03
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen, Config screen)

## Context

The user asked to port [bar-notes](2026-11-03-bar-notes.md) and [only-targets](2026-11-03-only-targets.md) right away.

## Decision

- core.js `home`: style "bars" rows carry `notes` (dashboard.js `barNotes`: top, bottom, budget) and take its bar,
  which has a scale without a target; "gauges" keeps `barFor` (the full grey gauge).
- `HomeScreen.kt` `BarRow`: name and unit column, then a lane of notes drawn on a Canvas (TextMeasurer), the 8 dp
  bar, a lane below, the budget lane. `spreadNotes` is the web's, line for line.
- Config: the switch added to `ConfigScreen.kt` `SWITCHES`.
- Checked with Robolectric screenshots of views recorded from core.js (`FIXTURES_DIR`), against the web's with the same
  data: the same numbers in the same places. Not on the emulator: it had closed (memory) before the build.

## Open questions

- Scanning the backup secret's QR code in the app is still in `android/README.md` Next port.
