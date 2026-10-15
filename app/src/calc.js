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

/**
 * Factor f such that `amount fromUnit` = `amount * f toUnit`, or NaN if unknown.
 * Uses built-ins, then the food's own units ([{fromAmount, fromUnit, toAmount, toUnit}], e.g. 1 slice = 30 g),
 * chained through at most one built-in hop on either side (e.g. 1 slice -> 30 g -> 0.03 kg).
 */
export function unitFactor(fromUnit, toUnit, units = []) {
  const from = norm(fromUnit)
  const to = norm(toUnit)
  if (from === to) return 1
  const builtin = (a, b) => (BUILTIN[a] && BUILTIN[b] && BUILTIN[a][0] === BUILTIN[b][0] ? BUILTIN[a][1] / BUILTIN[b][1] : NaN)
  const direct = builtin(from, to)
  if (Number.isFinite(direct)) return direct

  // Edges from the food's units, both directions.
  const edges = []
  for (const c of units) {
    if (!(c.fromAmount > 0 && c.toAmount > 0)) continue
    edges.push([norm(c.fromUnit), norm(c.toUnit), c.toAmount / c.fromAmount])
    edges.push([norm(c.toUnit), norm(c.fromUnit), c.fromAmount / c.toAmount])
  }
  const hop = (a, b) => (a === b ? 1 : builtin(a, b))
  for (const [a, b, f] of edges) {
    const r = hop(from, a) * f * hop(b, to)
    if (Number.isFinite(r)) return r
  }
  return NaN
}

function addInto(total, nutrients, factor) {
  if (!nutrients) return
  for (const { key } of NUTRIENTS) {
    // Unknown energy is estimated from macros per item, so one label without kcal doesn't zero it out.
    const n = key === 'energy' ? calories(nutrients) : nutrients[key]
    if (!n) continue
    const t = (total[key] ??= { value: 0, delta: 0, missing: false })
    if (n.estimated) t.estimated = true
    if (Number.isFinite(n.value)) {
      t.value += n.value * factor
      t.delta += (Number.isFinite(n.delta) ? n.delta : 0) * Math.abs(factor)
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

/** Amount and unit an item's nutrients refer to. Without one it counts as 1 portion (the whole thing). */
export function baseAmount(item) {
  if (item.amount > 0 && item.unit) return [item.amount, item.unit]
  return [1, 'portion']
}

/**
 * Nutrients for `amount unit` of item `id`. Items with components get them inferred from the components;
 * otherwise their own nutrients are used.
 * Returns { nutrients: {key: {value, delta, missing}}, ok } where ok=false means a unit couldn't be converted
 * or an item is missing.
 */
export function nutrientsFor(ctx, id, amount, unit, seen = new Set()) {
  const out = { nutrients: {}, ok: true }
  const item = resolve(ctx, id)
  if (!item || seen.has(id)) return { ...out, ok: false }

  const [baseAmt, baseUnit] = baseAmount(item)
  const factor = (amount * unitFactor(unit, baseUnit, item.units)) / baseAmt
  if (!Number.isFinite(factor)) return { ...out, ok: false }

  if (!item.components?.length) {
    addInto(out.nutrients, item.nutrients, factor)
    return out
  }
  const nextSeen = new Set(seen).add(id)
  for (const c of item.components) {
    const sub = nutrientsFor(ctx, c.itemId, c.amount, c.unit, nextSeen)
    if (!sub.ok) out.ok = false
    addInto(out.nutrients, sub.nutrients, factor)
    for (const k in sub.nutrients) if (sub.nutrients[k].missing) out.nutrients[k].missing = true
  }
  return out
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
 * The fill clips at 100%.
 */
export function targetBar(value, { min, max } = {}) {
  const hasMin = Number.isFinite(min)
  const hasMax = Number.isFinite(max)
  if (!hasMin && !hasMax) return null
  const full = hasMax ? (max > 0 ? max / 0.8 : 1) : min > 0 ? min / 0.5 : 1
  const pos = (x) => Math.min(100, Math.max(0, (x / full) * 100))
  const status = hasMin && value < min ? 'under' : hasMax && value > max ? 'over' : 'ok'
  return { fill: pos(value), minAt: hasMin ? pos(min) : null, maxAt: hasMax ? pos(max) : null, status }
}
