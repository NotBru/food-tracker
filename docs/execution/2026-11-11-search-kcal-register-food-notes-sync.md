# Food searches with kcal per 100 g; "+ register food"; notes saved behind; the Android app synced before it sleeps

- **Date:** 2026-11-11
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Stack; Consumptions, Foods, Temp notes, Config)

## Context

The user's TODOs (TODOs.md): calories per 100 g in the search bar (a Config switch, on by default); a "register food"
button under the search while logging a consumption; saving a note without waiting for any sync; the Android app
staying up in the background until it's synced; attribute fields not starting with a capital. Shipped as Android 0.2.4.

## Decision

- **kcal per 100 g**: `calc.js kcalPer100` (100 g, else 100 ml; null if neither converts or nothing's known; `~` when
  estimated from the macros). Shown muted after each match of the food picker (components.jsx ItemPicker; Android
  `FoodPicker` through core.js `foodSearch`'s `per100`). Config `searchKcal`, default on, in the Food database block.
  The Foods list already shows each food's macros per its own amount, so it's left as is.
- **"+ register food"**: a link right under the consumption editor's search box (above the matches, so it's there when
  nothing matches), for the food itself, not a concoction's components (those have the + already). Same pattern as a
  new component (Foods.jsx `parents`): the editor's consumption and form are stashed with the screen's hash
  (consumptionForm.js `stashForNewFood`; Android `ConsumptionStash`), `/foods/new?for=consumption&name=<typed>` opens,
  saving it records the new id, and back on that hash the editor opens again as it was, the new food picked (its unit
  and entry error as when picking it). Works from the Consumptions list and from a consumption's info screen (✎).
  Going back without saving restores the editor unchanged.
- **Notes**: Save closes the editor at once and the note is saved behind it (web and Android; a failure is still told).
  Nothing in saving a note waits on the network now: deleting removed pictures from the server isn't awaited. The note
  goes into IndexedDB, and the sync it sets off is already in the background.
- **Android, synced before it sleeps**: Android freezes a backgrounded app within seconds, often mid-sync (the web app
  syncs as it's hidden). `SyncJob` (JobScheduler; expedited on Android 12+, so it starts at once, no notification) is
  scheduled in `onStop` with a backup set up, and holds the process while the sync icon says syncing or waiting, at
  most a minute (1.5 s first, for the sync the hiding starts to say so). Checked on the emulator: it ran on leaving
  the app and ended once synced.
- **Attributes**: the Android app's boxes were already uncapitalized (0.2.2); the web's now have
  `autocapitalize="none"` too.

## Alternatives considered

- **A foreground service** to stay up — needs a notification and, since Android 12, may not start from the background
  (onStop is already background). A job does it without either.
- **Notes: a "saving…" state on the button** — still a wait; closing at once is what was asked.
- **"Register food" as the + beside the box** (as components have) — asked for under the search bar, as a labelled
  button.

## Consequences

- A sync still running after a minute in the background is cut short as before (the next opening finishes it).
- A note that fails to save after its editor closed only shows an alert (the text is lost); it's a local IndexedDB write,
  so that's unlikely.
- The stashes are in memory: a reload (or the app killed) while making the new food drops them.
