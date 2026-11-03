# Android app: an F-Droid repo on the VPS

- **Date:** 2026-11-03
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Stack: Android app)

## Context

The user wants updates to reach the phone without copying APKs (Gmail refuses them): their VPS as an F-Droid repo.
Builds happen in this devcontainer; it has no SSH to the VPS. Deploys run from the push hook on the laptop.

## Decision

- `fdroidserver` (uv tool) makes a static repo in `android/fdroid/` (`config.yml`, `metadata/` in git; `repo/` not).
  `android/scripts/publish.sh` copies the release APK in as `app.foodtracker_<versionCode>.apk` and runs
  `fdroid update`; it refuses an already-published versionCode with a different APK (a forgotten bump would never
  reach the phone). Older than 3 versions go to `archive/`, which isn't uploaded.
- Index signed by its own key, `fdroid-repo`, in the app's keystore (`.secrets/android-release.p12`, same password):
  one file to back up. SHA-256 `D5:C1:8F:73:9E:42:35:B3:07:07:B8:DD:83:51:F3:C6:8B:EA:1B:25:12:A3:2E:13:E9:F5:D3:B1:2F:09:57:E2`.
  The key stays here; the VPS only serves files, so it can't sign an index.
- Upload: the push hook rsyncs `android/fdroid/repo/` to `/srv/track-shit/fdroid/repo/` before deploying (the user's
  choice, over an SSH key for Claude, committing APKs to git, or running rsync by hand). Claude may not edit
  `.git/hooks`, so the new hook is `deploy/hooks/reference-transaction`, for the user to copy in.
- Served by the web container: compose mounts `./fdroid/repo` read-only at `/srv/fdroid/repo`; Caddy's
  `/fdroid/repo/*` is a file server with `no-cache`.

## Consequences

- One-offs by the user: install the hook; after the push, copy the new `compose.yaml` on the server and run
  `./deploy.sh`; add the repo in F-Droid (URL with fingerprint, android/README.md).
- rsync must be installed on the laptop and the VPS.
- The repo is public, as the web app already is.
