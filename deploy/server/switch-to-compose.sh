#!/bin/sh
# One-off (2026-10-28): the backup server moves from a hand-made container into compose.yaml.
# Run after copying compose.yaml and deploy.sh into /srv/track-shit. Its data stays on the volume.
set -eu
cd /srv/track-shit

# The hand-made one; left running, two containers would answer to "backup".
docker rm -f backup 2>/dev/null || true
./deploy.sh
# Nothing uses it any more.
docker network rm track-shit 2>/dev/null || true
docker compose ps
