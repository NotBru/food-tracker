# MVP scaffold: food tracker PWA

- **Date:** 2026-10-15
- **Status:** accepted; data model superseded by [`2026-10-15-unified-items.md`](2026-10-15-unified-items.md)
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md)

## Context

First minimum working example of every screen in `design.md`, using the stack it requires
(Vite + React, data in IndexedDB). The app lives in `app/`.

## Decisions

### Stack details
- **Dexie** (thin IndexedDB wrapper) + `dexie-react-hooks` `useLiveQuery`, so screens re-render when data changes.
  Plain JS/JSX with no TypeScript, to keep the MVP small. Revisit if the model grows.
- **Hash routing** (`#/logs?day=…`, `#/db/ingredients/3`) with no router library. The phone's back gesture works,
  and any static host can serve the app with no rewrite rules.
- **PWA:** hand-written `manifest.webmanifest` + a network-first `sw.js`, registered only in production builds
  and only in a secure context. Calls `navigator.storage.persist()` to reduce the risk of IndexedDB eviction.

### Data model (IndexedDB tables)
| Table | Shape |
|---|---|
| `ingredients` | `name, brand, attributes: [[k,v]], amount, unit, nutrients: {key: {value, delta, text, deltaAuto}}` |
| `recipes` | `name, brand, attributes, amount?, unit?, components: [{ref: {type, id}, amount, unit}]` |
| `concoctions` | same as recipes + `madeAt` (ISO datetime) |
| `conversions` | `ref?, itemKey, item (snapshot), fromAmount, fromUnit, toAmount, toUnit` |
| `logs` | `datetime (ISO), item: {type, id}, amount, unit` |
| `config` | `{key: 'main', value: {dayStart, targets}}` |

- **Identity:** `itemKey()` = lowercase name|brand|sorted attributes, per "attributes change the ID".
  Records also get an auto-increment id; logs and recipe components reference that id, and conversions match on `itemKey`.
- **NaN** is stored as-is in IndexedDB (structured clone supports it) and written as `null` in exported JSON.

### Interpretations of the instructions
- **"am I missing some field?"**: the big one was **Energy (kcal)**. The logs screen must show calories, but
  there was no field for them. Added: energy, added sugars, mono/polyunsaturated fat (instead of
  "non-saturated", which is their sum), cholesterol, sodium, salt, potassium, calcium, iron, magnesium,
  zinc, vitamins A, B1–B12, C, D, E, K, plus alcohol, caffeine and water.
  When energy is unknown it is **estimated per ingredient** with Atwater factors (4/4/9, 7 for alcohol) and shown with `~`.
- **Default Δ "from the digits input"**: one unit of the last typed digit, in the same precision as the input:
  `12` → ±1, `59.8` → ±0.1, `12.50` → ±0.01. The raw text is kept (`text`) so trailing zeros count.
  A trailing dot means one decimal place (`normalizeNumber()`): `3.` is read and saved as `3.0` → ±0.1.
  *(Corrected 2026-10-15: first version used half a unit (`59.8` → 0.05). The user wanted the same units as the
  input. Dexie v4 and import recompute stored automatic Δs. Explicitly typed Δs are untouched.)*
  An untouched macro preset to 0 gets Δ 0.
- **Error propagation:** worst-case linear sum (Δ scales with the amount, Δs add). Simple and conservative;
  could switch to quadrature (√Σ²) later.
- **Missing values:** nutrients with `NaN` are skipped in sums and the total is flagged `missing`
  (not yet surfaced in the UI beyond calories).
- **Recipes without amount/unit** count as **1 portion** = the whole recipe.
- **"Item … optionally preparation time"** in the log editor: interpreted as picking a concoction, whose
  label shows its made-at time.
- **Database screen says "three buttons" but lists four**: built all four.
- **Targets**: the home screen should show "whether the target is being reached", but the config spec
  has no targets. Added daily targets (kcal, P, C, F) to config. Weekly and monthly targets = daily × days in
  the window. Colors: <90% amber ↓, 90–110% green ✓, >110% red ↑.
- **Time windows** are the *current* day / week (Mon–Sun) / month, using the day-start offset.
  Swiping left or right cycles daily → weekly → monthly; ‹ › buttons do the same.
- **Day-start offset** (default 05:00) applies everywhere: a 02:00 meal counts for the previous day.
- **Import replaces all data** after a confirmation (simplest predictable backup restore; no merge).
  On phones, export uses the share sheet when available and falls back to a file download.
- **Unit conversions:** built-in mass (g/kg/mg/oz/lb) and volume (ml/l/cl/dl/tsp/tbsp/cup/fl oz). User conversions
  can be item-specific or "any item". Item-specific ones win, and they chain through one built-in hop on each side
  (e.g. `cup → ml → g`). No mass↔volume conversion without a user rule.

## Alternatives considered
- **Raw IndexedDB API**: too verbose; Dexie is ~30 kB gzipped and still IndexedDB.
- **vite-plugin-pwa**: more dependencies than a 20-line service worker needs at this stage.
- **React Router**: unnecessary for about 10 routes.

## Verification
- Unit check of nutrient math, unit conversion, recursion guard, Δ defaults, logical day and windows.
- Headless Chromium (Pixel 7 viewport) end-to-end: create an ingredient → recipe → conversion → config targets →
  log → edit log → dashboard totals and targets → swipe to weekly → export → import. No console errors.

## Open questions
1. ~~Is the Δ interpretation (half of the last digit) what you meant?~~ Answered: no, use one unit of the last digit.
2. Should import **merge** instead of replace?
3. Should time windows be browsable (previous week, etc.) or always the current one?
4. How should missing (NaN) values in a total be shown?
5. iOS home-screen icon: iOS ignores SVG `apple-touch-icon`; it needs a 180×180 PNG.
