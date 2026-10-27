# Food Tracker

A personal food and nutrient tracker that runs entirely on your device: no account, no sync, and the server only
ever holds an encrypted backup if you ask for one.
Log what you eat, see how it adds up against your targets, and know how sure each number is: every amount and
every nutrient value carries an error (± Δ), and totals are worked out worst case.

A web app (PWA) in [`app/`](app/README.md): Vite + React; data in the browser's IndexedDB.

## What it does

- **Foods**: ingredients, recipes (made of other foods) and concoctions (a recipe made at a given time,
  e.g. Tuesday's soup) are all just foods, picked from one search. Each has its own units (1 slice = 30 ± 5 g),
  and recipes get their nutrients from their components. An Info tab shows every value with its error, and its
  energy by macro.
- **Consumptions**: what you ate, when, and how much, per day. Tapping one opens its info: a pie of its calories
  from fat, protein and carbs (each split into its kinds: saturated, sugars, …) and every nutrient, for exactly
  that amount.
- **Dashboard**: daily, last 7 days, weekly and monthly totals against your targets, as gauges or bars, with the
  error range drawn as a hatched band. The daily calorie range is corrected for the week so far. Tap a nutrient
  to see which consumptions it came from.
- **Targets**: min and/or max per nutrient, valid from a date until the next target.
- **External databases**: generic foods from [CIQUAL](https://ciqual.anses.fr/) and [USDA FoodData Central](https://fdc.nal.usda.gov/)
  (bundled, in the food search), and prefill a new food from
  [Open Food Facts](https://world.openfoodfacts.org/) (packaged products, by name or barcode).
- **Users**: several people on one device; foods are shared, consumptions and targets are per user.

## Quick start (web)

```sh
cd app
npm install
npm run dev        # http://localhost:5173, hot reload
npm run build      # static files in app/dist/
```

To have it served all the time from Docker on the host, run `./serve.sh` there: it sets up a `food-tracker`
container on `localhost:5173` that comes back at every boot (`--lan` to reach it from a phone, `--stop` to remove
it). The comments at the top of the script explain the details.

Open Food Facts' text search needs the `/off-search` proxy that the Vite server and the production image provide
(see `app/vite.config.js`, `deploy/web/Caddyfile`). A plain static host doesn't have it, so product names won't
search there; barcodes, CIQUAL and USDA still work.

## Deploy

Production: **https://track-shit.notbru.xyz**, from `master`. The address is final: IndexedDB data is tied to the
origin. Images are built from a clone of this repo; each serves plain HTTP (TLS is the host's reverse proxy).

| Image | Dockerfile | Build context | Port |
|-------|------------|---------------|------|
| web app | `deploy/web/Dockerfile` | repo root | 80 |
| backup server | `deploy/backup/Dockerfile` | repo root | 8080 |

```sh
docker build -f deploy/web/Dockerfile -t track-shit-web .
docker build -f deploy/backup/Dockerfile -t track-shit-backup .
```

- **web app**: the built `app/dist/` served by Caddy, plus `/off-search/*` relayed to
  `https://search.openfoodfacts.org` (prefix stripped), at most 10 a minute for all users together (OFF's per-IP
  search limit; past it, 429 with `Retry-After`). `/assets/*` is cached `immutable`; everything else is
  `no-cache`. `/backup/*` is relayed to `$BACKUP_UPSTREAM` (default `backup:8080`, the backup container on a shared
  network). No volume, no state. Routing is in the hash, so no `index.html` fallback.
- **backup server** (`backup/server.mjs`): encrypted blobs, one per public key plus an inbox, at most 4 MB each
  (`MAX_BYTES`). Keep
  `/data` on a volume. Invite codes are made by hand: `docker exec <container> node server.mjs invite <name>`
  prints a single-use code; `list` and `remove <key>` too.

### First time (the backup server)

The web app's Caddy reaches the backup server as `backup:8080`, so both containers share a network and the backup
one is named `backup` (or set `BACKUP_UPSTREAM` on the web container to wherever it is). Only the web container is
published; the backup one needs no port of its own.

```sh
docker network create track-shit
docker volume create track-shit-backup
docker run -d --name backup --network track-shit --restart unless-stopped -v track-shit-backup:/data track-shit-backup
docker network connect track-shit <web container>
```

### Updating

`git pull`, rebuild both images, recreate both containers (same names, network and volume).

- **web app**: no state. Each browser gets the new version on its next load (the service worker fetches network
  first). Data on the devices is untouched.
- **backup server**: everything is on the `/data` volume (codes, keys, backups), so it survives. While it's down,
  uploads fail and the app retries by itself within 15 minutes; restores say the server can't be reached.
- Changing the address loses every device's data and backup secret (both are tied to the origin).
- The backup protocol (`food-tracker-backup/1`) and file format (`FTB1`) are versioned: a change to either must
  keep accepting the old ones, as open tabs and stored backups still use them. Backups hold a normal export, so an
  old one restores into a newer app through the import migrations.

## Your data

- Everything stays on the device, in the browser's IndexedDB. The app asks the browser not to
  evict it, but **clearing the browser's site data deletes it**, and so does changing the address the app is
  served from.
- **Export databases** on the homescreen saves everything to a JSON file. **Import databases** merges one into
  the current data (same-named users are one; entries already here are skipped) or replaces it. That's how you move your data to a new device or address.
- **Backup** (Config → Backup) keeps an encrypted copy on the server, with a invite code. The secret stays on your
  devices; show it as a QR to restore on another one. Lose every copy of it and the backup is lost.
- **Logging with Claude**: paste what you ate to Claude Code in this repo; the `log-food` skill
  (`.claude/skills/log-food/`) asks what it needs, estimates with wide error margins, and pushes the entries to the
  backup's inbox, which the app merges in when it's next open. It needs your backup secret once.

## Repository layout

```
app/                  web app
  src/                screens/, calc.js (nutrient and error maths), db.js (IndexedDB schema, import/export),
                      external.js (CIQUAL, USDA, Open Food Facts), nutrients.js, time.js
  public/ciqual.json  CIQUAL table, generated by app/scripts/ciqual.py
  public/fdc.json     USDA table (Foundation Foods, SR Legacy), generated by app/scripts/fdc.py
docs/instructions/    what to build: requirements, kept terse (design.md)
docs/execution/       how it was built: one entry per decision, indexed in its README
backup/server.mjs     backup server (Node, no dependencies)
deploy/web/           production image of the web app (Dockerfile, Caddyfile)
deploy/backup/        production image of the backup server
serve.sh              runs the dev server in its own Docker container
```

## How this project is worked on

Requirements live in [`docs/instructions/`](docs/instructions/): kept terse and in sync with the app, for easy human review.
Agents (Claude) log every non-trivial decision in [`docs/execution/`](docs/execution/README.md): the context,
what was decided, the alternatives, and how it was checked. See [`CLAUDE.md`](CLAUDE.md).

## Data sources and licences

- **CIQUAL**: ANSES, French food composition table, [Licence Ouverte / Etalab 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/).
  Credit "ANSES-CIQUAL".
- **USDA FoodData Central**: Foundation Foods and SR Legacy, U.S. Department of Agriculture, public domain
  ([CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)). Credit "USDA FoodData Central".
- **Open Food Facts**: community-made, [ODbL](https://opendatacommons.org/licenses/odbl/). Queried live; values
  are as printed on the labels, so check them against the pack.
