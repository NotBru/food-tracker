import { db } from './db'
import { addDays, dayBounds } from './time'
import { NUTRIENTS, calories } from './nutrients'

// Built-in conversions to a base unit per dimension.
const BUILTIN = {
  g: ['mass', 1], kg: ['mass', 1000], mg: ['mass', 0.001], oz: ['mass', 28.349523125], lb: ['mass', 453.59237],
  ml: ['volume', 1], l: ['volume', 1000], cl: ['volume', 10], dl: ['volume', 100],
  tsp: ['volume', 4.92892], tbsp: ['volume', 14.7868], cup: ['volume', 236.588], 'fl oz': ['volume', 29.5735],
}

const norm = (u) => String(u ?? '').trim().toLowerCase()

// --- Intervals ---------------------------------------------------------------
// Every amount may carry an error (amount ± Δ). Scale factors are carried as [nominal, low, high] so the error
// of each nutrient can be taken at the worst case of all amounts involved.

const EXACT = (f) => [f, f, f]
const NO_FACTOR = [NaN, NaN, NaN]
/** amount ± Δ as [nominal, low, high]; the low end never goes below 0. */
export const span = (x, d) => [x, Math.max(0, x - (Math.abs(d) || 0)), x + (Math.abs(d) || 0)]
const mul = ([a, al, ah], [b, bl, bh]) => [a * b, al * bl, ah * bh]
// Dividing by an interval that reaches 0 has no upper bound.
const div = ([a, al, ah], [b, bl, bh]) => [a / b, al / bh, bl > 0 ? ah / bl : Infinity]

/**
 * Factor f such that `amount fromUnit` = `amount * f toUnit`, or NaN if unknown.
 * Uses built-ins, then the food's own units ([{fromAmount, fromDelta?, fromUnit, toAmount, toDelta?, toUnit}],
 * e.g. 1 slice = 30 ± 5 g), chained through at most one built-in hop on either side (1 slice -> 30 g -> 0.03 kg).
 */
export function unitFactor(fromUnit, toUnit, units = []) {
  return unitFactorSpan(fromUnit, toUnit, units)[0]
}

/** Same as unitFactor, as [nominal, low, high] given the units' errors. */
export function unitFactorSpan(fromUnit, toUnit, units = []) {
  const from = norm(fromUnit)
  const to = norm(toUnit)
  if (from === to) return EXACT(1)
  const builtin = (a, b) => (BUILTIN[a] && BUILTIN[b] && BUILTIN[a][0] === BUILTIN[b][0] ? BUILTIN[a][1] / BUILTIN[b][1] : NaN)
  const direct = builtin(from, to)
  if (Number.isFinite(direct)) return EXACT(direct)

  // Edges from the food's units, both directions.
  const edges = []
  for (const c of units) {
    if (!(c.fromAmount > 0 && c.toAmount > 0)) continue
    const a = span(c.fromAmount, c.fromDelta)
    const b = span(c.toAmount, c.toDelta)
    edges.push([norm(c.fromUnit), norm(c.toUnit), div(b, a)])
    edges.push([norm(c.toUnit), norm(c.fromUnit), div(a, b)])
  }
  const hop = (a, b) => (a === b ? 1 : builtin(a, b))
  for (const [a, b, f] of edges) {
    const k = hop(from, a) * hop(b, to)
    if (Number.isFinite(k)) return mul(EXACT(k), f)
  }
  return NO_FACTOR
}

/**
 * Adds `nutrients` scaled by `factor` (a number, or [nominal, low, high]) into `total`. The Δ added is the worst
 * case over (value ± Δ) × [low, high]; for an exact factor that's just Δ·|factor|. Δs of a sum add up.
 */
function addInto(total, nutrients, factor) {
  if (!nutrients) return
  const [f, lo, hi] = Array.isArray(factor) ? factor : EXACT(factor)
  for (const { key } of NUTRIENTS) {
    // Unknown energy is estimated from macros per item, so one label without kcal doesn't zero it out.
    const n = key === 'energy' ? calories(nutrients) : nutrients[key]
    if (!n) continue
    const t = (total[key] ??= { value: 0, delta: 0, missing: false })
    if (n.estimated) t.estimated = true
    if (Number.isFinite(n.value)) {
      const d = Number.isFinite(n.delta) ? Math.abs(n.delta) : 0
      const v = n.value * f
      const corners = [(n.value - d) * lo, (n.value - d) * hi, (n.value + d) * lo, (n.value + d) * hi]
      t.value += v
      t.delta += lo === hi ? d * Math.abs(f) : Math.max(Math.max(...corners) - v, v - Math.min(...corners))
    } else {
      t.missing = true
    }
  }
}

/** Load everything nutrient computation needs, once. */
export async function loadContext() {
  const list = await db.items.toArray()
  return { items: new Map(list.map((r) => [r.id, r])), list }
}

/** Keep `unit` if it still works for the newly picked food, otherwise switch to the food's own unit. */
export function keepUnit(ctx, itemId, unit) {
  const units = unitsFor(ctx, itemId)
  return unit && units.includes(norm(unit)) ? unit : units[0]
}

/** Units food `itemId` can be measured in: its own unit first, then its defined units and convertible built-ins. */
export function unitsFor(ctx, itemId) {
  const item = resolve(ctx, itemId)
  if (!item) return []
  const base = norm(baseAmount(item)[1])
  const candidates = new Set([...Object.keys(BUILTIN), 'portion'])
  for (const c of item.units ?? []) candidates.add(norm(c.fromUnit)).add(norm(c.toUnit))
  candidates.delete(base)
  candidates.delete('')
  return [base, ...[...candidates].filter((u) => Number.isFinite(unitFactor(u, base, item.units))).sort()]
}

export const resolve = (ctx, id) => ctx.items.get(id)

/** Amount and unit an item's nutrients refer to (plus the amount's error). Without one it counts as 1 portion. */
export function baseAmount(item) {
  if (item.amount > 0 && item.unit) return [item.amount, item.unit, Math.abs(item.amountDelta) || 0]
  return [1, 'portion', 0]
}

/**
 * Nutrients for `amount unit` of item `id`. Items with components get them inferred from the components;
 * otherwise their own nutrients are used.
 * Returns { nutrients: {key: {value, delta, missing}}, ok } where ok=false means a unit couldn't be converted
 * or an item is missing.
 */
export function nutrientsFor(ctx, id, amount, unit, amountDelta = 0, seen = new Set()) {
  const out = { nutrients: {}, ok: true }
  const item = resolve(ctx, id)
  if (!item || seen.has(id)) return { ...out, ok: false }

  // (amount ± Δ) converted to the base unit, divided by (base amount ± Δ).
  const [baseAmt, baseUnit, baseDelta] = baseAmount(item)
  const factor = div(mul(span(amount, amountDelta), unitFactorSpan(unit, baseUnit, item.units)), span(baseAmt, baseDelta))
  if (!Number.isFinite(factor[0])) return { ...out, ok: false }

  if (!item.components?.length) {
    addInto(out.nutrients, item.nutrients, factor)
    return out
  }
  const nextSeen = new Set(seen).add(id)
  for (const c of item.components) {
    const sub = nutrientsFor(ctx, c.itemId, c.amount, c.unit, c.amountDelta, nextSeen)
    if (!sub.ok) out.ok = false
    addInto(out.nutrients, sub.nutrients, factor)
    for (const k in sub.nutrients) if (sub.nutrients[k].missing) out.nutrients[k].missing = true
  }
  return out
}

/** Nutrients of a consumption, `amount ± amountDelta unit` (worst case of all errors involved). */
export function consumptionNutrients(ctx, { itemId, amount, unit, amountDelta }) {
  return nutrientsFor(ctx, itemId, amount, unit, amountDelta)
}

export function sumNutrients(list) {
  const total = {}
  for (const n of list) {
    addInto(total, n, 1)
    for (const k in n) if (n[k].missing) total[k].missing = true
  }
  return total
}

// --- Targets ----------------------------------------------------------------
// A target is valid from its timestamp until the next one starts.
// Values are per day: {nutrientKey: {min?, max?}}, both optional.

/** Target that applies to a logical day: the latest one that started before the day ended. */
export function targetForDay(targets, day, dayStart) {
  const end = dayBounds(day, dayStart)[1].toISOString()
  let found = null
  for (const t of targets) if (t.validFrom < end && (!found || t.validFrom > found.validFrom)) found = t
  return found
}

/** Daily min/max summed over the days [first, last], per nutrient (a bound only counts the days that set it). */
export function windowTargets(targets, first, last, dayStart) {
  const total = {}
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const t = targetForDay(targets, d, dayStart)
    for (const [k, r] of Object.entries(t?.values ?? {})) {
      const acc = (total[k] ??= {})
      for (const bound of ['min', 'max']) if (Number.isFinite(r[bound])) acc[bound] = (acc[bound] ?? 0) + r[bound]
    }
  }
  return total
}

/**
 * Progress-bar geometry for `value` against {min?, max?}, in % of the bar's width.
 * With a max, the max sits at 80% (and the min proportionally); with only a min, the min sits at 50%.
 * The fill clips at 100%. `errLo`/`errHi` place the value's error bar (value ± delta) on the same scale.
 */
export function targetBar(value, { min, max } = {}, delta = 0) {
  const hasMin = Number.isFinite(min)
  const hasMax = Number.isFinite(max)
  if (!hasMin && !hasMax) return null
  const full = hasMax ? (max > 0 ? max / 0.8 : 1) : min > 0 ? min / 0.5 : 1
  const pos = (x) => Math.min(100, Math.max(0, (x / full) * 100))
  // Worst case of the error bar: "ok" only if all of [value − Δ, value + Δ] is within the range. If the error bar
  // spills over both bounds, the side the value itself leans to wins.
  const d = Number.isFinite(delta) ? Math.abs(delta) : 0
  const low = hasMin && value - d < min
  const high = hasMax && value + d > max
  const status = low && high ? (value - min < max - value ? 'under' : 'over') : low ? 'under' : high ? 'over' : 'ok'
  return {
    fill: pos(value), minAt: hasMin ? pos(min) : null, maxAt: hasMax ? pos(max) : null, status,
    errLo: d ? pos(value - d) : null, errHi: d ? pos(value + d) : null,
  }
}
