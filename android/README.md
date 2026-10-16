# Food Tracker (native Android)

Kotlin + Jetpack Compose port of the web app in `../app`. Same screens, same calculations (errors carried as
worst-case intervals), and the same export file format, so a JSON export from either app imports into the other.
Data lives in an on-device SQLite database (Room).

Design: `../docs/instructions/design.md` · Decisions: `../docs/execution/2026-10-15-android-port.md`

## Setup (once per container)

```sh
android/scripts/setup-sdk.sh            # JDK 17 + Android SDK (platform 35, build-tools); idempotent
android/scripts/setup-sdk.sh --emulator # also the emulator and an x86_64 system image
source android/scripts/env.sh           # JAVA_HOME, ANDROID_HOME, PATH (for adb, emulator, …)
```

The SDK goes to `~/android-sdk`, outside the repo. The devcontainer's `.devcontainer/` is read-only from inside
the container, so the setup is a script; to bake it into the image instead, add
`RUN /workspace/android/scripts/setup-sdk.sh` (or its steps) to the Dockerfile.

## Build and test

```sh
cd android
./gradlew assembleDebug       # app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest   # maths, storage/import/export, and UI flows (Robolectric)
```

The UI tests drive the real screens and save a screenshot of each to `app/build/screenshots/`.
`assembleRelease` gives an APK signed with the debug key, for testing only.

## Emulator

```sh
android/scripts/emulator.sh           # create AVD, boot headless, install, launch
android/scripts/emulator.sh install   # just build + install + launch on the connected device/emulator
```

The emulator needs KVM. This container doesn't have `/dev/kvm` as configured; two ways to get there:

1. **Emulator inside the container**: on the host, add `"--device=/dev/kvm"` to `runArgs` in
   `.devcontainer/devcontainer.json`, rebuild the container, then run `android/scripts/emulator.sh`. (Your user
   on the host must be able to access `/dev/kvm`, typically via the `kvm` group.)
2. **Emulator on the host** (Android Studio's, or `emulator -avd …`): start it, then on the host run
   `adb -s emulator-5554 tcpip 5555` and in the container `adb connect host.docker.internal:5555`
   (on Linux hosts add `--add-host=host.docker.internal:host-gateway` to `runArgs`), then
   `android/scripts/emulator.sh install`. Or just install `app-debug.apk` from the host:
   `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

## Layout

- `data/` — models (same JSON shape as the web app), `Calc.kt` (port of `calc.js`), `Nutrients.kt`, `Time.kt`,
  Room storage (`Db.kt`), `Repo.kt` (queries, import/export), `External.kt` (CIQUAL, Open Food Facts).
- `ui/` — one file per screen, shared components, the dashboard drawing (`Dashboard.kt`), a plain back stack (`Nav.kt`).
- The CIQUAL table is not duplicated: the build copies `../app/public/ciqual.json` into the APK's assets.
