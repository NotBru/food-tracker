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

/**
 * Total of a recipe's components (stored form: {itemId, amount, amountDelta, unit}) in `unit`, as {value, delta}.
 * Δs add up, unit conversions' errors included. {problem} names the first component that can't be counted.
 */
export function componentsTotal(ctx, components, unit) {
  let total = EXACT(0)
  for (const c of components) {
    const item = resolve(ctx, c.itemId)
    const name = item?.name || 'a component'
    if (!(c.amount >= 0)) return { problem: `${name} has no amount` }
    const f = unitFactorSpan(c.unit, unit, item?.units)
    if (!Number.isFinite(f[0])) return { problem: `${name}: no conversion from ${c.unit || '(no unit)'} to ${unit}` }
    total = total.map((t, k) => t + mul(span(c.amount, c.amountDelta), f)[k])
  }
  const [value, lo, hi] = total
  if (!Number.isFinite(hi)) return { problem: 'a unit conversion has no upper bound' }
  return { value, delta: Math.max(hi - value, value - lo) }
}

export const resolve = (ctx, id) => ctx.items.get(id)

/**
 * What is left of each concoction: id -> {value, amount, unit}, in its own amount and unit. Taken off it: every
 * consumption of it (`logs`, every user's: they share the pot) but `skipLogId` (the one being edited), and every
 * other concoction it went into. Nominal values; an amount in a unit that doesn't convert is left out.
 */
export function concoctionsLeft(ctx, logs, skipLogId) {
  const left = new Map()
  for (const it of ctx.list) {
    if (!it.madeAt) continue
    const [amount, unit] = baseAmount(it)
    left.set(it.id, { value: amount, amount, unit })
  }
  const take = (id, amount, unit) => {
    const l = left.get(id)
    const f = l && unitFactor(unit, l.unit, resolve(ctx, id).units)
    if (Number.isFinite(f) && amount > 0) l.value -= amount * f
  }
  for (const log of logs) if (log.id !== skipLogId) take(log.itemId, log.amount, log.unit)
  for (const it of ctx.list) if (it.madeAt) for (const c of it.components ?? []) take(c.itemId, c.amount, c.unit)
  return left
}

/** Eaten up: nothing left, give or take float rounding. */
export const usedUp = (left) => !!left && left.value <= left.amount * 1e-6

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
  const eaten = mul(span(amount, amountDelta), unitFactorSpan(unit, baseUnit, item.units))
  let factor = div(eaten, span(baseAmt, baseDelta))
  if (!Number.isFinite(factor[0])) return { ...out, ok: false }

  if (!item.components?.length) {
    addInto(out.nutrients, item.nutrients, factor)
    return out
  }
  const nextSeen = new Set(seen).add(id)
  if (isSumOfComponents(ctx, item, baseAmt, baseUnit, baseDelta)) {
    // Exactly its amount is all of it (as a blank amount eaten saves it): just the components, however much that is.
    if (eaten[1] === baseAmt && eaten[2] === baseAmt) factor = EXACT(1)
    else if (addShareInto(out, ctx, item, eaten, baseUnit, nextSeen)) return out
  }
  for (const c of item.components) {
    const sub = nutrientsFor(ctx, c.itemId, c.amount, c.unit, c.amountDelta, nextSeen)
    if (!sub.ok) out.ok = false
    addInto(out.nutrients, sub.nutrients, factor)
    for (const k in sub.nutrients) if (sub.nutrients[k].missing) out.nutrients[k].missing = true
  }
  return out
}

// --- Recipes whose amount is the sum of their components ------------------------------------------------------
// When a recipe's amount is its components' sum (Auto, or a concoction added from a consumption), its error is the
// components' errors over again. Dividing by it as if it were measured on its own counts them twice: all of a
// 203 ± 75 g concoction holding 660 ± 254 kcal came out at 660 ± 789 kcal. Instead, the components' amounts tᵢ
// move both the nutrients and the total, so per base unit the recipe holds Σ ρᵢtᵢ / Σ gᵢtᵢ (ρᵢ: nutrient per unit
// of component i, gᵢ: base units per unit of it), taken at its worst case over every tᵢ, ρᵢ and gᵢ in their ranges.

/** True when the recipe's amount ± Δ is its components' sum, as Auto rounds it (6 and 3 significant digits). */
function isSumOfComponents(ctx, item, baseAmt, baseUnit, baseDelta) {
  const total = componentsTotal(ctx, item.components, baseUnit)
  if (total.problem || !(total.value > 0)) return false
  const close = (a, b, rel) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b)) + 1e-9
  return close(baseAmt, total.value, 1e-5) && close(baseDelta, total.delta, 1e-2)
}

/**
 * Largest Σ aᵢtᵢ / Σ bᵢtᵢ over tᵢ ∈ [loᵢ, hiᵢ] (bᵢ ≥ 0). It's at a corner where the parts with the highest aᵢ/bᵢ are
 * at their high end and the rest at their low end, so only n + 1 corners need trying.
 */
function maxRatio(a, b, lo, hi) {
  const ratio = (i) => (b[i] > 0 ? a[i] / b[i] : Math.sign(a[i]) * Infinity || 0)
  const order = a.map((_, i) => i).sort((i, j) => ratio(j) - ratio(i) || 0)
  let best = -Infinity
  for (let k = 0; k <= order.length; k++) {
    let num = 0, den = 0
    order.forEach((i, rank) => { const t = rank < k ? hi[i] : lo[i]; num += a[i] * t; den += b[i] * t })
    if (den > 0) best = Math.max(best, num / den)
    else if (num > 0) return Infinity
  }
  return best
}

/**
 * Nutrients of `eaten` ([nominal, low, high], in the recipe's base unit) of a recipe whose amount is its components'
 * sum, into `out`. False (and nothing added) if a component's amount can't be put in the base unit.
 */
function addShareInto(out, ctx, item, eaten, baseUnit, seen) {
  const parts = []
  for (const c of item.components) {
    const g = unitFactorSpan(c.unit, baseUnit, resolve(ctx, c.itemId)?.units)
    if (!Number.isFinite(g[2])) return false
    const [t, lo, hi] = span(c.amount, c.amountDelta)
    parts.push({ per: nutrientsFor(ctx, c.itemId, 1, c.unit, 0, seen), g, t, lo, hi })
  }
  if (parts.some((p) => !p.per.ok)) out.ok = false
  const [e, eLo, eHi] = eaten
  const lo = parts.map((p) => p.lo), hi = parts.map((p) => p.hi)
  for (const { key } of NUTRIENTS) {
    const ns = parts.map((p) => (key === 'energy' ? calories(p.per.nutrients) : p.per.nutrients[key]))
    if (!ns.some(Boolean)) continue
    const t = (out.nutrients[key] = { value: 0, delta: 0, missing: false })
    // A component without the value counts as 0 of it, flagged as missing (like addInto).
    const v = ns.map((n) => (n && Number.isFinite(n.value) ? n.value : 0))
    const d = ns.map((n) => (n && Number.isFinite(n.value) && Number.isFinite(n.delta) ? Math.abs(n.delta) : 0))
    if (ns.some((n) => n?.estimated)) t.estimated = true
    if (ns.some((n) => !n || !Number.isFinite(n.value) || n.missing)) t.missing = true
    const nominal = parts.reduce((s, p, i) => s + v[i] * p.t, 0) / parts.reduce((s, p) => s + p.g[0] * p.t, 0)
    const high = maxRatio(v.map((x, i) => x + d[i]), parts.map((p) => p.g[1]), lo, hi)
    const low = -maxRatio(v.map((x, i) => -(x - d[i])), parts.map((p) => p.g[2]), lo, hi)
    t.value = e * nominal
    t.delta = Math.max((high >= 0 ? eHi : eLo) * high - t.value, t.value - (low >= 0 ? eLo : eHi) * low)
  }
  return true
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

/** Daily min/max averaged over `days`, per nutrient (each bound over the days that set it). */
export function averageTargets(targets, days, dayStart) {
  const sum = {}
  const count = {}
  for (const d of days) {
    const t = targetForDay(targets, d, dayStart)
    for (const [k, r] of Object.entries(t?.values ?? {})) {
      for (const bound of ['min', 'max']) {
        if (!Number.isFinite(r[bound])) continue
        ;(sum[k] ??= {})[bound] = (sum[k][bound] ?? 0) + r[bound]
        ;(count[k] ??= {})[bound] = (count[k][bound] ?? 0) + 1
      }
    }
  }
  const out = {}
  for (const k in sum) for (const bound in sum[k]) (out[k] ??= {})[bound] = sum[k][bound] / count[k][bound]
  return out
}

/** `total` from sumNutrients, divided by `n` days (value and Δ alike). */
export function perDay(total, n) {
  const out = {}
  for (const k in total) out[k] = { ...total[k], value: total[k].value / n, delta: total[k].delta / n }
  return out
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

// --- Weekly calorie correction ------------------------------------------------
// The daily calorie goal moves to make up for the days before it: the range shown for `day` is the one `day` must
// land in for the 7-day per-day average (the 6 days before `day`, plus `day`) to be within the target, capped.

export const WEEKLY_CAP = 500 // kcal

/**
 * The calorie target for `day`, set so that eating within it puts the 7-day per-day average within the target.
 * The earlier days are the 6 before `day`; `eaten` is {day: {value, delta}} (kcal) for the ones that have
 * consumptions. Worst case, like the dashboard: the max is held against what was eaten at most (value + Δ), the
 * min against what was eaten at least (value − Δ, ≥ 0).
 * Days without any, or without a calorie target, don't count (so less than a week of data only corrects what's
 * there). For each bound, with N earlier days: (bound' + their worst-case total) / (N + 1) = that bound averaged over those
 * days and `day` (each bound over the days that set it, as in `averageTargets`).
 * Each bound moves on its own, by at most WEEKLY_CAP, never below 0.
 * Returns {range, shift: {min, max}, days, capped: {min, max}}, or null when `day` has no calorie target;
 * `shift` and `capped` only have the bounds `day`'s target has.
 */
export function weeklyCorrection(targets, day, dayStart, eaten, key = 'energy') {
  const has = (d) => {
    const r = targetForDay(targets, d, dayStart)?.values?.[key]
    return Number.isFinite(r?.min) || Number.isFinite(r?.max)
  }
  if (!has(day)) return null
  const target = targetForDay(targets, day, dayStart).values[key]
  const earlier = []
  const total = { min: 0, max: 0 }
  for (let i = 1; i <= 6; i++) {
    const d = addDays(day, -i)
    if (!(d in eaten) || !has(d)) continue
    earlier.push(d)
    const { value, delta } = eaten[d]
    const dd = Number.isFinite(delta) ? Math.abs(delta) : 0
    total.min += Math.max(0, value - dd)
    total.max += value + dd
  }
  const avg = averageTargets(targets, [day, ...earlier], dayStart)[key]
  const days = earlier.length
  const range = {}, shift = {}, capped = {}
  for (const k of ['min', 'max']) {
    if (!Number.isFinite(target[k])) continue
    const owed = (days + 1) * avg[k] - total[k] - target[k]
    shift[k] = Math.max(-WEEKLY_CAP, Math.min(WEEKLY_CAP, owed))
    capped[k] = shift[k] !== owed
    range[k] = Math.max(0, target[k] + shift[k])
  }
  return { range, shift, days, capped }
}
