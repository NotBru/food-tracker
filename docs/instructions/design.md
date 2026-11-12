# Design

## Stack

Use Vite + React. Store data in an IndexedDB.
Opens fast, offline too: from its cache, without waiting for the network; a new version shows from the launch after
it was fetched.

Android app: native UI over the web app's own logic (data, calculations, sync), which runs inside it; re-ported from
the web app about weekly. Screens not ported yet are the web app's own. Updates through an F-Droid repo on the server.
Left, it stays up until it's synced (a minute at most).

Production: a Docker image serving the build, at https://track-shit.notbru.xyz (final: data is tied to the origin).
A backup server beside it, holding only ciphertext. A copy of Open Food Facts beside it too, updated daily.

## UI

Everything dated is listed newest first. Dates are YYYY-MM-DD.

### Homescreen

- Buttons on top: sync status -> backup screen; language (EN | ES, this device's own, not synced; a tap switches);
  config -> config screen; current user -> users screen. Sync status is an icon with hover text: grey off, green
  synced, yellow checking or syncing (from opening until the backup answers), waiting, or out of reach (two checks in a row), red failing, violet merge conflict (labelled, unless
  turned off).
- Dashboard first, showing in colorful plain text how much has been eaten in the selected time window. Time windows are changed by swiping left/right on a header for the dashboard, which shows the selected time window. Options: daily, last 7 days, last 30 days, weekly, monthly. Daily has day arrows and a "Today" button, up to tomorrow. Longer windows show per-day averages. If set up, show whether the target is being reached: a gauge or progress bar per nutrient, tinted below min, within range and above max. The error range is a hatched band, and a target only counts as reached if the whole range is within it. Hovering a bar shows the amount under the cursor. Bars: slim rows; every number is a note at its place on the bar: the value and its range's ends above, the target's min and max below, each lane on one line, the notes a minimum distance apart (never overlapping); without a target, a grey bar on the same scale.
- Energy pie (switch): the dashboard's first tile, only the pie, square, as wide as a bar (or a whole number of
  gauges); the tiles beside it fill its height, all tiles one height, never shrunk; one column: the pie on top. Radius = kcal; each ring split by the share of its energy (4/9/4 kcal/g) the protein, fat and
  carbs targets allow: deep blue (#000421) where the macros can't fit; where no macro target applies, a lighter blue (#1e3a78)
  within the calorie target, deep blue outside it; a macro's
  min in its colour, centred (first restricted macro on top, second at the bottom), brighter flanks out to its max,
  half each side; overlapping flanks grey; a third restricted macro split on the sides (provisional: see the
  execution log). Above the calorie max: the same, faded (to plan by); below the min: the min's split, faded (radial
  lines). What was eaten: a white-edged ring at its kcal, split by the macros eaten, as wide as the interval (at least 9 px), nearly the background outside the calorie target, between that and the target's colours within it;
  inside it, the split as the kcal grew through the window (consumption by consumption); faint dashed radial lines
  at each macro target's min and max share at the calorie min, from the centre to it, then curving with those edges up
  to the top, over everything; from the eaten ring to the
  calorie min, each macro's room from its share eaten to its min and max there, the shares linear in kcal. Where that
  history covers the calorie target: thin bars (half the eaten ring), right below the min (its split) and the max
  (the rings there), showing as the eaten ring goes past them, in the zone's full colours,
  shaded slightly green, a thin solid green line below the min's and above the max's; the history between those
  lines brighter, shaded slightly green too. The eaten split's
  error bars: each macro's range (its interval's low to high end, the same kcal on every ring across the eaten
  ring, so curved like the targets' edges) on it, as the bars' error range: its colour see-through, hatched lighter. Pointing reads a ring (over the pie). Square (switch): the pie's right half unrolled, calories up, the macros' shares across.
- Daily calories: the target moves by what the 6 days before missed, so the 7 days average to it, within caps (config). Optionally a grey ghost of the uncapped correction. Δ Budget: what's left to eat (bars: a segment from the range's high end to the max).
- Tapping a nutrient -> breakdown screen
- Button: time graphs -> time graphs screen
- Button: logs, expands (upwards, one per row) to:
  - Button: consumptions (+) -> consumptions screen
  - Button: targets (+) -> targets screen
  - Button: body measurements (+) -> body measurements screen
  - Button: temp notes (+) -> temp notes screen
- Button: database, expands to:
  - Button: foods (+) -> foods screen
  - Button: import databases (merge into the current data, or replace it)
  - Button: export databases (filename with date and time, to the second)

### Consumptions screen

A scrollable list of consumptions for a specific day, with a calendar button that pops up a day
selection. Each entry has a delete button.

Clicking on a consumption shows its info (amount, food, energy donut by macro, nutrients); a printer button makes its food's nutrition label (as eaten); ✎ lets you edit its data:
- Date and time (changing a date shouldn't change the screen you return to)
- Food (Name, brand, attributes, optionally preparation time). Eaten-up and expired concoctions are hidden; a new concoction can be made and eaten in one go.
  "+ register food" under the search: a new food (named from what's typed), picked once saved.
- Amount, with Δ ("Max" for a concoction's leftover)
- Unit (text, only editable once the food is set; autocompletes the units available for that food)
- Entry error (%, from the food's last consumption, else 10%)

Every consumption should also list the macros and calories: prot., carbs., fat, cals

### Breakdown screen

One nutrient over the dashboard's window: consumptions ranked, or in quintiles; total or per 100 kcal. Last 7 and
30 days start with a days view. Consumptions can be ticked and grouped to count as one (named).

🔍 -> explore screen: foods ranked by the nutrient's share of their energy, filtered by database and "logged only".

### Time graphs screen

One chart per dashboard row, plus weight: a column per day: the target range light green; only the estimate's
interval coloured, hatched, green within the range and red outside it, nothing below it. The 7-day average as a band. The last N days: a slider (12 months, 11, …, 1 month, 3 weeks, 2 weeks, 13 days, …, 1, left to right) and a box; drag sideways to move, tap a day to pick it in every chart.

### Foods screen

Ingredients, recipes, and concoctions are all foods, and they are exchangeable: anywhere a food is
picked, any of them can be picked, from a single search. Searches rank by whole words: "pear" lists "Pears, raw"
first, not "Spearmint" or baby food with pears. Foods already eaten (also concoctions and components) first, the most
recently eaten first. Each with its kcal per 100 g (or ml) (config switch, on by default).

Scrollable, searchable list, last element is “add new food”. Concoctions last. Repeated foods are ignored; the same
ID with different values is flagged.

Fields:
- Name
- Brand
- Attributes
- Amount (the amount that this entry pertains), with Δ
- Unit
- Units
- Components
- Made at (optional)
- Category (for the error model; foods without components)
- Nutrients

Clicking on any lets you edit them (Edit | Info tabs). Info: a printer button makes a standard nutrition label image (dark; energy by macro, then the
nutrients) for an amount picked (as eaten, when opened from a consumption; else the Info tab's amount). Attributes are `key, value` pairs with any fields (not capitalized), and they
change the ID of the product.

Clicking on nutrients shows a scrollable list of known `key, value` pairs, where keys can be:
- Energy
- Proteins (preset to default 0)
- Carbohydrates (preset to default 0)
- Fat (preset to default 0)
- Fat kinds: saturated, mono-, polyunsaturated, omega-3, trans; cholesterol
- Sugars, added sugars, fibers
- Minerals (sodium, salt, potassium, …, iodine)
- Vitamins A, B1–B12, C, D, E, K
- Alcohol, caffeine, creatine, water

Every amount should also have a corresponding error (a “Δ” field). If not filled in,
default to the digits that have been input in the UI. Nutrient values only take the digits Δ; their sampling
error comes from the food's category. Every entry of a food shares its error.

Fields not written have their values stored as `NaN` for later inference or whatever.

- [x] V2: Some way of automatically fetch products from cool databases: reference databases (CIQUAL, USDA
  FoodData Central) listed with your own foods, read-only, editing makes a copy (CIQUAL without its caffeinated
  drinks: it has no caffeine; names in Spanish too, searched in every language); "search external" on a new food
  over Open Food Facts (products, by name or barcode, typed or scanned with the camera; from our copy on the server, OFF itself as fallback). Imports get a `database` attribute.

#### Units

A scrollable list of unit conversions for this food, where each entry is `amount, units`, and
`amount, units` again. For instance, 1 slice = 30 g. Standard mass and volume units convert by
themselves. Amounts in any unit but a measure (g, ml, cup…) default to an exact count.

#### Components (recipes)

Scrollable list of foods, where foods can be other recipes or concoctions as well. A food with
components has its nutrients inferred from them. Amount and unit are optional for it. Each component has its
energy and macros, and its own entry error. A component can become a new food.

#### Made at (concoctions)

These are choosable from the consumptions screen. They work as a recipe, except they have a datetime
attatched, describing when it was made. For instance, a specific soup.

### Targets screen

List targets, latest first. A target consists of a min and/or max per field that the user defines, limited to energy and any nutrients. It's timestamped, so that it's only valid from its timestamp until the next target's.

### Body measurements screen

Entries, latest first: weight, body fat, waist, muscle (% and mass) (lean mass from them), and other measurements named per
entry, each with Δ. On top: 7-day averages and maintenance calories from the weight trend and what was eaten.

### Temp notes screen

Notes, latest first: text and pictures (one or many, from the camera or the gallery, with their filenames), stamped
with when the note was made. Deleted a week after that, automatically. Synced; Claude's log-food skill reads them (the main use).
A tapped picture fills the screen; left/right keys or a swipe go through the note's other pictures.
A note can be marked done (taken care of), by hand or by the skill once it has logged it; the skill skips done notes.
A new note doesn't open the keyboard on a phone. Save closes it at once: saving and syncing happen behind.

### Users screen

Starts with a default user. List of users; tapping one switches to it, and each can be renamed or
deleted (not the last one). Consumptions, targets, body measurements and temp notes belong to the current user; foods and config are
shared.

### Config screen

- In blocks: General, Dashboard, Food database.
- General:
  - Backup (button)
  - Offset for day start. Default, 0500
  - Error intervals hold (% of the probability). Default, 90
  - App version: "v" and its build date, YYYYMMDDHHmm, in its own pill right of the sync status icon on the homescreen (switch, off by default)
- Dashboard:
  - Style (a dropdown): gauges or bars
  - 7-day calorie correction caps: min, max
  - Energy chart (switch); square, else round (switch)
  - Only nutrients with a target (switch; off: calories, protein, fat, carbs always too)
  - Ghost of the uncapped calorie bar (switch)
- Food database: reference databases (a switch each); calories in food searches (switch, on by default)
- Backup: encrypted on the device, one blob per public key on the server; a invite code to start. The secret moves
  to other devices as a QR link or text, and can be changed (signed by the old key).
  An inbox beside it takes entries pushed from elsewhere; the app merges them in. Claude's log-food skill syncs as
  one more device: it adds, changes and deletes consumptions, foods, recipes and body measurements, and reads temp
  notes. Temp notes' pictures are encrypted files of their own beside the backup, deleted by the server after 10 days.
  Devices on one secret sync (same users, same config but the selected user and language): each keeps the last synced backup and
  merges in what changed there since, then uploads (compare-and-swap; first sync: like an import's Merge). On opening and
  reopening, soon after a change, every 15 minutes, and within 5 s of another device's upload while shown (a check
  by the backup's hash). A row changed differently on two devices is a merge conflict: the
  user picks a side. Restore and import's Replace warn they replace data.
