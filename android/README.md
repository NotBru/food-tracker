# Food Tracker (Android)

Native screens over the web app's own logic. The web app (`../app`) runs inside the app, in a WebView: its data,
calculations and sync are the only copy. Screens that are native (Kotlin + Jetpack Compose) draw over it; the
others are the web app's own, drawn by that WebView. The web build is bundled in the APK, so it opens offline and
its logic always matches the native screens.

Design: `../docs/instructions/design.md` · Decisions: `../docs/execution/2026-11-03-native-ui.md`,
`../docs/execution/2026-11-03-android-engine.md`

## Native screens

| Route | Screen | Ports (layout) | Its data (shared with the web) |
|-------|--------|----------------|--------------------------------|
| `/` | `ui/HomeScreen.kt` | `app/src/screens/Home.jsx` | `app/src/dashboard.js`, `app/src/native/core.js` `home` |
| `/consumptions` | `ui/ConsumptionsScreen.kt` | `app/src/screens/Consumptions.jsx` | `app/src/consumptionForm.js`, core.js `consumptions`, `consumptionEditor` |

Shared controls (top bar, sheets, food picker, …): `ui/Kit.kt`. Routes not listed are the web app's screens.

## Re-porting (about weekly)

1. Rebuild the APK from the current checkout: the web app's logic and screens come in as they are.
2. For each native screen, see what changed in the web screen it ports since the last port, and port that layout:
   `git log --oneline <last port>.. -- app/src/screens/Home.jsx`.
3. To make another screen native: move what it shows into a view in `app/src/native/core.js` (texts formatted,
   links as routes; the web screen uses the same modules), add its route to `Routes.kt` and a branch in `App.kt`.
   Editors keep the form as the web app's JSON and ask core.js what it adds up to
   (`../docs/execution/2026-11-03-native-screens.md`).

## Build, install, update

```sh
source scripts/env.sh          # JAVA_HOME, ANDROID_HOME (setup: scripts/setup-sdk.sh, once per container)
./gradlew assembleRelease      # app/build/outputs/apk/release/app-release.apk (builds the web app first: needs node)
./gradlew testDebugUnitTest    # the homescreen with sample views; screenshots in app/build/screenshots/
```

Install the APK on the phone (copy it over and open it, or `adb install -r …`). **Updating**: install the newer APK
over the old one; the app's data stays, as long as it's signed with the same key. Release builds are signed with
this container's debug key, `~/.android/debug.keystore`: keep a copy of it. With another key Android refuses the
update, and the app has to be uninstalled first (its data goes; the backup brings it back).

The app's data is its own, not Firefox's: on the first run, open the sync icon → Backup and enter the backup
secret (or open the secret's QR link with the app) and it syncs like any other device.

`FIXTURES_DIR=<folder> ./gradlew testDebugUnitTest` also screenshots every `home*.json` in that folder: views as the
web app's `core.home` returns them (e.g. recorded from a browser), for checking the native screen against real data.

## Emulator

Needs KVM, which this container doesn't have; see `scripts/emulator.sh` and the old notes in
`../docs/execution/2026-10-15-android-port.md` (Container).
