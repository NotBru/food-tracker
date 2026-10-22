# Supplements: protein powder CVs from label-accuracy studies; import popup removed

- **Date:** 2026-10-22
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md); model from [`docs/notes/error-handling.md`](../notes/error-handling.md)

## Context

[supplements-class](2026-10-22-supplements-class.md) estimated tight CVs. The user asked whether supplements are
really tight. Protein powders often test below their label: 21 of 70 products more than 10% below and 5 of them 42–80%
below (Schönfeldt, Hall & Pretorius 2019, J Food Compos Anal 83:103293); 11 Colombian wheys averaged 65.7 g/100 g
against 81.4 g labelled (JISSN 2022, PMC9261742). Creatine content data is thin (ConsumerLab 2000: 1 of 13 low).

## Decision

- Supplements: protein CV 15% with bias −5%, energy 10%, creatine/caffeine 5%; the rest unchanged.
- The "Import done." alert after a confirmed import is gone (user request); failures still alert.

## Alternatives considered

- **A skewed distribution for protein** — the lognormal with a bias is what the model has.

## Consequences

- Whey 31 g: 23.8 g protein, 18.3–30.2 at 90%. Energy keeps the label's value, so it no longer matches the biased
  protein exactly.
- A tub's deviation from its label is shared by every serving from it; the model draws each serving anew, so the
  error summed over weeks is understated. Treating a tub like a concoction batch would fix it.
