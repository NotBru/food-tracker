# External food databases: CIQUAL and Open Food Facts

- **Date:** 2026-10-15
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen, "V2: Some way of automatically fetch products from cool databases")

## Context

After a short survey (OFF, USDA FoodData Central, CIQUAL, BEDCA, commercial APIs), the user asked for
**"both Open Food Facts and CIQUAL"**, with **a "search external" button at "New food" with a new screen**.
The app has no backend, so a source must either answer cross-origin requests without a secret key (OFF) or be
shipped with the app (CIQUAL has no API).

## Decisions

- **Flow:** "New food" shows a "Search external databases…" button (new foods only). It opens `#/foods/external`,
  with the name typed so far as the query. Picking a result goes **back** to New food, which is now prefilled
  (name, brand, per 100 g/ml, units, nutrients). Nothing is saved until you press Save, so the form doubles as the
  preview. The draft is handed over through a module variable (`external.js`: peek during render, clear after
  mount, which is safe under StrictMode), so the history stays Foods → New food.
- **Two tabs:** "Generic (CIQUAL)" and "Products (OFF)".
- **Provenance:** foods keep `source: {db, id[, version]}`. The form shows "From <link>" with an "unlink" button.
  There's no schema change, since the field isn't indexed. ~~Not used as an attribute, because attributes change the
  food's ID.~~ See the update below.

### CIQUAL
- **Data:** the CIQUAL 2025 table (2025-11-03, published 2025-11-19), from the XML archive on the ciqual.anses.fr
  download page. It has **3484 foods** with English and French names, values, min/max and confidence codes.
- **Conversion:** `app/scripts/ciqual.py` (stdlib only) converts it to `public/ciqual.json`. That file is about
  1.3 MB, or 370 KB gzipped. It's fetched only when the screen opens (not part of the JS bundle) and cached
  offline by the service worker.
- **Nutrients:** 37 constituents are mapped to app keys. Energy uses the EU 1169/2011 kcal, vitamin A the
  retinol activity equivalent, and vitamin K is K1 only. Fatty-acid details, individual sugars, starch, polyols,
  organic acids and ash are not mapped, because the app has no keys for them.
- **Values and Δ:**
  - Decimal comma → dot, and the text keeps CIQUAL's digits.
  - When the sources give a min–max range, Δ is the larger distance from the value. Otherwise Δ comes from the
    digits, like a typed value.
  - `< x` → x/2 ± x/2.
  - `traces` and `0` → 0 ± half of that nutrient's most common quantification limit (e.g. fibre ±0.25 g).
    The digits rule would give "0 ± 1", too loose for vitamins.
  - `-` → not given (NaN).
- **Search:** local, as you type, accent-insensitive. Every word must match the English or French name. Names
  starting with the query come first, then shorter names. Results show the subgroup name ("eggs", "soups").
- Confidence codes (A–D) are not shown. They could later widen the Δ.

### Open Food Facts
- **Endpoints:** barcodes (8–14 digits) use `GET /api/v2/product/{code}.json`. Text uses `GET /cgi/search.pl`
  (`search_simple`, 24 results, only products with per-100 values). Both send `access-control-allow-origin: *`.
- **Rate limits:** 10 searches/min. Searches run only on Enter or the button, never per keystroke, and a 429 gets
  a clear message.
- **Identification:** via the `app_name`/`app_version` query parameters, not `X-User-Agent`. A custom header
  triggers a CORS preflight, which `search.pl` rejects. Error responses (rate limit, overload) carry no CORS
  headers, so the browser reports them as network failures; the message says "offline, or busy / rate-limited".
- **Units:** OFF stores `*_100g` in grams. These are converted to the app's units (mg, µg) and rounded to 4
  significant digits, which removes float noise (iodine 2.25e-05 g → 22.5 µg). Δ comes from those digits.
  - Energy from kJ ÷ 4.184 when kcal is missing.
  - Alcohol: % vol × 0.789.
- **Base unit:** ml when the product quantity is in ml, else g.
- **Product units:** `serving_quantity` → "1 serving = …"; `product_quantity` → "1 package = …".
- **Name/brand:** `product_name` (as stored, often in the selling country's language) and the first entry of
  `brands`.

## Update: provenance attribute

The user asked for "a provenance attribute that gets automatically filled with CIQUAL or OFF".
- Imported drafts now start with the attribute `provenance = CIQUAL` or `provenance = OFF`.
  - It's an ordinary attribute, so it's editable and removable, and it's part of the food's identity.
    For example, "Egg, hard-boiled (provenance: CIQUAL)" is a different food from a hand-entered "Egg, hard-boiled".
- `source` ({db, id}) stays for the link back to the record, and "unlink" doesn't touch the attribute.
- Foods entered by hand get no provenance attribute.
- Seen while testing: OFF's `cgi/search.pl` intermittently returns **503** without CORS headers, while barcode
  lookups keep working. The app shows its "busy / rate-limited" message.

## Not done / open

- USDA FoodData Central (needs a personal API key); BEDCA (no API).
- Barcode scanning with the camera. `BarcodeDetector` exists on Android Chrome, so this would be a natural next step.
- Search from the existing-food editor (refresh a food from its source).
- design.md still lists this as an unchecked "V2" item; only the user edits that file.

## Verification

Tested in headless Chromium (Pixel 7):
- "egg boiled" → Egg, hard-boiled (#22010), 134 kcal, P 13.5, F 8.62. Sodium 123 ± 89 comes from the range.
- Barcode 7394376616228 → Oatly Barista, 100 ml, 1 serving = 100 ml, 1 package = 1000 ml, iodine 22.5 µg.
- "oatly barista" search → 24 results.
- Both foods saved and listed. No console errors.
