# Sync icon: yellow until the first check answers; yellow when out of reach

- **Date:** 2026-10-29
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (homescreen: sync status)
- **Builds on:** [sync-check](2026-10-29-sync-check.md), [sync-yellow](2026-10-29-sync-yellow.md)

## Context

User in chat: "Yellow right after loading the app, until the ping arrives (and if it's synced, right? otherwise, it
syncs while showing yellow)" and "Yellow if after attempting a second ping the server is unreachable."
A check took ~0.33 s from the dev container to production on an open connection (~1 s with a new TLS connection);
from a phone near the server, less.

## Decision

- **Opening and coming back** start with the hash check instead of a full sync: yellow until it answers; unchanged
  and nothing here waiting → green (and "last synced" is then); else a sync, still yellow.
- **Out of reach** (the request never got an answer, `offline` on the error) is no longer a red sync failure: two
  checks or syncs in a row without an answer → yellow, hover "Can't reach the backup server; trying again every 5 s".
  The first miss as the app opens stays yellow (checking) until the second. An answer clears it; changes made
  meanwhile go up on the first check that gets through.
- Red stays for answers that are errors (bad signature, clock, size, newer format…).
- A sync that failed out of reach isn't retried at once (it would loop): the 5 s checks do it.

## How it was checked

`npm run build`. Local backup server and `vite preview`, Playwright polling the icon every 50 ms: a normal load was
green at 99 ms after one 204 (yellow too short to see); with the check held 1.5 s, yellow until 1.57 s, then green;
with every backup request failing, yellow (checking) from load, yellow "Can't reach…" at 5.06 s; requests let
through again, green 3 s later at the next check.
