# Rename: Logs → Consumptions

- **Date:** 2026-10-15
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (user renamed "logs" to "consumptions")

## Decision
- UI follows the new wording: home button and screen title "Consumptions", route `#/consumptions`,
  "+ add consumption", sheet titles "New consumption" / "Edit consumption", dashboard count "N consumptions".
- Code: `screens/Logs.jsx` → `screens/Consumptions.jsx`, `Logs` → `Consumptions`, `LogEditor` → `ConsumptionEditor`.
- **Storage unchanged:** the IndexedDB table stays `logs` (same reasoning as `items` for Foods: avoids a migration and
  keeps old exports importable). The old `#/logs` route was dropped; nothing links to it (the PWA starts at `/`).

## Verification
Headless Chromium: Home → Consumptions → add, edit, browse a day, back → home shows "1 consumption". No errors.
