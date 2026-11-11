#!/usr/bin/env bash
# Run on the HOST (the laptop), not in the devcontainer: starts the emulator and opens its adb to the container.
#
#   android/scripts/host-emulator.sh            # no window: driven and screenshotted over adb
#   android/scripts/host-emulator.sh --window   # with its window (more memory: may hit the cap)
#
# 1. The emulator (AVD food-tracker), unless it's already running, detached (it outlives this terminal), in a
#    memory cgroup: at most 4.5 GB and no swap, so the kernel kills it instead of freezing the laptop. It refuses to
#    start with under 6 GB available, and it's first in line for the kernel's OOM killer if the laptop runs out.
#    1.5 GB for the phone, 2 cores, a cold boot (no saved RAM image). Its log: /tmp/food-tracker-emulator.log.
#    Stop it: `adb emu kill` (or close its window).
# 2. adb's server listening on every interface, in the foreground, so the container reaches it at 172.17.0.1:5037
#    (ADB_SERVER_SOCKET=tcp:172.17.0.1:5037). Anything that can reach that port can drive the emulator: trusted
#    networks only. Ctrl+C stops the server; the emulator keeps running.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/env.sh"
AVD=food-tracker
LOG=/tmp/food-tracker-emulator.log

CAP=4500M
NEED_KB=$((6 * 1024 * 1024))
WINDOW=(-no-window)
[ "${1:-}" = --window ] && WINDOW=()

if pgrep -f -- "-avd $AVD" >/dev/null; then
  echo "== The emulator is already running."
else
  avail_kb=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
  if [ "$avail_kb" -lt "$NEED_KB" ]; then
    echo "== Not starting the emulator: $((avail_kb / 1024)) MB available, it needs 6 GB. Close something first." >&2
    exit 1
  fi
  CHOOM=()
  if command -v choom >/dev/null; then CHOOM=(choom -n 1000 --); else echo "== (no choom: not first for the OOM killer)"; fi
  echo "== Starting the emulator (at most $CAP; log: $LOG)"
  setsid -f systemd-run --user --scope --quiet -p MemoryMax=$CAP -p MemorySwapMax=0 \
    "${CHOOM[@]}" emulator -avd "$AVD" -memory 1536 -cores 2 -no-snapshot -no-boot-anim -no-metrics "${WINDOW[@]}" \
    >"$LOG" 2>&1 </dev/null
fi

echo "== adb server for the container (Ctrl+C to stop it)"
adb kill-server 2>/dev/null || true
exec adb -a nodaemon server start
