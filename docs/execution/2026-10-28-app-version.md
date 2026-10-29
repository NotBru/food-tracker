# App version: build date on the homescreen, behind a Config switch

- **Date:** 2026-10-28
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen)

## Context

User: "I'd like a version update date (YYYYMMDDHHmm) (default off) in the UI".

## Decision

- The date is the build's: Vite stamps `__BUILT_AT__` (ISO, UTC) at build time; shown in local time as
  YYYYMMDDHHmm (`time.js versionStamp`).
- Config switch "App version" (`showVersion`, default off). On: "v202610281433", small and muted, in its own pill
  right of the sync status icon (user's ask: first it was under Import / Export, then inside the sync button). Config
  moved right with `margin-left: auto` instead of the icon's `margin-right: auto`.
- Short of room, the version stays whole (the user turned it on to read it): the "Merge conflict" label gives way
  first, then the user's name, with "…"; the cloud and Config never. The top bar's gaps and the icon's padding went
  down 2 px and 1 px to leave more room.
- Being in config, the switch syncs between devices like the rest of the settings.

## Alternatives considered

- **Commit date**: the Docker build has no `.git` (`.dockerignore`); the build date is when the version reached
  the server, which is what the user sees change.
- **Own button in the top bar**: one more button where the sync icon, its label, Config and the user already are.

## How it was checked

`npm run build`; the bundle holds the build time. `vite preview`, headless Chromium at 390 px: no version by
default; after switching it on and saving, "v202610281433" in its pill right of the icon, none under Import /
Export. At 390 and 375 px everything whole; 360 px: the user's name "Defa…"; 320 px with a conflict: the label
gone and the name "…", the cloud, version and Config whole.
