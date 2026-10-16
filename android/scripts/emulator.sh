#!/usr/bin/env bash
# Builds the app and runs it on an Android emulator.
#
#   android/scripts/emulator.sh          # create the AVD if needed, boot it headless, install and launch the app
#   android/scripts/emulator.sh install  # only build + install + launch, on whatever `adb devices` shows
#
# The emulator needs hardware acceleration (/dev/kvm). Without it (e.g. this devcontainer as configured), either
# pass /dev/kvm into the container (see android/README.md), or run the emulator on the host and connect to it with
# `adb connect host.docker.internal:5555` before `emulator.sh install`.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
source "$HERE/env.sh"
AVD=food-tracker
IMAGE="system-images;android-35;google_apis;x86_64"

install_and_launch() {
  echo "== Building and installing"
  (cd "$ROOT" && ./gradlew -q installDebug)
  adb shell am start -n app.foodtracker/.MainActivity
  echo "== Launched. Screenshot: adb exec-out screencap -p > screen.png"
}

if [ "${1:-}" = "install" ]; then
  install_and_launch
  exit 0
fi

if [ ! -e /dev/kvm ]; then
  echo "No /dev/kvm here, so the emulator can't run in this container. See android/README.md (Emulator)." >&2
  exit 1
fi
[ -x "$ANDROID_HOME/emulator/emulator" ] || "$HERE/setup-sdk.sh" --emulator

if ! avdmanager list avd -c | grep -qx "$AVD"; then
  echo "== Creating AVD $AVD"
  echo no | avdmanager create avd -n "$AVD" -k "$IMAGE" -d pixel_7
fi

if ! adb devices | grep -q emulator; then
  echo "== Booting $AVD (headless)"
  nohup emulator -avd "$AVD" -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect >/tmp/emulator.log 2>&1 &
  adb wait-for-device
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 2; done
fi
install_and_launch
