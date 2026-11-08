# CIQUAL without its caffeinated drinks

- **Date:** 2026-11-08
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (reference databases); request in chat

## Context

User: "The CIQUAL espresso entry has no caffeine?", then "Remove all entries from CIQUAL that should have caffeine
from the DB". CIQUAL 2025 has no caffeine component (none of its 74 `const` codes is caffeine or another
methylxanthine), so its coffees, teas, colas and energy drinks count 0 mg. USDA (SR Legacy) gives caffeine for nearly
all of them: espresso 212, brewed coffee 40, black tea 20, cola 9, energy drinks ~30 mg/100 g.

## Decision

`app/scripts/ciqual.py` leaves out 40 drinks (`EXCLUDE`): coffee, tea, tea soft drinks, kombucha, cola, energy
drinks, and cocoa and chocolate drinks and powders. Kept: decaffeinated coffees and caffeine-free colas (~0 mg is
right for them), and solid foods (chocolate, coffee desserts), whose caffeine is a few mg per serving.

The user's data was moved first, so no row points at a removed code: espresso in Capu Kinder and both Flat Whites,
2 espressos and 4 sugared colas now use USDA (171891, 174852). Their Coca-Cola Zero (OFF 5449000133335) had
caffeine 32 per 100 ml, the per-can (330 ml) value; now 9.5 (Coca-Cola's label).

## Alternatives considered

- **Fill caffeine from a matching USDA food** — keeps the CIQUAL entries, but mixes two sources in one food and
  needs a hand-kept mapping; the user asked for removal.
- **Keep the entries with no USDA equivalent** (ground coffee, tea leaf, unsweetened café au lait, cappuccino powder,
  chicory and coffee with milk, kombucha) — they'd still count 0 mg; an own food or recipe covers them.

## Consequences

- A consumption of a removed code on a device that hadn't synced would lose its food; the backup had none.
- If CIQUAL adds caffeine in a later version, drop `EXCLUDE`.
