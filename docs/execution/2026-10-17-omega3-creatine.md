# Nutrients: Omega-3 and Creatine

- **Date:** 2026-10-17
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Foods screen → nutrients); request in chat

## Context

The user asked (in chat) for a creatine nutrient and wondered whether food databases have it. The same
question applied to omega-3.

## What the databases have (checked 2026-10-17)

- **CIQUAL 2025:** no creatine at all and no omega-3 total. It does give the three main omega-3s:
  ALA (18:3 n-3, code 41833) for 2107 foods, EPA (20:5 n-3, 42053) for 2548 and DHA (22:6 n-3, 42263)
  for 2525, out of 3484.
- **Open Food Facts:** its nutrient taxonomy has both `omega-3-fat` and `creatine` (plus ALA, EPA and
  DHA separately). They are optional label fields, though, so few products fill them in. Creatine
  shows up mostly on supplements.

## Decision

- Two new nutrients (`nutrients.js`): **Omega-3** (`omega3`, g, after polyunsaturated fat) and
  **Creatine** (`creatine`, g, after caffeine). Grams match how food labels give them and how creatine
  is dosed. Neither has a default, so a food without them stores NaN (unknown), not 0.
- **OFF import:** `omega-3-fat` → `omega3`, `creatine` → `creatine`. OFF's `_100g` values are in
  grams, like the rest of the map.
- **CIQUAL import:** `scripts/ciqual.py` computes `omega3` = ALA + EPA + DHA, only when all three are
  given (1793 foods); a partial sum would read as a low value. The Δs add up, worst case, the same way
  `calc.js` sums errors. A plain value's Δ comes from its digits, like elsewhere. `public/ciqual.json`
  was regenerated from the same 2025-11-03 XML. Every existing value is unchanged; only the `omega3`
  column is new.

## Consequences

- CIQUAL's omega-3 leaves out the minor n-3 acids (DPA and others), so it runs slightly low,
  especially for fish.
- Creatine will mostly have to be typed in by hand (meat and fish have roughly 0.3–0.5 g/100 g raw,
  but no table here gives it).
- Web app only; the Android port's nutrient list doesn't have these yet.
