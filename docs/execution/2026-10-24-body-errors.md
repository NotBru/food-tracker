# Body measurements: muscle mass, user-defined fields, and a ± Δ on every value

- **Date:** 2026-10-24
- **Status:** accepted
- **Instructions:** none (not in [`docs/instructions/design.md`](../instructions/design.md)); request in chat

## Context

The user: "Add Muscle mass too, plus any amount of fields the user may wanna register. Have it take in
experimental error for all of these measurements." This builds on [body-measurements](2026-10-24-body-measurements.md).

## Decision

- **Muscle mass (kg)** is a built-in field, after Lean mass, which smart scales report on their own. Built-ins:
  weight, body fat, muscle mass, waist. Lean mass is still derived from weight and body fat.
- **Custom fields:** a ⚙️ on the Body measurements screen opens Fields, where fields are added (name, unit),
  renamed or removed. They're shared by all users, like foods, and stored as config row `bodyFields`
  `[{key, label, unit}]`, so they export with the rest.
  - Removing a field deletes its values after asking, and deletes entries left with nothing.
  - Keys are generated, so a rename keeps the history.
  - A custom chart's scale is at least 5% of its value tall (or 1).
- **Every value has a ± Δ, like amounts.** It's stored as `values: {field: {value, text, delta, auto}}`
  (`nutrients.js measure`). A blank Δ comes from the digits typed: "78.4" gives ±0.1, "19" gives ±1. Like any
  amount, Δ is read as a uniform error, σ = Δ/√3.
  - The entry sheet is a table: field | value | ± Δ.
  - A Δ typed by hand shows in the list ("18.5 ±3 % fat").
  - A home scale's body fat and muscle deserve a typed Δ: their digits claim 0.1, but the reading is good to
    a few %.
- **Errors carried through:**
  - **A day:** the mean of its measurements, variance Σσ²/n².
  - **Lean mass:** propagated per entry, (1 − f/100)²σkg² + (kg/100)²σf².
  - **7-day average:** the variance is the larger of two estimates: the days' spread²/n, and the measurements'
    own errors Σσ²/n².
    - The spread already holds the measurement errors and the daily swings. With few days it's shaky, and with
      one day there is none.
    - Taking the larger never claims more certainty than the instruments allow.
  - **Maintenance:** the trend's residual variance is likewise at least the mean of the weigh-ins' own
    variances.
- **Time graphs:** each day's dot has its interval drawn as a thin bar. The readout gives the day's ± and range.
- **Data:** db v14 turns the earlier rows' numbers into values with Δ from the digits. Imports of older exports
  do the same (`body.js bodyValues`, idempotent).
  - A weight saved earlier as a whole number ("78") gets ±1. Those few entries are worth editing by hand.

## Alternatives considered

- **Fields per user.** Config and foods are shared, and two people tracking the same things is the usual case.
- **Free key/value pairs per entry (like food attributes).** Typos would split one measurement into two charts.
- **Δ as a standard deviation.** That would differ from every other ± in the app.

## Consequences

- The Android port has none of this.
