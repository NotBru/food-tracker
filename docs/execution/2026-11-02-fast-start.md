# Faster start: reference foods made when needed; opens from the cache

- **Date:** 2026-11-02
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Stack); request in chat

## Context

The user opens the app from Firefox's home-screen shortcut and found it slow to load: "enormous" online, ~5 s even
in airplane mode.

Measured in headless Chromium with the user's data (324 consumptions, 89 of them CIQUAL/USDA foods), offline,
CPU throttled 4× (roughly a phone): the dashboard drew at ~1.6 s. The app code and first render took ~0.2 s and the
two bundled tables (`ciqual.json` 1.4 MB, `fdc.json` 3.1 MB) were read from the cache by ~0.4 s. Then ~0.75 s went
into `loadContext` making all ~11.6k reference foods into app foods (`ciqualDraft`/`fdcDraft`, a Δ per value from its
digits), every launch, although the dashboard needs a handful. The dashboard's own computation took ~0.2 s.

Online, the service worker was network first: every launch waited for the server's answer to the page and each
file before falling back to the cache, with no time limit. On a weak signal that's the "enormous" wait; in airplane
mode the request fails at once, which is why it was faster there.

## Decision

- **Reference foods made when asked for** (`external.js` `lazyFoods`): each table is indexed by id (cheap), and a
  food is made on its first `get(id)` and kept. `ctx.items` is a small `Foods` class (`calc.js`): the user's foods,
  then the tables'; `with(id, item)` replaces the `new Map(ctx.items).set(…)` copies for unsaved drafts (copying would
  have meant making every reference food). `ctx.generic` became `ctx.generic()`, which makes all of them on its first
  call: only searches (food picker, Foods, Explore) use it.
- **Service worker cache first, refreshed behind** (stale-while-revalidate, `public/sw.js`): a cached answer goes out
  at once and the network's answer replaces it in the cache for next time. Not cached: other origins (Open Food
  Facts), `/backup/`, `/off-search/`. A fetched page is only cached once the `/assets/` files it names are, so the next
  launch works offline; then the files no page uses any more (old versions') are deleted.

Result, same setup: dashboard at ~0.65 s offline, online, and with the server taking 3 s per answer (was ~1.6 s
offline). Dashboard, weekly view, consumptions of two days, food search, graphs, explore, a CIQUAL food, a recipe with
reference components and the new-consumption form gave the same text in the old and the new build. A simulated
deploy: launch 1 showed the old version, launch 2 the new, and an offline launch 3 the new.

## Alternatives considered

- **Precompute values and Δs in `scripts/ciqual.py` / `fdc.py`**: makes the conversion cheaper but still converts
  everything, and changes the table formats the log-food skill reads too.
- **Store the made foods in IndexedDB**: reading 11.6k objects back costs about as much.
- **Network first with a timeout**: still waits up to the timeout on every launch with a weak signal.

## Consequences

- A new version shows one launch after it's deployed (the "App version" pill tells which one is running).
- The two tables are still fetched from the cache and parsed every launch (~0.2 s at 4× throttling). Loading them only
  when a consumption or recipe uses a reference food would save that; not done, since most days do.
- Firefox's own start (cold, from the home-screen shortcut) isn't the app's and isn't measured here; it's measured in
  Chromium, not Firefox on a phone.
