#!/usr/bin/env bash
# Serve the food tracker (hot-reloading dev server) on port 5173.
#
# On the HOST:  ./serve.sh          (re)creates a "food-tracker" container from node:22 with this
#                                   repo mounted, publishing localhost:5173. It restarts with
#                                   Docker, so after running this once it comes back at every boot.
#               ./serve.sh --stop   removes that container
#               ./serve.sh --lan    publish on all host interfaces (phone etc.), not just localhost
#               Logs: docker logs -f food-tracker
#
# In a CONTAINER (that container, or the devcontainer):
#               ./serve.sh          start in the background (replaces a running one); log in app/serve.log
#               ./serve.sh --fg     run in the foreground
#               ./serve.sh --stop   stop it
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=5173
LOG="$DIR/app/serve.log"
NAME=food-tracker

if [[ ! -f /.dockerenv ]]; then
  command -v docker >/dev/null || { echo "docker not found" >&2; exit 1; }
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  [[ "${1:-}" == "--stop" ]] && exit 0
  BIND=127.0.0.1
  [[ "${1:-}" == "--lan" ]] && BIND=0.0.0.0
  # Run as the host user so files written into the repo (node_modules, log) stay yours.
  docker run -d --name "$NAME" --restart unless-stopped \
    -p "$BIND:$PORT:$PORT" \
    -v "$DIR:/workspace" -w /workspace \
    --user "$(id -u):$(id -g)" -e HOME=/tmp \
    node:22-bookworm-slim ./serve.sh --fg >/dev/null
  echo "Starting $NAME (first run pulls node:22 and may take a minute)..."
  for _ in $(seq 1 120); do
    if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
      echo "Serving at http://localhost:$PORT"; exit 0
    fi
    sleep 1
  done
  echo "Server did not come up; see: docker logs $NAME" >&2; exit 1
fi

# Shells started outside zsh (cron, postStartCommand, docker exec) lack fnm's PATH.
export PATH="$HOME/.fnm/aliases/default/bin:$PATH"

pkill -f "node .*vite.* --port $PORT" 2>/dev/null || true
[[ "${1:-}" == "--stop" ]] && exit 0

cd "$DIR/app"
[[ -d node_modules ]] || npm ci

CMD=(npx vite --host 0.0.0.0 --port "$PORT" --strictPort)
if [[ "${1:-}" == "--fg" ]]; then exec "${CMD[@]}"; fi

nohup "${CMD[@]}" > "$LOG" 2>&1 &
disown
for _ in $(seq 1 30); do
  if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
    echo "Serving on port $PORT (log: $LOG)"; exit 0
  fi
  sleep 1
done
echo "Server did not come up; see $LOG" >&2; exit 1
