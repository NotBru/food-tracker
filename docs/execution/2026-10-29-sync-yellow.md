# Sync icon: yellow while syncing; a sync as the app opens

- **Date:** 2026-10-29
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (homescreen: sync status)
- **Supersedes:** in [sync](2026-10-28-sync.md), "Syncing" not shown as yellow, and the first sync 2 s after opening

## Context

User in chat: "Does the cloud icon show yellow when *pulling*? it should also start the webpage with a pull and thus
look yellow for a second (or whatever it takes)". It didn't: yellow meant only changes here waiting (or never synced),
and the first sync came 2 s after opening.

## Decision

- `status()` has a `syncing` state, after a conflict (no sync runs then) and before an error (a new attempt shows as
  one): yellow with the same … glyph as waiting, hover "Syncing…" with the last sync's time.
- The first sync starts as the app opens (`syncSoon(0)`), so it opens yellow until the backup has been checked.
- Accepted: the 15-minute check now turns the icon yellow for as long as it takes (the flicker the earlier entry
  avoided); the user wants to see each pull.

## How it was checked

`npm run build`; `vite preview` with headless Chromium, a made-up secret and the backup requests held open: the icon
was yellow ("Syncing… Last synced …") 128 ms after load, and red ("Sync failed: Couldn't reach the backup server")
once they were let fail.
