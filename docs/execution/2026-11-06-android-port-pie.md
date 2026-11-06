# Android port (2026-11-06): energy pie, Config blocks, slider stops, text boxes, …

- **Date:** 2026-11-06
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Stack); the weekly re-port
  (`android/README.md`); follows [native-screens](2026-11-03-native-screens.md)

## Context

The web screens changed since the last port (`643bd91`): the energy pie on the dashboard, Config in blocks, the
graphs' slider stops, the nutrition label, text boxes. User, in chat: "Now port".

## Decision

### Energy pie (homescreen)

- What the pie shows moved from `Home.jsx` PieCanvas into `pie.js` `pieScene` (DOM-free): every level's colours
  (a level a pixel of radius, or of height for the square) and the lines, rings, arcs and hatched bands over them,
  in pixels. `piePalette` takes the colour variables as a function, `pieReadout` gives the line under the pie. The
  web canvas draws the scene; checked pixel for pixel against the drawing before the move (same canvas, same readout,
  round and square, below the calorie min and past the max: the bars and curves).
- core.js `home` keeps the last view's pie inputs and sends `pie: {id, square}`; `pieScene(n, k)` and
  `pieReadout(kcal)` work on those (the inputs hold NaN, which JSON can't carry back). `HomeScreen.kt` `PieTile`
  asks for the scene at its own pixel size and density, paints the levels into a bitmap and draws the rest over it
  (`drawPie`, a port of PieCanvas's drawing). A tap or a sideways slide reads a ring, as the web's pointer.
- Layout: on a phone the web puts the pie on top, as wide as the dashboard (no tile fits beside it: `useFitPie`), so
  the native tile is always on top. The web's "every tile as tall as the tallest" (with the pie on) isn't ported.
- Checked on the emulator with the user's data: square and round (round through a throwaway build, as the
  emulator's config syncs to the user's devices), and the readout.

### Config

In blocks (General, Dashboard, Food database) with their uppercase names; the dashboard style a dropdown; the energy
chart switches. `SwitchPanel` and `SelectBox` take a background (`panel-2` inside a block, as the web's).

### Time graphs: the slider's stops

core.js sends the stops (graphs.js `SLIDER_STOPS`) as days ending on the window's last day, and the one the span is
at (`stopIndex`); the native slider steps through them (no tick marks, as the web's range input) and sets the
stop's days when let go. `MAX_SLIDER` (1–180 days, the native slider until now) is gone. Checked on the emulator:
11 months → 335 days, 10 → 304, the right end → 1 day.

### Text boxes

From `android/README.md` Next port (the user's, 2026-11-03): tapping into a text box puts the cursor at the end of
its text, wherever the tap was (to delete leftwards); taps once inside place it as usual. `TextBox` keeps the text
with its selection and, for 0.6 s after gaining focus, moves a tap's cursor to the end. Attributes' key and value
boxes aren't capitalized. Checked on the emulator (a new food, not saved): "abcdef", tap in the middle from another
box, type → "abcdefX"; tap in the middle again → "abYcdefX"; the attribute boxes' keyboard without caps.

## Consequences

- A cold start draws the pie once the engine is ready (~1 s); the rest of the homescreen comes from its snapshot.
- The emulator's app syncs with the user's backup: changing its config changes theirs (found here: the pie switch
  was toggled off and on again within a minute).
