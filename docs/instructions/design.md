# Design

## Stack

Use Vite + React. Store data in an IndexedDB.

Production: a Docker image serving the build, at https://track-shit.notbru.xyz (final: data is tied to the origin).
A backup server beside it, holding only ciphertext.

## UI

Everything dated is listed newest first. Dates are YYYY-MM-DD.

### Homescreen

- Buttons on top: sync status -> backup screen; config -> config screen; current user -> users screen. Sync status is an
  icon with hover text: grey off, green synced, yellow waiting, red failing, violet merge conflict (labelled, unless
  turned off).
- Dashboard first, showing in colorful plain text how much has been eaten in the selected time window. Time windows are changed by swiping left/right on a header for the dashboard, which shows the selected time window. Options: daily, last 7 days, weekly, monthly. Daily has day arrows and a "Today" button, up to tomorrow. Longer windows show per-day averages. If set up, show whether the target is being reached: a gauge or progress bar per nutrient, tinted below min, within range and above max. The error range is a hatched band, and a target only counts as reached if the whole range is within it. Hovering a bar shows the amount under the cursor.
- Daily calories: the target moves by what the 6 days before missed, so the 7 days average to it, within caps (config). Optionally a grey ghost of the uncapped correction. Δ Budget: what's left to eat.
- Tapping a nutrient -> breakdown screen
- Button: time graphs -> time graphs screen
- Button: consumptions (+) -> consumptions screen
- Button: foods (+) -> foods screen
- Button: targets (+) -> targets screen
- Button: body measurements (+) -> body measurements screen
- Button: import databases (merge into the current data, or replace it)
- Button: export databases (filename with date and time, to the second)

### Consumptions screen

A scrollable list of consumptions for a specific day, with a calendar button that pops up a day
selection. Each entry has a delete button.

Clicking on a consumption shows its info (amount, food, energy donut by macro, nutrients); ✎ lets you edit its data:
- Date and time (changing a date shouldn't change the screen you return to)
- Food (Name, brand, attributes, optionally preparation time). Eaten-up and expired concoctions are hidden; a new concoction can be made and eaten in one go.
- Amount, with Δ ("Max" for a concoction's leftover)
- Unit (text, only editable once the food is set; autocompletes the units available for that food)
- Entry error (%, from the food's last consumption, else 10%)

Every consumption should also list the macros and calories: prot., carbs., fat, cals

### Breakdown screen

One nutrient over the dashboard's window: consumptions ranked, or in quintiles; total or per 100 kcal. Last 7 days
starts with a days view. Consumptions can be ticked and grouped to count as one (named).

🔍 -> explore screen: foods ranked by the nutrient's share of their energy, filtered by database and "logged only".

### Time graphs screen

One chart per dashboard row, plus weight: a column per day, drawn like the dashboard bar, with the 7-day average as
a band. The last N days (slider and box); drag sideways to move, tap a day to pick it in every chart.

### Foods screen

Ingredients, recipes, and concoctions are all foods, and they are exchangeable: anywhere a food is
picked, any of them can be picked, from a single search.

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

Clicking on any lets you edit them (Edit | Info tabs). Attributes are `key, value` pairs with any fields, and they
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
  FoodData Central) listed with your own foods, read-only, editing makes a copy; "search external" on a new food
  over Open Food Facts (products, by name or barcode). Imports get a `database` attribute.

#### Units

A scrollable list of unit conversions for this food, where each entry is `amount, units`, and
`amount, units` again. For instance, 1 slice = 30 g. Standard mass and volume units convert by
themselves. "u" amounts default to an exact count.

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

Entries, latest first: weight, body fat, waist, muscle mass (lean mass from them), and other measurements named per
entry, each with Δ. On top: 7-day averages and maintenance calories from the weight trend and what was eaten.

### Users screen

Starts with a default user. List of users; tapping one switches to it, and each can be renamed or
deleted (not the last one). Consumptions, targets and body measurements belong to the current user; foods and config are
shared.

### Config screen

- Offset for day start. Default, 0500
- Dashboard style: gauges or bars
- Error intervals hold (% of the probability). Default, 90
- 7-day calorie correction caps: min, max
- Ghost of the uncapped calorie bar (switch)
- App version: its build date, YYYYMMDDHHmm, in its own pill right of the sync status icon on the homescreen (switch, off by default)
- Reference databases (a switch each)
- Backup: encrypted on the device, one blob per public key on the server; a invite code to start. The secret moves
  to other devices as a QR link or text, and can be changed (signed by the old key).
  An inbox beside it takes entries pushed from elsewhere (Claude's log-food skill); the app merges them in.
  Devices on one secret sync (same users, same config but the selected user): each keeps the last synced backup and
  merges in what changed there since, then uploads (compare-and-swap; first sync: like an import's Merge). Soon
  after a change, every 15 minutes, on reopening. A row changed differently on two devices is a merge conflict: the
  user picks a side. Restore and import's Replace warn they replace data.
