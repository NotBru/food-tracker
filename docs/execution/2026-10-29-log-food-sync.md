# log-food skill syncs like a device: changes, deletions, recipes; search by words

- **Date:** 2026-10-29
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Config screen: backup)
- **Builds on:** [log-food](2026-10-27-log-food.md), [sync](2026-10-28-sync.md)
- **Supersedes:** pushing through the inbox, in [log-food](2026-10-27-log-food.md)

## Context

User in chat: "Change the skill's tool so that you can: Add recipes; Modify (not only add!! allow it to sync just like
the app does); Ensure the following searches work: 'spinach raw', 'coca cola', 'chicken breast roasted'".

The inbox only adds, and was chosen when the backup only uploaded. Since [sync](2026-10-28-sync.md), devices merge
each other's changes, so the tool can be one more device.

The searches failed because `find` matched each argument as a substring: a quoted `"spinach raw"` is one argument,
and no name holds "spinach raw" (CIQUAL's is "Spinach, raw"). Split into words, "coca cola" found only the Coca-Cola
company's other drinks (Powerade, Dasani…): the colas are named "Cola, with sugar(s)" and "Beverages, carbonated,
cola, regular".

## Decision

- **Sync as the app does** (`backup.js syncRound`): `.secrets/backup.json` is the tool's copy, `.secrets/base.json` the
  backup as last synced and its version. Download; if the version moved, `sync.js merge(base, copy, backup)` and its
  writes into the copy; upload what differs from the base with `prev` = its version; 409 → another round (up to 5).
  First sync (no base, including the old tool's plain download): the copy is the backup as it is. Formats other than
  the app's stop with an error, as in the app.
  - `sync.js` no longer imports `TABLES` from `db.js` (which imports Dexie and extensionless modules, which Node can't
    load); it merges the tables it's given, which are the export's, the same ones. So the tool runs the app's merge,
    not a copy of it.
  - **Conflicts** wait in `.secrets/conflicts.json` and stop syncing, as in the app; `conflicts` lists them with the
    differing fields, `resolve <n> here|backup` picks. SKILL.md: keep the phone's unless the user says otherwise.
- **push** syncs, applies the batch to the copy, prints it, syncs again. The batch grows:
  - entries with `id` (`own:…`, `log:…`) change only the fields given; `delete` takes `log:`/`own:` ids. A food still
    used after the batch isn't deleted (an error, not a silent skip).
  - a changed consumption's amount takes `amount`, `delta` and `unit` together (a test kept a ±100 from another amount).
  - **recipes**: a new food with `components` (each like a consumption); `per` is their sum by default (the food
    editor's Auto), `null` for portions, and stays when a changed recipe's components change unless `"auto"`. With
    `madeAt`, a concoction. SKILL.md: a dish they'll eat again is a recipe, a pot eaten over meals a concoction; one-off
    dishes stay grouped consumptions.
  - **Repeats**: new rows equal to one already there (all but the id) are skipped, so a batch pushed twice adds nothing,
    as before; ids are random (`makeId`, as `db.js`).
  - Groups join a group of the same name the user has within 12 h, so a dish can grow later.
- **day** lists a day's consumptions with their ids, for finding what to change. Nominal kcal now include recipes
  (summed through their components), and CIQUAL drinks take `ml` (`external.js mlUnit`'s density, ported).
- **find**: the query is words (folded, split on anything but letters and digits, plurals and -ed/-ing cut), each
  matching a word it starts; ranked by the share of the query found, rarer words weighing more, then by fewest other
  words in the name. Foods with some of the words follow when fewer than 10 have them all. A short alias list
  (`coca cola`, `coke`, `pepsi` → `cola`) for brands that name a generic food the tables list under its own name.
- `inbox` stays, for batches the old tool left there; the app still takes them in.

## Alternatives considered

- **Keep the inbox, add a "changes" message to it**: the app would need a second merge path for edits and deletes,
  with its own conflicts; syncing already has both.
- **Claude edits `.secrets/backup.json` with jq, then `sync`**: works, but the rows' shape (nutrient objects, texts,
  Δ flags) is easy to get wrong and nothing checks it. SKILL.md says only to look.
- **Deterministic ids** for idempotency: ids sort by creation, which a hash can't give; skipping exact repeats is
  what the app's merge does anyway.
- **A synonym table for search**: only the cola brands needed one; the tables use English generic names otherwise.

## Consequences

- Claude's changes reach the phone at its next sync, and the phone's reach Claude at every `push` (which syncs first).
- If Claude and the phone change the same row in between, someone picks, as between two phones.
- The skill lives in `.claude/` (not tracked in git), so only `sync.js` and the docs are committed.

## How it was checked

- `npm run build`. Local backup server; a script as a second device (upload, edit with compare-and-swap); the tool
  with `FOOD_TRACKER_URL` and a test secret, starting from a copy of the real data.
  - First sync; a batch with a recipe (in portions), a concoction, a changed own food, a changed and a deleted
    consumption, a cola in ml: the device sees all of it. Pushing it again: every new row skipped.
  - Device and tool changing different rows: both kept. The same row: a conflict, listed with both amounts; resolved
    to the backup's, uploaded; copy and base equal after.
  - Deleting a food still used: refused; once the batch moved its consumption elsewhere: deleted. A group joined.
- The built app (`vite preview`, headless Chromium via Playwright): restored from the test secret; a tool push came
  in by itself (new recipe, consumptions in a group, a changed amount); an edit in the app came back to the tool on
  `sync`; neither side saw phantom changes afterwards.
- The three searches: the right foods first ("Spinach, raw" from both tables; the colas; roasted chicken breast with
  and without skin, among the deli rolls).
- Against production: a first sync only (download).
- Not checked: the 409 path (another device uploading between the tool's download and upload); it's the app's loop.
