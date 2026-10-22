import { db, getConfig } from './db'
import { addDays, dayBounds } from './time'
import { NUTRIENTS, calories, deltaFromInput } from './nutrients'
import { DEFAULT_ENTRY_ERROR, sampling } from './errors'
import { ciqualItems } from './external'
import { addProduct, addScaled, bounds, zero } from './stats'

// Built-in conversions to a base unit per dimension.
const BUILTIN = {
  g: ['mass', 1], kg: ['mass', 1000], mg: ['mass', 0.001], oz: ['mass', 28.349523125], lb: ['mass', 453.59237],
  ml: ['volume', 1], l: ['volume', 1000], cl: ['volume', 10], dl: ['volume', 100],
  tsp: ['volume', 4.92892], tbsp: ['volume', 14.7868], cup: ['volume', 236.588], 'fl oz': ['volume', 29.5735],
}

const norm = (u) => String(u ?? '').trim().toLowerCase()

// --- Amount intervals ----------------------------------------------------------
// Every amount may carry an error (amount ± Δ). For showing amounts as typed (and adding up a recipe's amount), they
// are carried as [nominal, low, high]. Nutrients use distributions instead (below).

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

// --- Nutrients as distributions ------------------------------------------------------------
// docs/notes/error-handling.md: each nutrient is {value, v, s} (stats.js), plus `missing` (some food in it has no
// value) and `estimated` (energy from the macros). Amounts keep their ± Δ as typed, read as a uniform error: σ = Δ/√3.

const uniformSd = (d) => (Math.abs(d) || 0) / Math.sqrt(3)

/** Relative variance of a unit conversion: its two sides' uniform errors. */
const unitRel2 = (c) => (uniformSd(c.fromDelta) / c.fromAmount) ** 2 + (uniformSd(c.toDelta) / c.toAmount) ** 2

/** [factor, relative variance] from `fromUnit` to `toUnit`, or [NaN, NaN]: unitFactor with the units' errors. */
export function unitFactorStat(fromUnit, toUnit, units = []) {
  const from = norm(fromUnit)
  const to = norm(toUnit)
  if (from === to) return [1, 0]
  const builtin = (a, b) => (BUILTIN[a] && BUILTIN[b] && BUILTIN[a][0] === BUILTIN[b][0] ? BUILTIN[a][1] / BUILTIN[b][1] : NaN)
  const direct = builtin(from, to)
  if (Number.isFinite(direct)) return [direct, 0]
  const hop = (a, b) => (a === b ? 1 : builtin(a, b))
  for (const c of units) {
    if (!(c.fromAmount > 0 && c.toAmount > 0)) continue
    const [a, b] = [norm(c.fromUnit), norm(c.toUnit)]
    let k = hop(from, a) * hop(b, to)
    if (Number.isFinite(k)) return [k * (c.toAmount / c.fromAmount), unitRel2(c)]
    k = hop(from, b) * hop(a, to)
    if (Number.isFinite(k)) return [k * (c.fromAmount / c.toAmount), unitRel2(c)]
  }
  return [NaN, NaN]
}

// Per base amount of a food without components: the label's values, drawn once per food (category CV) and read
// within its digits (uniform).
const baseCache = new WeakMap()
function baseNutrients(item) {
  let out = baseCache.get(item)
  if (out) return out
  out = {}
  for (const { key } of NUTRIENTS) {
    const n = item.nutrients?.[key]
    if (!n) continue
    if (!Number.isFinite(n.value)) { out[key] = { value: NaN, v: 0, s: {} }; continue }
    const [bias, cv] = sampling(item.category, key)
    const q = (1 + bias) * n.value
    const label = n.text ? uniformSd(deltaFromInput(n.text)) : 0
    // Every entry of a food is the same sample (same pack, same bakery, same cut): its error is shared.
    out[key] = { value: q, v: 0, s: { [`food:${item.id}`]: Math.sqrt((cv * q) ** 2 + label ** 2) } }
  }
  baseCache.set(item, out)
  return out
}

/**
 * Adds `nutrients` × F into `total`, F with mean `f` and variance `phi` (stats.js addProduct), plus this entry's own
 * relative error `rel` (its entry error), independent of every other entry.
 */
function addInto(total, nutrients, f, phi = 0, rel = 0) {
  if (!nutrients) return
  for (const { key } of NUTRIENTS) {
    // Unknown energy is estimated from macros per item, so one label without kcal doesn't zero it out.
    const n = key === 'energy' ? calories(nutrients) : nutrients[key]
    if (!n) continue
    const t = (total[key] ??= { ...zero(), missing: false })
    if (n.estimated) t.estimated = true
    if (Number.isFinite(n.value)) {
      addProduct(t, n, f, phi)
      t.v += (rel * n.value * f) ** 2
    } else t.missing = true
  }
}

/**
 * Load everything nutrient computation needs, once. `list` is the user's own foods; CIQUAL's are read-only foods
 * (external.js ciqualItems) that always resolve, so consumptions of them keep working, and are listed (`ciqual`)
 * only while the config includes them.
 */
export async function loadContext() {
  const [list, config] = await Promise.all([db.items.toArray(), getConfig()])
  const items = new Map(list.map((r) => [r.id, r]))
  let ciqual = []
  try {
    ciqual = await ciqualItems()
  } catch {
    // Not loaded (offline on first use): own foods only.
  }
  for (const it of ciqual) items.set(it.id, it)
  return { items, list, ciqual: config.ciqual ? ciqual : [] }
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
 * Nutrients for `amount ± amountDelta unit` of item `id`. Items with components get them inferred from the
 * components; otherwise their own nutrients are used, with entry error `rel` (a consumption's) or else the default.
 * Returns { nutrients: {key: {value, v, s, missing}}, ok } where ok=false means a unit couldn't be converted
 * or an item is missing.
 */
export function nutrientsFor(ctx, id, amount, unit, amountDelta = 0, seen = new Set(), rel = undefined) {
  const out = { nutrients: {}, ok: true }
  const item = resolve(ctx, id)
  if (!item || seen.has(id)) return { ...out, ok: false }

  // F = amount · (base units per unit) / base amount. A recipe's base amount counts as exact (q̂ = w/P).
  const [baseAmt, baseUnit, baseDelta] = baseAmount(item)
  const [g, gRel2] = unitFactorStat(unit, baseUnit, item.units)
  if (!Number.isFinite(g)) return { ...out, ok: false }
  const own = !item.components?.length
  const f = (amount * g) / baseAmt
  const phi = (uniformSd(amountDelta) * g / baseAmt) ** 2 + f * f * (gRel2 + (own ? (uniformSd(baseDelta) / baseAmt) ** 2 : 0))
  if (!Number.isFinite(f)) return { ...out, ok: false }

  if (own) {
    addInto(out.nutrients, baseNutrients(item), f, phi, Number.isFinite(rel) ? rel : DEFAULT_ENTRY_ERROR)
    return out
  }
  const whole = recipeNutrients(ctx, item, new Set(seen).add(id))
  if (!whole.ok) out.ok = false
  addInto(out.nutrients, whole.nutrients, f, phi)
  for (const k in whole.nutrients) if (whole.nutrients[k].missing) out.nutrients[k].missing = true
  return out
}

/**
 * All of a recipe: its components, each an entry of its own (variances add). A concoction is one sample: every
 * portion of it shares all of that, so it becomes its shared deviation (stats.js `s`, keyed by the concoction).
 */
function recipeNutrients(ctx, item, seen) {
  const out = { nutrients: {}, ok: true }
  for (const c of item.components) {
    const sub = nutrientsFor(ctx, c.itemId, c.amount, c.unit, c.amountDelta, seen, c.entryError)
    if (!sub.ok) out.ok = false
    addInto(out.nutrients, sub.nutrients, 1)
    for (const k in sub.nutrients) if (sub.nutrients[k].missing) out.nutrients[k].missing = true
  }
  if (item.madeAt) {
    const key = `concoction:${item.id}`
    for (const t of Object.values(out.nutrients)) {
      t.s[key] = Math.sqrt(t.v + (t.s[key] ?? 0) ** 2)
      t.v = 0
    }
  }
  return out
}

/**
 * Entry error to start a new consumption or component of food `itemId` with: that of its latest consumption (in any
 * user's `logs`), else of a component of it in a recipe, else the default.
 */
export function lastEntryError(ctx, logs, itemId) {
  let last = null
  for (const l of logs ?? []) if (l.itemId === itemId && (!last || l.datetime > last.datetime)) last = l
  if (last) return Number.isFinite(last.entryError) ? last.entryError : DEFAULT_ENTRY_ERROR
  const c = ctx.list.flatMap((it) => it.components ?? []).find((c) => c.itemId === itemId && Number.isFinite(c.entryError))
  return c ? c.entryError : DEFAULT_ENTRY_ERROR
}

/** Nutrients of a consumption, `amount ± amountDelta unit`, with its own entry error if it has one. */
export function consumptionNutrients(ctx, { itemId, amount, unit, amountDelta, entryError }) {
  return nutrientsFor(ctx, itemId, amount, unit, amountDelta, undefined, entryError)
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

/** `total` from sumNutrients, divided by `n` days (value and deviations alike). */
export function perDay(total, n) {
  const out = {}
  for (const k in total) out[k] = addScaled({ ...total[k], ...zero() }, total[k], 1 / n)
  return out
}

/**
 * Progress-bar geometry for nutrient `n` ({value, v, s}) against {min?, max?}, in % of the bar's width.
 * With a max, the max sits at 80% (and the min proportionally); with only a min, the min sits at 50%.
 * The fill clips at 100%. `errLo`/`errHi` place the value's interval (stats.js bounds) on the same scale.
 */
export function targetBar(n, { min, max } = {}) {
  const hasMin = Number.isFinite(min)
  const hasMax = Number.isFinite(max)
  if (!hasMin && !hasMax) return null
  const value = n.value
  const full = hasMax ? (max > 0 ? max / 0.8 : 1) : min > 0 ? min / 0.5 : 1
  const pos = (x) => Math.min(100, Math.max(0, (x / full) * 100))
  // design.md: "ok" only if the whole interval is within the range. If it spills over both bounds, the side the
  // value itself leans to wins.
  const [lo, hi] = bounds(n)
  const low = hasMin && lo < min
  const high = hasMax && hi > max
  const status = low && high ? (value - min < max - value ? 'under' : 'over') : low ? 'under' : high ? 'over' : 'ok'
  return {
    fill: pos(value), minAt: hasMin ? pos(min) : null, maxAt: hasMax ? pos(max) : null, status,
    errLo: hi > lo ? pos(lo) : null, errHi: hi > lo ? pos(hi) : null,
  }
}

// --- Weekly calorie correction ------------------------------------------------
// The daily calorie goal moves to make up for the days before it: the range shown for `day` is the one `day` must
// land in for the 7-day per-day average (the 6 days before `day`, plus `day`) to be within the target, capped.

export const WEEKLY_CAP = 500 // kcal

/**
 * The calorie target for `day`, set so that eating within it puts the 7-day per-day average within the target.
 * The earlier days are the 6 before `day`; `eaten` is {day: kcal ({value, v, s})} for the ones that have
 * consumptions. Like the dashboard, with the earlier days' total as an interval: the max is held against its high
 * end, the min against its low end.
 * Days without any, or without a calorie target, don't count (so less than a week of data only corrects what's
 * there). For each bound, with N earlier days: (bound' + their total) / (N + 1) = that bound averaged over those
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
  const sum = zero()
  for (let i = 1; i <= 6; i++) {
    const d = addDays(day, -i)
    if (!(d in eaten) || !has(d)) continue
    earlier.push(d)
    addScaled(sum, eaten[d])
  }
  const [lo, hi] = bounds(sum)
  const total = { min: Math.max(0, lo), max: hi }
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
