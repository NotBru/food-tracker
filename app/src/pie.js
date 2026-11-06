// Dashboard style "pie" (screens/Home.jsx PieDash): the radius is calories (0 in the centre), and each ring, the
// circle at one total, is split by angle into the shares of that energy the macros may take, from their targets:
// kcal = 4·protein + 9·fat + 4·carbs, so a target of grams is a share that shrinks as the ring grows (4·min / kcal).
// Angles are in turns, clockwise from the top. Kept free of the DOM so the Android app can port it.
import { energySplit } from './energy'
import { bounds } from './stats'

export const PIE_MACROS = [
  { key: 'proteins', label: 'Protein', tone: 'prot', kcal: 4 },
  { key: 'fat', label: 'Fat', tone: 'fat', kcal: 9 },
  { key: 'carbohydrates', label: 'Carbs', tone: 'carb', kcal: 4 },
]
const has = Number.isFinite
const EPS = 1e-9

/**
 * The macros in their places: the restricted ones (a min or a max) first, in PIE_MACROS order, then the others.
 * The first is centred at the top, the second at the bottom, the third split in two, one half on each side.
 */
export function pieModel(targets = {}) {
  const restricted = PIE_MACROS.filter((m) => has(targets[m.key]?.min) || has(targets[m.key]?.max))
  return { targets, energy: targets.energy ?? {}, restricted, order: [...restricted, ...PIE_MACROS.filter((m) => !restricted.includes(m))] }
}

/**
 * The calories at the pie's edge: like a bar's scale (calc.js barScale), the max (or the eaten interval's top) at
 * 80%, a lone min at 50%; also room for the macros' minimums (their kcal at 50%). Never 0.
 */
export function pieFull(model, val) {
  const { min, max } = model.energy
  const top = val ? bounds(val)[1] : NaN
  const mins = model.restricted.reduce((s, m) => s + (has(model.targets[m.key].min) ? m.kcal * model.targets[m.key].min : 0), 0)
  return Math.max(has(max) ? max / 0.8 : 0, has(min) ? min / 0.5 : 0, has(top) ? top / 0.8 : 0, mins / 0.5) || 2500
}

/**
 * The share of energy (0–1) each macro may take on the ring at `kcal`: {shares: [{m, lo, hi, hasMax, restricted}],
 * calories}, the shares in the model's order, each range narrowed by what the others leave (protein ≤ 1 − fat's min −
 * carbs' min, and so on); `calories` 'under' / 'over' when the ring is below the calorie min / above the max (the
 * shares still hold, for planning; below the min, the min's), else null. {out: true} when the macros' targets can't fit (their minimums over
 * 100%, a min over its max, or all three maxes under 100%).
 */
export function ringShares(model, kcal) {
  const { min, max } = model.energy
  // Below the calorie min: the split the min's ring allows, at every radius (radial lines from the centre): eating
  // less in the same proportions as a plan that meets the targets once the min is reached.
  if (has(min) && min > 0 && kcal < min) {
    const atMin = ringShares(model, min)
    return atMin.out ? atMin : { ...atMin, calories: 'under' }
  }
  if (!(kcal > 0)) return { out: true }
  const calories = has(min) && kcal < min ? 'under' : has(max) && kcal > max ? 'over' : null
  const s = model.order.map((m) => {
    const r = model.targets[m.key] ?? {}
    const restricted = model.restricted.includes(m)
    return {
      m, restricted, hasMax: restricted && has(r.max),
      lo: restricted && has(r.min) ? (m.kcal * r.min) / kcal : 0,
      hi: restricted && has(r.max) ? Math.min(1, (m.kcal * r.max) / kcal) : 1,
    }
  })
  const sumLo = s.reduce((a, x) => a + x.lo, 0)
  const sumHi = s.reduce((a, x) => a + x.hi, 0)
  if (sumLo > 1 + EPS || sumHi < 1 - EPS || s.some((x) => x.lo > x.hi + EPS)) return { out: true }
  return { calories, shares: s.map((x) => ({ ...x, lo: Math.max(x.lo, 1 - (sumHi - x.hi)), hi: Math.min(x.hi, 1 - (sumLo - x.lo)) })) }
}

const mod1 = (x) => ((x % 1) + 1) % 1
const covers = (iv, t) => iv.b - iv.a >= 1 - EPS || mod1(t - iv.a) < iv.b - iv.a

/**
 * The ring at `kcal`, as arcs covering the whole turn: [{from, to, kind, key, dim}], from < to, in turns from the top.
 * `dim`: the ring is outside the calorie target (drawn faded: the macros' split still shows, to plan by).
 * kind: 'out' (deep blue: no split fits the macros' targets), 'free' (green: no macro target says anything
 * here), 'core' (a macro's minimum: its colour), 'flank' (from its minimum out to its maximum, half on each side:
 * brighter), 'shared' (two macros' flanks overlap: grey). A minimum always wins over another macro's flank (that
 * macro can't reach it). The third macro, when all three have targets, sits halfway between the other two's cores.
 */
export function ringSegments(model, kcal) {
  const ring = ringShares(model, kcal)
  if (ring.out) return [{ from: 0, to: 1, kind: 'out', key: null, dim: false }]
  const dim = !!ring.calories
  const [A, B, C] = ring.shares
  const iv = []
  const put = (c, w, x, core) => w > EPS && iv.push({ a: c - w / 2, b: c + w / 2, key: x.m.key, core })
  const place = (x, centres, part) => {
    if (!x?.restricted) return
    for (const c of centres) {
      put(c, x.lo * part, x, true)
      if (x.hasMax) put(c, x.hi * part, x, false)
    }
  }
  place(A, [0], 1)
  place(B, [0.5], 1)
  if (C?.restricted) {
    const m = (A.lo / 2 + 0.5 - B.lo / 2) / 2
    place(C, [m, 1 - m], 0.5)
  }
  const cuts = [...new Set([0, ...iv.flatMap((x) => [mod1(x.a), mod1(x.b)])])].sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < cuts.length; i++) {
    const from = cuts[i]
    const to = cuts[i + 1] ?? 1
    if (to - from < EPS) continue
    const t = (from + to) / 2
    const core = iv.find((x) => x.core && covers(x, t))
    const keys = new Set(iv.filter((x) => !x.core && covers(x, t)).map((x) => x.key))
    const seg = core ? { kind: 'core', key: core.key } : keys.size === 0 ? { kind: 'free', key: null }
      : keys.size === 1 ? { kind: 'flank', key: [...keys][0] } : { kind: 'shared', key: null }
    const last = out[out.length - 1]
    if (last && last.kind === seg.kind && last.key === seg.key) last.to = to
    else out.push({ from, to, ...seg, dim })
  }
  return out
}

/**
 * What was eaten, as arcs of one ring, in the same places as the targets: [{from, to, key, tone}] (from may be < 0,
 * across the top). Shares of the energy from the macros' grams (energy.js: 4/9/4, alcohol 7, which goes beside the
 * third macro on the sides). Empty when nothing with energy was eaten.
 */
export function eatenArcs(model, total) {
  const split = energySplit(total)
  if (!(split.total > 0)) return []
  const f = Object.fromEntries(split.macros.map((m) => [m.key, m.kcal / split.total]))
  const [A, B, C] = model.order
  const a = f[A.key] ?? 0
  const b = f[B.key] ?? 0
  const c = f[C.key] ?? 0
  const alc = f.alcohol ?? 0
  const arcs = [
    { from: -a / 2, to: a / 2, key: A.key, tone: A.tone },
    { from: 0.5 - b / 2, to: 0.5 + b / 2, key: B.key, tone: B.tone },
    // Right side, from the first macro down; left side, mirrored.
    { from: a / 2, to: a / 2 + c / 2, key: C.key, tone: C.tone },
    { from: a / 2 + c / 2, to: 0.5 - b / 2, key: 'alcohol', tone: 'muted' },
    { from: 0.5 + b / 2, to: 1 - a / 2 - c / 2, key: 'alcohol', tone: 'muted' },
    { from: 1 - a / 2 - c / 2, to: 1 - a / 2, key: C.key, tone: C.tone },
  ]
  return arcs.filter((x) => x.to - x.from > EPS && (x.key !== 'alcohol' || alc > 0))
}

const pct = (x) => `${Math.round(x * 100)}%`

/** One line on the ring at `kcal`: "Protein 19–29% · Fat 20–35%", or why no split is allowed there. */
export function ringText(model, kcal) {
  const ring = ringShares(model, kcal)
  if (ring.out) return "the macros' targets can't all be met"
  const span = (x) => (x.hi - x.lo < 0.005 ? pct(x.lo) : x.lo < 0.005 ? `≤ ${pct(x.hi)}` : x.hi > 0.995 ? `≥ ${pct(x.lo)}` : `${pct(x.lo)}–${pct(x.hi)}`)
  const parts = ring.shares.filter((x) => x.restricted).map((x) => `${x.m.label} ${span(x)}`)
  const calories = ring.calories === 'under' ? 'below the calorie min' : ring.calories === 'over' ? 'above the calorie max' : null
  return [calories, ...(parts.length || !calories ? [parts.length ? parts.join(' · ') : 'any split'] : [])].filter(Boolean).join(' · ')
}

// --- What was eaten, through the window ------------------------------------------------------------------------
// Inside the eaten ring, each ring is the macros' split once that many kcal had been eaten (dashboard.js
// eatingSteps), in the eaten ring's places; dashed radial lines carry the split eaten now from the centre to the
// ring. Outside it, dashed curves carry each edge on to the calorie min along the straight path in grams: the rest
// of the min eaten at one mix, arriving at the split allowed there nearest to the one eaten now.

const KCAL = { proteins: 4, fat: 9, carbohydrates: 4, alcohol: 7 }
const gramsOf = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { value: v }]))
const kcalOf = (g) => Object.entries(KCAL).reduce((s, [k, f]) => s + f * (g[k] ?? 0), 0)

/** The macros' grams (as nutrients, for eatenArcs) once `kcal` had been eaten, along `steps`, scaled so the last step
 * reaches `eaten` (the calories eaten, the ring's radius). Within a consumption, its grams come in evenly. */
export function eatenAt(steps, eaten, kcal) {
  const last = steps[steps.length - 1]
  if (!(last?.kcal > 0) || !(eaten > 0)) return null
  const k = (Math.max(kcal, 1e-6) / eaten) * last.kcal
  const i = steps.findIndex((s) => s.kcal >= k)
  if (i < 0) return gramsOf(last.g)
  const a = steps[Math.max(0, i - 1)]
  const b = steps[i]
  const t = b.kcal > a.kcal ? (k - a.kcal) / (b.kcal - a.kcal) : 1
  return gramsOf(Object.fromEntries(Object.keys(b.g).map((m) => [m, a.g[m] + t * (b.g[m] - a.g[m])])))
}

/** The edges between the eaten arcs (eatenArcs), in turns, always in the same order (so a path's edges can be
 * followed from ring to ring); the alcohol's two only with `alcohol`. */
export function eatenEdges(model, n, alcohol) {
  const split = energySplit(n)
  if (!(split.total > 0)) return []
  const f = Object.fromEntries(split.macros.map((m) => [m.key, m.kcal / split.total]))
  const [A, B, C] = model.order
  const a = f[A.key] ?? 0
  const b = f[B.key] ?? 0
  const c = f[C.key] ?? 0
  return alcohol
    ? [a / 2, a / 2 + c / 2, 0.5 - b / 2, 0.5 + b / 2, 1 - a / 2 - c / 2, 1 - a / 2]
    : [a / 2, a / 2 + c / 2, 0.5 + b / 2, 1 - a / 2]
}

/**
 * The straight path in grams from what was eaten (`total`, `eaten` kcal) to the calorie min: (kcal) → grams as
 * nutrients, for eaten ≤ kcal ≤ min; null without a min, with the min reached, or when no split allowed at the min can
 * be reached (more of a macro already eaten than its max there, or the macros' targets can't fit). At the min, each
 * macro's share is the one eaten now, moved as little as the targets ask (nearest allowed split); no more alcohol.
 */
export function pathToMin(model, total, eaten) {
  const min = model.energy.min
  const split = energySplit(total)
  if (!has(min) || !(eaten > 0) || eaten >= min || !(split.total > 0)) return null
  const ring = ringShares(model, min)
  if (ring.out) return null
  const g0 = Object.fromEntries(Object.keys(KCAL).map((k) => [k, Math.max(0, total[k]?.value || 0)]))
  const k0 = kcalOf(g0)
  const budget = 1 - (KCAL.alcohol * g0.alcohol) / min
  // Shares at the min: within the targets, never less than what's already eaten.
  const xs = ring.shares.map((x) => {
    const lo = Math.max(x.lo, (x.m.kcal * g0[x.m.key]) / min)
    return { key: x.m.key, f: (x.m.kcal * g0[x.m.key]) / k0, lo, hi: Math.max(x.hi, lo) }
  })
  const sumAt = (l) => xs.reduce((s, x) => s + Math.min(x.hi, Math.max(x.lo, x.f + l)), 0)
  if (xs.reduce((s, x) => s + x.lo, 0) > budget + EPS || xs.reduce((s, x) => s + x.hi, 0) < budget - EPS) return null
  // The nearest split: each share moved by the same amount, clamped to its bounds, so that they add up.
  let lo = -1
  let hi = 1
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (sumAt(mid) < budget) lo = mid
    else hi = mid
  }
  const g1 = { ...g0, ...Object.fromEntries(xs.map((x) => [x.key, (Math.min(x.hi, Math.max(x.lo, x.f + lo)) * min) / KCAL[x.key]])) }
  return (kcal) => {
    const t = Math.min(1, Math.max(0, (kcal - eaten) / (min - eaten)))
    return gramsOf(Object.fromEntries(Object.keys(g0).map((k) => [k, g0[k] + t * (g1[k] - g0[k])])))
  }
}

/** The macros' shares of `n`'s energy as a line: "Protein 30% · Fat 25% · Carbs 45%". */
export function sharesText(n) {
  const split = energySplit(n)
  if (!(split.total > 0)) return ''
  const label = (key) => PIE_MACROS.find((m) => m.key === key)?.label ?? 'Alcohol'
  const rank = (key) => (i => (i < 0 ? 9 : i))(PIE_MACROS.findIndex((m) => m.key === key))
  return split.macros.filter((m) => m.kcal > 0).sort((a, b) => rank(a.key) - rank(b.key))
    .map((m) => `${label(m.key)} ${pct(m.kcal / split.total)}`).join(' · ')
}
