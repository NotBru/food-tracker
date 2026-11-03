# Android app: the web app as the engine, native screens over it; the homescreen first

- **Date:** 2026-11-03
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Stack); follows
  [native-ui](2026-11-03-native-ui.md)

## Context

The decision ([native-ui](2026-11-03-native-ui.md)): a native UI, re-ported from the web app about weekly, without
a second copy of the logic (calculations, data, sync, encryption).

## Decision

- **The web app runs inside the app, as the engine**, in a WebView: it has IndexedDB, WebCrypto and fetch, so
  `db.js`, `backup.js` and everything else run unchanged and sync byte for byte as the browser does. An embedded
  JS engine (QuickJS, JavaScriptSandbox) would have needed storage, crypto and network rewritten in Kotlin.
- **Its build is in the APK** (`assets/web/`, built by Gradle from `../app`), served by intercepting
  `https://track-shit.notbru.xyz/` requests: same origin as the site, so `/backup/` and `/off-search/` reach the
  server as they are, with no CORS; everything else comes from the APK, offline, and always the version the native
  screens were built against. No service worker in the app.
- **One navigation state, the web app's route** (its `#`). Native screens move it (`core.go/replace/back`), the
  app follows it (`route` messages). A route with a native screen: the web app draws nothing there
  (`NativeBridge.handles`), the native screen draws over the WebView. Any other route: the WebView shows the web
  screen. So the app is complete from the start, and screens become native one at a time; back goes through the
  WebView's history.
- **Bridge** (`app/src/native/bridge.js`, `Engine.kt`): `core.call` (once) and `core.watch` (again whenever the data
  it reads changes: Dexie's `liveQuery`, as `useLiveQuery`; again on a day change), JSON both ways. Calls wait
  for the page's `ready` and, after a reload, for the next one's (`unload` on `pagehide`). Not `onPageStarted`:
  WebView 145 (Android 17's emulator) calls it after the page has started and said `ready`, which left every call
  waiting (found 2026-11-03: taps that change screen did nothing).
- **Views** (`app/src/native/core.js`): one function per native screen, returning what it shows: texts formatted,
  bars in %, links as routes. The Kotlin side only lays them out, so formatting and rounding stay JavaScript's.
  The logic they need moved out of the web screens into shared modules (`dashboard.js`: Home's loader and bar
  layout), which the web screens now import: no copies.
- **Homescreen native first** (the screen every launch opens on): `HomeScreen.kt` ports `Home.jsx`'s layout (bars
  and gauges, hatched error bands, ghost, budget, window swipe, day steps, the Logs/Database menu, import/export
  through Android's file pickers). Its last view is kept (`Snapshots`) and drawn at once on the next start, before
  the web app has loaded; the fresh one replaces it.
- **The app does for web screens what a browser does**: file inputs (temp notes: camera through a FileProvider,
  gallery), alert/confirm (WebView's own dialogs), links to other sites open in the browser, the backup secret's
  link (`https://track-shit.notbru.xyz/#/backup?secret=…`) opens in the app when picked.
- No Android cloud backup (`allowBackup=false`): the data holds the backup secret; the app's own backup syncs it.
- One activity, not recreated on rotation and the like (`configChanges`), so the web app inside keeps running.

## Verification

- The native view and the web screen, same data (the user's export, 324 consumptions), headless Chromium with a
  stand-in `NativeBridge`: today, yesterday, tomorrow, weekly, last 7 days and monthly gave the same row texts,
  window title and summary. A watched view re-sent itself after the data changed (a Replace import in another tab).
- `./gradlew testDebugUnitTest` (Robolectric, native graphics): the homescreen from a made-up view (bars, gauges,
  menu) and every button's route; with `FIXTURES_DIR`, the six real views in both styles. Screenshots compared by
  eye with the web screen's: same layout, colours, bars and gauges.
- `assembleDebug`/`assembleRelease` build, with the web app in the APK.
- **Not verified**: a run on a device or emulator (no KVM here). The WebView side (interception, the bridge,
  pickers, camera, back, links) has only run in Chromium with a stand-in; first real test is the user's phone.

## Alternatives considered

- **Loading the site from the server** instead of the APK: updates without a new APK, but the logic could then be
  newer than the native screens calling it.
- **A JS engine without a WebView**: faster to start, but storage, crypto and fetch become Kotlin rewrites, the
  copies this design avoids.

## Consequences

- The app keeps its own data (not Firefox's): it joins the backup with the secret, like a new device.
- When the web app's export format changes, an older APK refuses to sync until it's rebuilt, as an old browser tab
  would.
- Startup: the native homescreen draws at once from its snapshot; fresh numbers come once the WebView has loaded
  the web app (not measured on a phone).
- Re-porting a native screen means porting its web screen's layout changes; its data comes from the shared modules.
