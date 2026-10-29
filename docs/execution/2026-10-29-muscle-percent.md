# Body measurements: muscle as a %, beside muscle mass

- **Date:** 2026-10-29
- **Status:** accepted
- **Instructions:** [`docs/instructions/design.md`](../instructions/design.md) (Body measurements screen)
- **Builds on:** [body-errors](2026-10-24-body-errors.md), [log-food-body](2026-10-29-log-food-body.md)

## Context

The user's scale (Beurer, HealthManager Pro export) reports muscle as a % of body weight; their entries had put it
in "Muscle mass" (kg). User in chat: "Modify the app so that it can take in %, no? and log the %, just like body fat".

## Decision

- A built-in field `musclePct` ("Muscle", %), after body fat; "Muscle mass" (kg) stays for scales that give kg.
  It's in the entry form, the entry list ("% muscle"), the 7-day averages and the time graphs like any built-in field.
  `measures()` picks the fields by key, not by position.
- The log-food tool reads the fields from `body.js`, so batches take `musclePct` as they are.

## Alternatives considered

- **Switch "Muscle mass" to %**: would misread anyone's muscle entries in kg.
- **Convert % to kg on entry** (× weight): stores a derived number and drops what the scale reported.
- **An extra (named) measurement**: works without a change, but body fat, the same kind of number, is built in.

## Consequences

An app version without the field ignores `musclePct`, and saving an edited entry there drops it: deploy before
syncing entries that carry it.

## How it was checked

`npm run build`; `vite preview` with headless Chromium at 390 px: the form lists Weight, Body fat, Muscle %, Muscle
mass, Waist; an entry saved with muscle 41.8 shows "41.8 % muscle" and a "Muscle · 41.8 %" 7-day average.
