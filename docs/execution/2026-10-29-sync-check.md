# Sync: a check by the backup's hash every 5 s while the app is shown

- **Date:** 2026-10-29
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen: backup)
- **Builds on:** [sync](2026-10-28-sync.md), [sync-yellow](2026-10-29-sync-yellow.md)

## Context

Another device's changes (or the log-food skill's) reached an open app only at the 15-minute sync, which downloads
the whole backup (~50 KB gzipped and encrypted). User in chat: "use a hash to compare, and ping every 5 seconds".

## Decision

- **Server**: a GET of the backup whose signed `X-Prev` is the current version (already the first 16 bytes of the
  blob's SHA-256) gets 204 with `X-Version`, no body. Other GETs are as before (the tool's, a full sync's).
- **App**: every 5 s while shown, unless a sync runs, there are changes here (they sync anyway) or conflicts wait:
  that GET with the base's version. A different version → a full sync (yellow, as any sync). The check itself
  doesn't touch the icon, and its failures are quiet (the syncs report them).
  - Against a server without the 204 the answer is the whole backup, but its `X-Version` still tells: no sync.
- The 15-minute sync stays (it also takes in the inbox of older tool versions).

## Alternatives considered

- **HTTP 304 with If-None-Match**: the natural code, but a 304 to a request the browser didn't make conditional
  (`cache: 'no-store'`) isn't handled the same everywhere; 204 is a plain success.
- **Reusing the check's download for the sync** (it fetched the backup when changed): saves one ~50 KB download per
  change, at the cost of threading it through `sync()`; not worth it for now.

## How it was checked

`npm run build`, `node --check backup/server.mjs`. Local backup server and `vite preview`, Playwright with two
browser contexts on one secret: idle, A's checks came every 5 s, each a 204; B saved a weigh-in, A's next check got
200 and A showed it 2.3 s after B saved.
