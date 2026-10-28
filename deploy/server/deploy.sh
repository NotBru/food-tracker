#!/bin/sh
# Update track-shit to the latest master and rebuild it. Run over SSH by the
# reference-transaction hook in the food-tracker clone after each push
set -eu
cd /srv/track-shit

exec 9>.deploy.lock
flock 9     # one deploy at a time

git -C src pull --ff-only
docker compose up -d --build
docker image prune -f
