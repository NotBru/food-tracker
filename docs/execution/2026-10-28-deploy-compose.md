# Deploy: the backup server in compose, beside the web app

- **Date:** 2026-10-28
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Stack: production)

## Context

After deploying sync, every device showed "Sync failed": first a 502, then "Method not allowed". The server's
`compose.yaml` (`/srv/track-shit`, run by `deploy.sh` on each push) only had the web app. The backup container had
been started by hand (README's old "First time"), so:
- each deploy made a new web container on `proxy` only; the hand-made `docker network connect track-shit` was lost
  with the old one -> Caddy couldn't reach `backup:8080` (502);
- deploys never rebuilt the backup server: it predated the inbox (cc32820), and answered the app's inbox request
  with 405. The old app ignored that; sync stops on it.

## Decision

- Both services in `compose.yaml` (README "On the server"): the web app on `proxy` and the project's default
  network; the backup server on the default network only, reached by its service name `backup`. The data volume
  `track-shit-backup` is external: kept as is, and `docker compose down -v` can't delete it.
- `deploy.sh` unchanged: `docker compose up -d --build` now rebuilds and recreates both.
- One-off on the server: `docker rm -f backup` before the first such deploy (else two containers answer to
  `backup`), then `docker network rm track-shit`.
- `deploy/server/`: `compose.yaml`, `deploy.sh` (the server's, as it was) and `switch-to-compose.sh` (the one-off
  steps above). README's deploy section points at them; invite codes via `docker compose exec backup …`.

## Alternatives considered

- **Keep the external `track-shit` network, add it to the web service**: works, but the backup server would stay
  outside deploys and go stale again.
- **Compose file only in README**: copied by hand from Markdown, it drifts; the files are in `deploy/server/`
  (copied to `/srv/track-shit` from the clone, not symlinked: a pull shouldn't change the running setup unseen).

## Open questions

- The app shouldn't let an inbox failure block syncing (offered; not done).
