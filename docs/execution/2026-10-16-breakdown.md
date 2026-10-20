# Nutrient breakdown screen, error ranges on the dashboard, view kept in the URL

- **Date:** 2026-10-16
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Homescreen, Consumptions screen)

## Context

User:
- "If I click something in the dashboard (calories, protein, etc.) I want to go to another screen that shows a
  sorted bar chart (horizontal bars) with how much has gone with every consumption, as well as the possibility
  to sort them in quintiles."
- "Also, I want the range implied by the error to be shown in the dashboard."
- "If I click 'consumptions' and I'm looking at yesterday, I want to go to yesterday's consumptions page."

## Decisions

### Breakdown screen (`screens/Breakdown.jsx`, route `#/breakdown/<nutrient>?from=…&to=…`)
- Every dashboard tile or row is now a button. It opens the breakdown of that nutrient over the window shown:
  the day (including a past day picked with the arrows), the week or the month.
- **Header:** total ± Δ and its range, e.g. "1766 kcal ±110 · range 1656–1875 kcal".
- **Ranked (default):** one row per consumption, largest first.
  - Each row has a horizontal bar on a common scale (max of value + Δ), drawn like the dashboard fill: solid to
    value − Δ, hatched to value + Δ, a white tick at the value.
  - Labels: value ± Δ, share of the total, time (date and time for week/month), amount and range.
- **Quintiles:** the same ranked rows split into five groups of (nearly) equal count, largest first. The spare
  rows go to the top groups, and empty groups are hidden when there are fewer than 5 consumptions.
  - Each group heading shows its count, subtotal and share, e.g. "Top 20% · 2 · 1145 kcal (65%)".
  - This reads "quintiles" by rank (count). The alternative was cumulative share: which consumptions make up
    the first 20% of the total. That one is easy to switch to if wanted.
- Bars use the nutrient's own colour (one series, so no legend; the screen title names it). Groups are headings,
  not extra colours.
- Tapping a row opens that consumption's day in Consumptions.
- **Left out of the bars:**
  - consumptions without that nutrient, or with 0 of it, are counted in a note at the bottom;
  - consumptions that couldn't be computed are also noted.
- **Energy:** each consumption uses `calories()`, so it matches the dashboard (Atwater estimate when kcal is
  unknown).

### Error range on the dashboard
- The "±Δ" line now also gives the range: "kcal ±110 · 1656–1875" (tiles), and the same after the value
  (bars).
- The low end is floored at 0. It is hidden when Δ = 0, where it would read "0–0".

### Consumptions button follows the day shown
- When the daily dashboard shows a past day, the Consumptions button opens `#/consumptions?day=<that day>`.
- Otherwise it opens today's consumptions, as before.

### View kept in the URL (bug found while testing)
- Going back from the breakdown reset the dashboard to today: the picked day and window were component state,
  lost when the homescreen unmounted.
- They now live in the homescreen URL, `#/?win=weekly&day=2026-10-15`, updated with `replace` so the arrows
  don't pile up history entries.
- No `day` means today, which still follows midnight ([day rollover](2026-10-16-day-rollover.md)). A `day` at
  or after today is ignored.
- `daysBetween` is back in `time.js`, for the "N days ago" title.

## Verification

Headless Chromium. Seed: 7 consumptions yesterday (oats, yogurt, apple, rice, burger 293 g, chocolate, apple)
and 1 today.
- Dashboard on yesterday: "kcal ±110 · 1656–1875".
- Tapping Calories opened `#/breakdown/energy?from=2026-10-15&to=2026-10-15`:
  - ranked list: Burger 820 (46%) … Apple 62 (4%);
  - quintiles: 2/2/1/1/1 rows with the right subtotals (65/22/5/4/4%).
- Back returned to "Yesterday · Thu 2026-10-15" (`#/?day=2026-10-15`).
- Consumptions opened `#/consumptions?day=2026-10-15`.
- Weekly Protein opened the week's range (84 g ±11.7).
- No console errors.

## Update: quintiles by amount; rows open the food

User: "Quintiles are wrong, no? every block should have the same *amount* of calories…" and "if I click in an
item … I expect to go to the 'edit food' place."
- **Quintiles are now by amount.** The ranked list is cut into five blocks of exactly 20% of the total each.
  - A consumption that straddles a cut is **split**. Each block shows its part ("241 of 600"), with its Δ split
    in the same proportion and its bar the length of the part.
  - Headings give each block's amount and number of consumptions, marked "(some split)" where relevant.
  - A large consumption can fill whole blocks: a 600 kcal steak of a 1205 kcal day fills the top two blocks and
    half of the third.
  - The count-based version above is superseded.
- **Tapping a row** opens that food's Info tab (`#/foods/<id>?tab=info`, see
  [food info](2026-10-16-food-info.md)), no longer the consumption's day.
- **Verified:** 5 consumptions, 1205 kcal. Every block is 241 kcal: Nalga 241 + 241 + 118; Rice 123 + 202;
  Egg 39 + 101; Apple 78; Apple 62.

## Update: quintiles as whole consumptions, cut greedily nearest 1/5

User: "Don't split the food. I need the quintiles to be a division into 5 of the sorted (descending) elements, so
that when deciding each limit (from top to bottom), it is chosen to err the closest to 1/5."
- This supersedes the split-by-amount version above.
- **Rule** (`quintiles()` in `Breakdown.jsx`): walk the ranked list from the top. For Q1…Q4, take the number of
  consumptions whose **sum is closest to total / 5**. Ties go to fewer consumptions.
- Each group takes **at least one** consumption, and leaves at least one for each group still to come, as long
  as there are enough. Q5 takes the rest. With fewer than 5 consumptions the missing groups are dropped.
- Headings: "Q1 · 820 kcal (46%) · 1 consumption". Groups are no longer named by a fixed 20% band, because their
  shares now vary.
- "Closest to 1/5" is measured per group (its own sum against total / 5), as asked. Measuring the cumulative
  sum against k/5 instead would stop errors piling up towards the bottom; easy to switch if wanted.
- **Verified** (headless Chromium, 1 kcal/g so grams = kcal):
  - 7 items, 1765 total (target 353): [820] [325] [228, 162] [90, 78] [62], matching the hand calculation;
  - 12 items, 1530 total (target 306): [300] [250] [200, 180] [150, 120] [100, 90, 60, 40, 30, 10];
  - no console errors.

## Update: each group's target is what's left ÷ groups left

User reported a 2 kcal coffee alone in Q5. On a 1223 kcal day with a fixed target of 244.6:
- Q1 took 406 and Q2 took 328 (single big items). That left 489 for three groups.
- Q3 (182 + 120 = 302) and Q4 (107 + 78 = 185) still aimed at 244.6, so each took two items and left only the
  coffee for Q5.
- This is the drift noted in the previous update.

**Fix** (user chose it):
- Each group's target is recomputed as **remaining total ÷ groups still to fill**. The cuts are still decided
  from the top, closest to the target, ties to fewer rows.
- The at-least-one rule is unchanged.

**Verified** (headless Chromium):
- The user's day (406, 328, 182, 120, 107, 78, 2) now gives [406] [328] [182] [120] [107, 78, 2 = 187].
- The 12-item day is unchanged, because its targets (306, 307.5, 326.7, 300) pick the same cuts.
- No console errors.
