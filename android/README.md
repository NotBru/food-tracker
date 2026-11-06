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
| `/` | `ui/HomeScreen.kt` | `app/src/screens/Home.jsx` | `app/src/dashboard.js`, `app/src/pie.js`, `app/src/native/core.js` `home`, `pieScene`, `pieReadout` |
| `/consumptions` | `ui/ConsumptionsScreen.kt` | `app/src/screens/Consumptions.jsx` | `app/src/consumptionForm.js`, core.js `consumptions`, `consumptionEditor` |
| `/foods` | `ui/FoodsScreen.kt` `FoodsScreen` | `app/src/screens/Foods.jsx` FoodList | `search.js foodListMatches`, core.js `foods` |
| `/foods/external` | `ui/ExternalScreen.kt` | `app/src/screens/External.jsx` | `app/src/external.js`, core.js `offSearch`, `offPick` |
| `/foods/:id` | `ui/FoodsScreen.kt` `FoodScreen` | `Foods.jsx` FoodEditor, FoodForm; `FoodInfo.jsx` (Info tab); `LabelSheet.jsx` (🖨, `ui/LabelSheet.kt`) | `app/src/foodForm.js`, `app/src/label.js`, core.js `foodEditor`, `foodInfo`, `labelSheet`, `labelImage` |
| `/notes` | `ui/NotesScreen.kt` | `app/src/screens/Notes.jsx` | `app/src/notes.js`, core.js `notes`, `notePick`, `notePicture`, `saveNote` |
| `/targets` | `ui/TargetsScreen.kt` | `app/src/screens/Targets.jsx` | `app/src/forms.js`, core.js `targets`, `targetEditor`, `saveTarget` |
| `/body` | `ui/BodyScreen.kt` | `app/src/screens/Body.jsx` | `app/src/forms.js`, core.js `body`, `bodyEditor`, `bodyNames`, `saveBody` |
| `/users` | `ui/UsersScreen.kt` | `app/src/screens/Users.jsx` | `app/src/forms.js`, core.js `users`, `saveUser`, `deleteUser` |
| `/config` | `ui/ConfigScreen.kt` | `app/src/screens/Config.jsx` | `app/src/forms.js`, core.js `config`, `saveConfig` |
| `/backup` | `ui/BackupScreen.kt` | `app/src/screens/Backup.jsx` | `app/src/backup.js`, core.js `backup`, `backupConflicts`, `backupSecret`, `backupFetch`, `backupRestore`, … |
| `/graphs` | `ui/GraphsScreen.kt` | `app/src/screens/Graphs.jsx` | `app/src/graphs.js`, core.js `graphs`, `graphsReadout` |
| `/breakdown/:nutrient` | `ui/BreakdownScreen.kt` | `app/src/screens/Breakdown.jsx` | `app/src/breakdown.js`, core.js `breakdown`, `breakdownGroup`, `renameGroup`, `ungroup` |
| `/explore/:nutrient` | `ui/ExploreScreen.kt` | `app/src/screens/Explore.jsx` | `app/src/explore.js`, core.js `explore`, `exploreFind`, `explorePicked` |
| `/consumptions/:id` | `ui/ConsumptionInfoScreen.kt` | `app/src/screens/ConsumptionInfo.jsx` (+ `EnergyChart.jsx`, `FoodInfo.jsx` NutrientTable, `LabelSheet.jsx`) | `app/src/energy.js`, `app/src/label.js`, core.js `consumptionInfo`, `labelSheet`, `labelImage` |

Shared controls (top bar, sheets, food picker, …): `ui/Kit.kt`; info parts (donut, tables): `ui/Info.kt`. Routes not
listed are the web app's screens.

## Re-porting (about weekly)

1. Rebuild the APK from the current checkout: the web app's logic and screens come in as they are. Bump
   `versionName`'s patch number and `versionCode` by one each (`app/build.gradle.kts`); then `scripts/publish.sh`.
2. For each native screen, see what changed in the web screen it ports since the last port, and port that layout:
   `git log --oneline <last port>.. -- app/src/screens/Home.jsx`.
3. To make another screen native: move what it shows into a view in `app/src/native/core.js` (texts formatted,
   links as routes; the web screen uses the same modules), add its route to `Routes.kt` and a branch in `App.kt`.
   Editors keep the form as the web app's JSON and ask core.js what it adds up to
   (`../docs/execution/2026-11-03-native-screens.md`).

## Next port

- Scan the backup secret's QR code in the app.

## Build, install, update

```sh
source scripts/env.sh          # JAVA_HOME, ANDROID_HOME (setup: scripts/setup-sdk.sh, once per container)
./gradlew assembleRelease      # app/build/outputs/apk/release/app-release.apk (builds the web app first: needs node)
./gradlew testDebugUnitTest    # the homescreen with sample views; screenshots in app/build/screenshots/
```

Install the APK on the phone (copy it over and open it, or `adb install -r …`). **Updating**: install the newer APK
over the old one; the app's data stays, as long as it's signed with the same key. Release builds are signed with
`../.secrets/android-release.p12` (outside git; its passwords in `android-release.properties` beside it): keep a copy
of both off this laptop. Without them the release APK comes out unsigned. With another key Android refuses the
update, and the app has to be uninstalled first (its data goes; the backup brings it back). Up to 0.2.0 the APKs
were signed with the container's debug key; 0.2.1 needs that one uninstall.

**F-Droid** (updates without copying APKs): after the build, `scripts/publish.sh` puts the APK in `fdroid/repo/` and
signs the repo's index (key `fdroid-repo`, in the same `.secrets` keystore); the next push to master uploads it
(`../deploy/hooks/reference-transaction`). On the phone, once: F-Droid → Settings → Repositories → + →
`https://track-shit.notbru.xyz/fdroid/repo?fingerprint=D5C18F739E4235B30707B8DD8351F3C68BEA1B2512A32E13E9F5D3B12F0957E2`.

The app's data is its own, not Firefox's: on the first run, open the sync icon → Backup and enter the backup
secret (or open the secret's QR link with the app) and it syncs like any other device.

`FIXTURES_DIR=<folder> ./gradlew testDebugUnitTest` also screenshots every `home*.json` in that folder: views as the
web app's `core.home` returns them (e.g. recorded from a browser), for checking the native screen against real data.

## Emulator

Needs KVM, which this container doesn't have; see `scripts/emulator.sh` and the old notes in
`../docs/execution/2026-10-15-android-port.md` (Container).
