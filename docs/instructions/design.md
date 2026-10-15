# Design

## Stack

Use Vite + React. Store data in an IndexedDB

## UI

### Homescreen

- Dashboard first, showing in colorful plain text how much has been eaten in the selected time window. Time windows are changed by swiping left/right on a header for the dashboard, which shows the selected time window. Options: daily, weekly, monthly. If set up, show whether the target is being reached.
- Button: consumptions -> consumptions screen
- Button: foods -> foods screen
- Button: targets -> targets screen
- Button: config -> config screen
- Button: import databases
- Button: export databases

### Consumptions screen

A scrollable list of consumptions for a specific day, with a calendar button that pops up a day
selection.

Clicking on a consumption lets you edit its data:
- Date and time (changing a date shouldn't change the screen you return to)
- Food (Name, brand, attributes, optionally preparation time)
- Amount
- Unit (only selectable once the food is set; offers the units available for that food)

Every consumption should also list the macros and calories: prot., carbs., fat, cals

### Foods screen

Ingredients, recipes, and concoctions are all foods, and they are exchangeable: anywhere a food is
picked, any of them can be picked, from a single search.

Scrollable, searchable list, last element is “add new food”

Fields:
- Name
- Brand
- Attributes
- Amount (the amount that this entry pertains)
- Unit
- Units
- Components
- Made at (optional)
- Nutrients

Clicking on any lets you edit them. Attributes are `key, value` pairs with any fields, and they
change the ID of the product.

Clicking on nutrients shows a scrollable list of known `key, value` pairs, where keys can be:
- Proteins (preset to default 0)
- Carbohydrates (preset to default 0)
- Fat (preset to default 0)
- Saturated fat
- Non-saturated fat
- Trans fat
- Sugars
- Fibers
- Any of the vitamins
- [ ] TO AI: am I missing some field?

Every value should also have a corresponding error (a “Δ” field). If not filled in, default to the
digits that have been input in the UI.

Fields not written have their values stored as `NaN` for later inference or whatever.

- [ ] V2: Some way of automatically fetch products from cool databases

#### Units

A scrollable list of unit conversions for this food, where each entry is `amount, units`, and
`amount, units` again. For instance, 1 slice = 30 g. Standard mass and volume units convert by
themselves.

#### Components (recipes)

Scrollable list of foods, where foods can be other recipes or concoctions as well. A food with
components has its nutrients inferred from them. Amount and unit are optional for it.

#### Made at (concoctions)

These are choosable from the consumptions screen. They work as a recipe, except they have a datetime
attatched, describing when it was made. For instance, a specific soup.

### Targets screen

List targets, latest first. A target consists of the fields that the user defines, limited to energy and any nutrients. It's timestamped, so that it's only valid from its timestamp until the next target's.

### Config screen

- Offset for day start. Default, 0500
