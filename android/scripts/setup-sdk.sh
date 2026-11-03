#!/usr/bin/env bash
# Installs what's needed to build the Android app (and, with --emulator, to run it in an emulator): in this
# container, or on any Debian/Ubuntu/Mint machine. Everything goes under $ANDROID_HOME (~/android-sdk), except the
# JDK and the emulator's libraries (apt, with sudo).
#
#   android/scripts/setup-sdk.sh             # JDK 17 + SDK (platform, build-tools, platform-tools)
#   android/scripts/setup-sdk.sh --emulator  # + emulator and an x86_64 system image (needs /dev/kvm to be usable)
#
# Safe to re-run, also after a failure or Ctrl+C: what's already there is skipped, the rest is done again.
# Each step says what it's doing; downloads show their progress. A failure names the step and command.
#
# Afterwards: source android/scripts/env.sh  (sets JAVA_HOME, ANDROID_HOME, PATH)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/env.sh"

CMDLINE_TOOLS_ZIP=commandlinetools-linux-11076708_latest.zip
PLATFORM="platforms;android-35"
BUILD_TOOLS="build-tools;35.0.0"
SYSTEM_IMAGE="system-images;android-36.1;google_apis;x86_64"
EMULATOR=$([ "${1:-}" = "--emulator" ] && echo 1 || true)

STEP="starting"
step() { STEP="$*"; echo; echo "== $*"; }
trap 'rc=$?; echo; echo "!! Failed during: $STEP" >&2; echo "!! Command: $BASH_COMMAND (exit $rc)" >&2' ERR

step "Java 17"
if command -v java >/dev/null && java -version 2>&1 | grep -q '"17'; then
  echo "Already there: $(java -version 2>&1 | head -1)"
else
  echo "Installing OpenJDK 17 with apt (asks for your password)."
  sudo apt-get update -q
  sudo apt-get install -y -q --no-install-recommends openjdk-17-jdk-headless
  source "$HERE/env.sh" # now that JAVA_HOME exists
fi
echo "JAVA_HOME=$JAVA_HOME"

step "Android command-line tools (sdkmanager) in $ANDROID_HOME"
if [ -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "Already there."
else
  tmp="$(mktemp -d)"
  echo "Downloading $CMDLINE_TOOLS_ZIP"
  curl -fL --progress-bar "https://dl.google.com/android/repository/$CMDLINE_TOOLS_ZIP" -o "$tmp/tools.zip"
  echo "Unpacking"
  unzip -q "$tmp/tools.zip" -d "$tmp"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  mv "$tmp/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  rm -rf "$tmp"
  echo "Installed."
fi

# sdkmanager reads Google's package list from the network before anything else: a hang here is the network.
step "Accepting the SDK licences (sdkmanager --licenses; fetches the package list first)"
yes | sdkmanager --licenses >/dev/null || true
echo "Done."

packages=(platform-tools "$PLATFORM" "$BUILD_TOOLS")
if [ -n "$EMULATOR" ]; then
  packages+=(emulator "$SYSTEM_IMAGE")
  step "The emulator's system libraries (apt)"
  # X11/GL/sound bits it links against even when headless. The sound library was renamed in Ubuntu 24.04 / Mint 22.
  asound=$(apt-cache show libasound2t64 >/dev/null 2>&1 && echo libasound2t64 || echo libasound2)
  sudo apt-get install -y -q --no-install-recommends libpulse0 libxcomposite1 libxcursor1 libxdamage1 libxi6 \
    libxtst6 libnss3 libxkbfile1 libgl1 libegl1 libxkbcommon-x11-0 "$asound"
fi

step "SDK packages: ${packages[*]}${EMULATOR:+ (the system image is ~1.5 GB)}"
sdkmanager --install "${packages[@]}"

step "Installed"
sdkmanager --list_installed 2>/dev/null | sed -n '/^Installed packages:/,$p'
echo
echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"
echo "Next: source android/scripts/env.sh"
if [ -n "$EMULATOR" ] && [ ! -w /dev/kvm ]; then
  echo "Note: /dev/kvm isn't usable by you, so the emulator won't start. On a normal machine:"
  echo "  sudo usermod -aG kvm \$USER  (then log out and in). In this container: see android/README.md."
fi
