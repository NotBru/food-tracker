# Native Android port

- **Date:** 2026-10-15
- **Status:** superseded by [android-removed](2026-10-26-android-removed.md)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (all screens)

## Context

User, in chat: "construct a redo of this app as a native Android App. Introduce whatever this container needs for
me to test it in a simulator later on." design.md's Stack section says Vite + React with IndexedDB. That describes
the web app, which stays as it is; the Android app lives next to it in `android/`. design.md wasn't edited
(human-only). Its Stack line may need an Android counterpart.

The port started from commit `ae53820` (tagged `pre-android`, the revert point). Web changes made during the
port were folded in at the end: square bar/gauge ends, and the white tick at the value (error-bars.md updates).

## Decisions

### Stack
- **Kotlin + Jetpack Compose (Material 3)**, single activity, minSdk 26, target/compile SDK 35.
- **Room** (SQLite) for storage, with Flows standing in for `useLiveQuery`.
- **kotlinx.serialization** for records and files.
- Toolchain: AGP 8.7.3, Kotlin 2.1.0, Gradle 8.11.1 (wrapper committed), JDK 17.
- These are well-established versions rather than the newest ones; they're easy to bump.

### Same data, same files
- Each Room row stores the record's JSON, **in the web app's shape and field names**, next to the indexed columns
  that queries need:
  - logs: `userId`, `datetime`;
  - targets: `userId`, `validFrom`;
  - items and users: `name`.
- Nested data (nutrients, units, components, ranges) is never queried, so it stays as JSON.
- Export writes the web app's format (`app: food-tracker`, `version: 7`, NaN → null).
  - Import reads it back; NaN is the default of every unknown number.
  - Automatic Δs are refreshed on import, as on the web.
  - Files move both ways, PWA ⇄ Android.
- Datetimes are stored like `toISOString()` (UTC, always with milliseconds), so they compare as strings the same way.
- Import accepts version 7 only. Older files get the message "import into the web app and export again". The
  v1–v6 migrations weren't ported, since there's no older Android data to migrate.

### Behaviour
- `calc.js`, `nutrients.js` and `time.js` are ported function by function, including JS number semantics:
  - `Number()`, `String()` and `toFixed()` behave like JS, so typed digits, auto Δs and the formatting match.
- The decimal keypad's "," is read as ".". Many locales only offer a comma.
- Screens and flows follow design.md and the web app:
  - editors (consumption, target, user) are bottom sheets;
  - the food editor is a full screen;
  - Search external sits on top of New food, and a pick prefills it.
- The browser-only bits became native equivalents:
  - `alert`/`confirm` → dialogs;
  - the date/time inputs → Material date and time pickers;
  - the share/download export → the system "save as" picker (default name `food-tracker-YYYY-MM-DD_HH-mm-ss.json`);
  - the file input → the system file picker.
- Open Food Facts is called with a `User-Agent`, which the browser couldn't send.
- The CIQUAL table isn't duplicated: the build copies `app/public/ciqual.json` into the APK assets.
- ↑/↓ keyboard navigation of the suggestion lists wasn't ported (touch first). Suggestions open under their field,
  as on the web, and scroll themselves into view.

### Container
- `.devcontainer/` is mounted read-only inside the container, so the toolchain comes from
  `android/scripts/setup-sdk.sh`:
  - JDK 17 from apt;
  - SDK into `~/android-sdk`;
  - `--emulator` adds the emulator and an x86_64 image.
- The container has no `/dev/kvm`, so the emulator can't run here. `android/README.md` gives two ways:
  - pass `/dev/kvm` in via `runArgs`, then `scripts/emulator.sh`;
  - or run the emulator on the host and `adb connect` to it.
- Gradle is limited to a 2 GB heap with in-process Kotlin, because the container has little free RAM.

## Verification

`./gradlew testDebugUnitTest`: 24 tests, all passing.

- **Maths (JVM):** the hand-checked numbers from [error-bars](2026-10-15-error-bars.md):
  - Bread: 1 slice → 75 ± 12.5;
  - Toast: 150 ± 68.75;
  - per 100 ± 10 g → ± 11.1;
  - 2100 ± 187.5 kcal → over, P 105 ± 7.85 → under;
  - plus units, cycles, Atwater estimate, window targets, logical days, and the JS-style formatting.
- **Storage (Robolectric):**
  - default user;
  - export → import round trip, with NaN as null;
  - a web-format export file imports (numeric CIQUAL ids stay numbers);
  - bad files are refused;
  - deleting users, and the last one can't be deleted;
  - CIQUAL parsing and search;
  - OFF product → draft.
- **UI (Robolectric, native graphics):** the real screens, with a screenshot of each in `app/build/screenshots/`:
  - dashboard in both styles and the weekly window;
  - adding a consumption through the item search and unit;
  - nutrient details;
  - editing a food and adding a nutrient from the picker (its Δ defaults from the digits);
  - New food → CIQUAL → prefilled → saved;
  - targets, users (add + switch), config.
- Bugs these tests found and that are fixed:
  - focusing a sheet's first field before it was attached crashed (now waits a frame and fails safely);
  - suggestion lists could open off-screen.
- **Not verified:** a run on an emulator or device (no KVM here); live Open Food Facts requests.

## Open questions

- design.md's Stack section names only the web stack. Should it say which app is the main one going forward?
