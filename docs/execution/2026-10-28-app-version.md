# App version: build date on the homescreen, behind a Config switch

- **Date:** 2026-10-28
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen)

## Context

User: "I'd like a version update date (YYYYMMDDHHmm) (default off) in the UI".

## Decision

- The date is the build's: Vite stamps `__BUILT_AT__` (ISO, UTC) at build time; shown in local time as
  YYYYMMDDHHmm (`time.js versionStamp`).
- Config switch "App version" (`showVersion`, default off). On: "Version 202610281433", small and muted, centred
  under Import / Export at the bottom of the homescreen.
- Being in config, the switch syncs between devices like the rest of the settings.

## Alternatives considered

- **Commit date**: the Docker build has no `.git` (`.dockerignore`); the build date is when the version reached
  the server, which is what the user sees change.
- **Top bar**: on a phone it already holds the sync icon (with its "Merge conflict" label), Config and the user.

## How it was checked

`npm run build`; the bundle holds the build time. `vite preview`, headless Chromium at 390 px: no version by
default; after switching it on and saving, "Version 202610281433" under Import / Export.
