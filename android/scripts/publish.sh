#!/usr/bin/env bash
# Puts the release APK into the app's F-Droid repo (android/fdroid) and signs the repo's index again.
# The next push to master uploads android/fdroid/repo/ to the server (the push hook), where F-Droid finds it.
#
#   ./gradlew assembleRelease && scripts/publish.sh      (from android/, in the dev container)
#
# Run in the dev container: it has fdroidserver; android/fdroid/ is the laptop's folder too, so pushing from the laptop
# uploads what this made. Also needs ../.secrets/android-release.{p12,properties}.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
source "$HERE/env.sh"
KEYS="$ROOT/../.secrets/android-release.properties"
APK="$ROOT/app/build/outputs/apk/release/app-release.apk"
META="$ROOT/app/build/outputs/apk/release/output-metadata.json"
die() { echo "$*" >&2; exit 1; }

command -v fdroid >/dev/null || die "fdroid not found: run this in the dev container (it has fdroidserver), then push from anywhere."
[ -f "$KEYS" ] || die "No $KEYS: the keys that sign the app and the repo."
[ -f "$APK" ] || die "No signed release APK: ./gradlew assembleRelease first."
[ "$APK" -nt "$ROOT/app/build.gradle.kts" ] || die "The APK is older than app/build.gradle.kts: build it again."

CODE="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["elements"][0]["versionCode"])' "$META")"
NAME="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["elements"][0]["versionName"])' "$META")"
DEST="$ROOT/fdroid/repo/app.foodtracker_$CODE.apk"
mkdir -p "$ROOT/fdroid/repo"
if [ -f "$DEST" ]; then
  # F-Droid only offers a higher versionCode, so a new build under an old one would never reach the phone.
  cmp -s "$APK" "$DEST" || die "versionCode $CODE is already published with another APK: bump versionName's patch and versionCode (app/build.gradle.kts)."
  echo "$NAME ($CODE) is already in the repo; signing its index again."
else
  cp "$APK" "$DEST"
fi

cd "$ROOT/fdroid"
FDROID_KEY_PASS="$(sed -n 's/^storePassword=//p' "$KEYS")" fdroid update
echo "== $NAME ($CODE) in android/fdroid/repo. Push to master to upload it."
