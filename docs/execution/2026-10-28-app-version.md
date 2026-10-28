# App version: build date on the homescreen, behind a Config switch

- **Date:** 2026-10-28
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen)

## Context

User: "I'd like a version update date (YYYYMMDDHHmm) (default off) in the UI".

## Decision

- The date is the build's: Vite stamps `__BUILT_AT__` (ISO, UTC) at build time; shown in local time as
  YYYYMMDDHHmm (`time.js versionStamp`).
- Config switch "App version" (`showVersion`, default off). On: "202610281433", small and muted, right of the cloud
  in the sync status button (user's ask; it was first under Import / Export), and in its hover text. Short of room
  (a narrow phone with "Merge conflict"), the version shrinks first, then the label, with "…"; Config and the user
  button don't shrink.
- Being in config, the switch syncs between devices like the rest of the settings.

## Alternatives considered

- **Commit date**: the Docker build has no `.git` (`.dockerignore`); the build date is when the version reached
  the server, which is what the user sees change.
- **Own button in the top bar**: one more button where the sync icon, its label, Config and the user already are.

## How it was checked

`npm run build`; the bundle holds the build time. `vite preview`, headless Chromium at 390 px: no version by
default; after switching it on and saving, "202610281433" inside the sync button and in its hover text, none under
Import / Export. Whole from 360 px; at 320 px cut to "20261…" (and with "Merge conflict", hidden, the label cut),
Config and the user button whole either way.
