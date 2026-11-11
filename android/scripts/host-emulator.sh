#!/usr/bin/env bash
# Run on the HOST (the laptop), not in the devcontainer: starts the emulator and opens its adb to the container.
#
#   android/scripts/host-emulator.sh
#
# 1. The emulator (AVD food-tracker), unless it's already running, detached (it outlives this terminal), in a
#    memory cgroup: at most 6 GB and no swap, so the kernel kills it instead of freezing the laptop; 2 GB for the
#    phone, 2 cores, a cold boot (no saved RAM image). Its log: /tmp/food-tracker-emulator.log.
# 2. adb's server listening on every interface, in the foreground, so the container reaches it at 172.17.0.1:5037
#    (ADB_SERVER_SOCKET=tcp:172.17.0.1:5037). Anything that can reach that port can drive the emulator: trusted
#    networks only. Ctrl+C stops the server; the emulator keeps running (close its window to stop it).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/env.sh"
AVD=food-tracker
LOG=/tmp/food-tracker-emulator.log

if pgrep -f -- "-avd $AVD" >/dev/null; then
  echo "== The emulator is already running."
else
  echo "== Starting the emulator (at most 6 GB; log: $LOG)"
  setsid -f systemd-run --user --scope --quiet -p MemoryMax=6G -p MemorySwapMax=0 \
    emulator -avd "$AVD" -memory 2048 -cores 2 -no-snapshot -no-boot-anim -no-metrics >"$LOG" 2>&1 </dev/null
fi

echo "== adb server for the container (Ctrl+C to stop it)"
adb kill-server 2>/dev/null || true
exec adb -a nodaemon server start
