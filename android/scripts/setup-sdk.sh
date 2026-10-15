#!/usr/bin/env bash
# Installs what this container needs to build the Android app (and, with --emulator, to run it in an emulator).
# Idempotent: re-running skips what is already there. Everything goes under $HOME, except the JDK (apt).
#
#   android/scripts/setup-sdk.sh             # JDK 17 + SDK (platform, build-tools, platform-tools)
#   android/scripts/setup-sdk.sh --emulator  # + emulator and an x86_64 system image (needs /dev/kvm to be usable)
#
# Afterwards: source android/scripts/env.sh  (sets JAVA_HOME, ANDROID_HOME, PATH)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/env.sh"

CMDLINE_TOOLS_ZIP=commandlinetools-linux-11076708_latest.zip
PLATFORM="platforms;android-35"
BUILD_TOOLS="build-tools;35.0.0"
SYSTEM_IMAGE="system-images;android-35;google_apis;x86_64"

if ! command -v java >/dev/null || ! java -version 2>&1 | grep -q '"17'; then
  echo "== Installing OpenJDK 17"
  sudo apt-get update -qq
  sudo apt-get install -y -qq --no-install-recommends openjdk-17-jdk-headless
  source "$HERE/env.sh" # now that JAVA_HOME exists
fi

if [ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "== Installing Android command-line tools into $ANDROID_HOME"
  tmp="$(mktemp -d)"
  curl -fsSL "https://dl.google.com/android/repository/$CMDLINE_TOOLS_ZIP" -o "$tmp/tools.zip"
  unzip -q "$tmp/tools.zip" -d "$tmp"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  mv "$tmp/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  rm -rf "$tmp"
fi

yes | sdkmanager --licenses >/dev/null || true
packages=(platform-tools "$PLATFORM" "$BUILD_TOOLS")
if [ "${1:-}" = "--emulator" ]; then
  packages+=(emulator "$SYSTEM_IMAGE")
  # The emulator's runtime libraries (X11/GL bits it links against even when headless).
  sudo apt-get install -y -qq --no-install-recommends libpulse0 libxcomposite1 libxcursor1 libxdamage1 libxi6 \
    libxtst6 libnss3 libxkbfile1 libgl1 libegl1 libxkbcommon-x11-0 libasound2t64 >/dev/null
fi
echo "== sdkmanager: ${packages[*]}"
sdkmanager --install "${packages[@]}" >/dev/null

echo "== Done. JAVA_HOME=$JAVA_HOME ANDROID_HOME=$ANDROID_HOME"
[ -e /dev/kvm ] || [ "${1:-}" != "--emulator" ] || echo "Note: /dev/kvm is missing, so the emulator can't run here. See android/README.md."
