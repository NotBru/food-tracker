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

## Alternatives considered

- **The form's state in the web app** (Kotlin sending keystrokes): a round trip per key, and the text field's value
  racing the replies.
- **Typed Kotlin classes for forms**: every field of every form declared twice, for no check the web app doesn't
  already make.

## Consequences

- A web screen's layout changes still need porting (README, Re-porting); what it computes doesn't.
