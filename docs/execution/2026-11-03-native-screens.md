# Android app: the other screens, native

- **Date:** 2026-11-03
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Stack); request in chat ("If you
  haven't done all of the UI, go ahead and do it")

## Context

After the homescreen ([android-engine](2026-11-03-android-engine.md)), the user asked for the rest of the UI, done
while they were away, blockers listed for later. Same rule as the homescreen: no logic copied into Kotlin.

## Decision

Screen by screen, in order of use. For each:

- **Logic out of the JSX** into a module the web screen and `app/src/native/core.js` both use, so the native
  screen can't drift from the web one in what it computes.
- **Editors keep the form in Kotlin, as the JSON the web app made** (`JsonObject`, edited by key): typing stays
  local and instant. After each change the form goes to a core.js function that says what to show (preview, units,
  placeholders, totals); taps that change several fields at once (picking a food, "Max", ticking "New concoction")
  are sent as events and the web app returns the new form. Saving returns `{alert}`, `{confirm}` (saved again once
  confirmed) or `{done}`: the web app's alert()/confirm() as native dialogs.
- **Calls made on every keystroke read from a cache** (`cached` in core.js: a live query that keeps the latest
  foods and consumptions) rather than every food each time. Watched views read directly, as a live query only
  follows reads made inside it.
- **One kit of controls** (`ui/Kit.kt`) in the web's style: top bar, list cards, sheets, text boxes, the food picker,
  unit suggestions, ± Δ, ε, date and time. Sheets are drawn over the screen rather than in a dialog window, so the
  keyboard pushes them up like the rest of the app; pickers scroll their list into view above it.
- **Dropdowns open in place** (pushing what's under them down) rather than floating, which is simpler and works
  inside scrolling sheets.

### Consumptions

`app/src/consumptionForm.js` (the editor's logic, from Consumptions.jsx), `search.js foodMatches` (the picker's
ranking, from components.jsx ItemPicker). core.js: `consumptions`, `consumptionEditor`, `saveConsumption`,
`deleteConsumption`, `foodSearch`. Checked on the emulator against the web screen in a browser: same preview, list
and concoction totals.

### Consumption info

`app/src/energy.js` (the energy split, from EnergyChart.jsx: colours named by tone and shade, as Kotlin can't read
CSS variables). Rich texts (bold, muted parts) come as spans. The donut is drawn on a canvas; tapping a slice shows
it in the middle, as on the web.

### Temp notes

`app/src/notes.js` (shrinking, saving, deleting, from Notes.jsx). Pictures stay the web app's: the camera's shot or
the gallery's files are served to it at an address of its own origin (`/__native/file/…`, Engine.serve), it fetches
and shrinks them as on the web and keeps them waiting until the note is saved; the native screen gets each picture
back once, as base64 JPEG, and keeps it decoded (downsampled for thumbnails). A picture not synced yet shows "…"
until the list says it's here.

### Foods

`app/src/foodForm.js` (the editor's logic, from Foods.jsx FoodForm), `search.js foodListMatches` (the list's
ranking). The list is a lazy list (hundreds of foods) whose view is watched per search text. A new component made
with "+" stashes the form in Kotlin (`FoodStash`, as Foods.jsx's `parents`, in memory only) and the new food, once
saved, is set as that component back on the form. "Search external"'s pick reaches the native editor through
external.js's pending draft, which the web app's module holds for both.

### Targets, body measurements, users, config

`app/src/forms.js` (each screen's loading and saving, from Targets.jsx, Body.jsx, Users.jsx, Config.jsx; the web
screens use it too). Forms are sent back as typed; Kotlin's JSON keeps blank fields (`encodeDefaults`), as the web
code reads them. Body's "looks like a typo of a known name" question loops as on the web: each answer is sent back
with the next save (`answers`), Cancel meaning keep the new name. Config's day start uses the phone's time picker.
Checked on the emulator and in a browser: same averages, alerts and questions.

### Search external

core.js `offSearch` keeps the last results' drafts and hands rows to show; `offPick(i)` sets the picked product as
external.js's pending draft, and the native food editor reads it when going back, as on the web. Found while testing:
the engine still passed `/off-search/` (the relay replaced by the `/off/` copy, 2026-11-03-off-copy.md) through to
the server, so the APK served `/off/` from its own files and every search fell back to OFF itself (blocked by CORS
in a page); it now passes `/off/`.

### Explore

`app/src/explore.js` (the ranking, from Explore.jsx). The list (~11.5k foods with both reference databases) is
ranked once per nutrient and food data (cached in core.js) and sent once per filter change; the search box asks
only for the matching row's index, and the picked food's chart separately, so typing doesn't resend the list.

### Breakdown

`app/src/breakdown.js` (loading, ranking, per 100 kcal, quintiles, grouping, from Breakdown.jsx). Bars come as
fractions (low end, high end, value) and are drawn like the dashboard's (`hatchRect`). Ticked entries go back by key;
core.js finds them again in the same view to group them. A new screen per nutrient and window (`key`, as the web
screen's), so a day opened from the 7 days starts at the top. Checked against the web screen on the user's data,
imported into the emulator only (backup off there): same totals, days and quintiles.

### Time graphs

`app/src/graphs.js` (loading, scales, a column's bars, the 7-day points, from Graphs.jsx). core.js sends each chart as
geometry in % of its plot (regions, fill pieces, the estimate, a measure's dot and whisker, the band's points) and
the readouts for the picked day separately (`graphsReadout`, from the data it just loaded), so a tap doesn't resend
the charts. Drawn on canvases; sliding sideways replaces the route per column, as on the web, and the last graphs
stay shown until the next window's arrive. The slider sets the route when let go. Checked against the web screen on
the user's data (emulator only): same readouts.

### Backup

Its state is the web app's (localStorage, not the database), so the native screen reads it again whenever the sync
status the bridge already sends changes, and after each action. Actions answer {alert} rather than failing (a 409,
another device first, stays quiet, as on the web). Restoring is two calls: the fetch (checks the secret, says from
when) and, once confirmed, the restore of what was fetched. The QR's modules come from qrcode-generator in the web
app; Kotlin draws them. The secret reaches Kotlin only when shown.

Open: the emulator's WebView (124, as its Chrome) can't make Ed25519 signatures (Chrome has them from 137), so the
backup can't start or restore there; phones update WebView through the Play Store. Sync was not tested on the
emulator for that reason. The scripts now install the Android 17 image (`android-37.0;google_apis`), whose WebView
has them (the user's choice, over a Play Store sign-in on the emulator or a JS fallback).

## Alternatives considered

- **The form's state in the web app** (Kotlin sending keystrokes): a round trip per key, and the text field's value
  racing the replies.
- **Typed Kotlin classes for forms**: every field of every form declared twice, for no check the web app doesn't
  already make.

## Consequences

- A web screen's layout changes still need porting (README, Re-porting); what it computes doesn't.
