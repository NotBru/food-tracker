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
 * The macros' places on a ring with these shares (ringShares' `shares`): [{a, b, key, core}] in turns (a may be < 0,
 * across the top). Each restricted macro's min (`core`), and its max when it has one, centred on its place: the
 * first macro on top, the second at the bottom, the third, when all three have targets, halfway between the other
 * two's cores, half on each side.
 */
function ringIntervals(shares) {
  const [A, B, C] = shares
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
  return iv
}

/**
 * The ring at `kcal`, as arcs covering the whole turn: [{from, to, kind, key, dim}], from < to, in turns from the top.
 * `ring`: its shares (ringShares, or guideToMin's between the eaten ring and the calorie min).
 * `dim`: the ring is outside the calorie target (drawn faded: the macros' split still shows, to plan by).
 * kind: 'out' (deep blue: no split fits the macros' targets), 'free' (green: no macro target says anything
 * here), 'core' (a macro's minimum: its colour), 'flank' (from its minimum out to its maximum, half on each side:
 * brighter), 'shared' (two macros' flanks overlap: grey). A minimum always wins over another macro's flank (that
 * macro can't reach it).
 */
export function ringSegments(model, kcal, ring = ringShares(model, kcal)) {
  if (ring.out) return [{ from: 0, to: 1, kind: 'out', key: null, dim: false }]
  const dim = !!ring.calories
  const iv = ringIntervals(ring.shares)
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
 * The edges of the macros' targets on the calorie target's lowest ring (its min, else its max), in turns: each
 * restricted macro's min and max there (two per macro on the pie, mirrored). Drawn as dashed radial lines from 0 kcal
 * up to that ring: those splits, eaten in proportion. [] without a calorie target or when the macros can't fit there.
 */
export function targetEdges(model) {
  const { min, max } = model.energy
  const kcal = has(min) && min > 0 ? min : has(max) && max > 0 ? max : NaN
  if (!has(kcal)) return { kcal, edges: [] }
  const ring = ringShares(model, kcal)
  if (ring.out) return { kcal, edges: [] }
  const edges = [...new Set(ringIntervals(ring.shares).flatMap((x) => [mod1(x.a), mod1(x.b)]))]
  return { kcal, edges }
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
export function ringText(model, kcal, ring = ringShares(model, kcal)) {
  if (ring.out) return "the macros' targets can't all be met"
  const span = (x) => (x.hi - x.lo < 0.005 ? pct(x.lo) : x.lo < 0.005 ? `≤ ${pct(x.hi)}` : x.hi > 0.995 ? `≥ ${pct(x.lo)}` : `${pct(x.lo)}–${pct(x.hi)}`)
  const parts = ring.shares.filter((x) => x.restricted).map((x) => `${x.m.label} ${span(x)}`)
  const calories = ring.calories === 'under' ? 'below the calorie min' : ring.calories === 'over' ? 'above the calorie max' : null
  return [calories, ...(parts.length || !calories ? [parts.length ? parts.join(' · ') : 'any split'] : [])].filter(Boolean).join(' · ')
}

// --- What was eaten, through the window ------------------------------------------------------------------------
// Inside the eaten ring, each ring is the macros' split once that many kcal had been eaten (dashboard.js
// eatingSteps), in the eaten ring's places. Outside it up to the calorie min, each restricted macro's room fans out
// from its share eaten now to its min and max at the min (guideToMin).

const gramsOf = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { value: v }]))

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

/**
 * Between the eaten ring and the calorie min, each restricted macro's room as a guide to the min: from its share eaten
 * now (at the eaten ring) out to its min and its max allowed at the min, each straight in grams (eating the rest at
 * one mix, its share of the energy from then on fixed). (kcal) → ringShares-like {calories: 'under', shares}, for
 * eaten ≤ kcal < min; null without a min, past it, with nothing eaten, or when the macros can't fit at the min. A
 * macro already past its min (or max) at the min stays at what it is (nothing eaten can be taken back).
 */
export function guideToMin(model, total, eaten) {
  const min = model.energy.min
  const split = energySplit(total)
  if (!has(min) || !(eaten > 0) || eaten >= min || !(split.total > 0)) return null
  const atMin = ringShares(model, min)
  if (atMin.out) return null
  // In kcal of each macro, scaled to the ring's calories (registered energy can differ from the macros' sum).
  const now = Object.fromEntries(split.macros.map((m) => [m.key, (m.kcal / split.total) * eaten]))
  const ends = atMin.shares.map((x) => {
    const e0 = now[x.m.key] ?? 0
    return { e0, lo: Math.max(e0, x.lo * min), hi: Math.max(e0, x.hi * min) }
  })
  return (kcal) => {
    const k = Math.min(min, Math.max(eaten, kcal))
    const t = (k - eaten) / (min - eaten)
    const share = (e0, e1) => Math.min(1, (e0 + t * (e1 - e0)) / k)
    return {
      calories: 'under',
      shares: atMin.shares.map((x, i) => ({ ...x, lo: share(ends[i].e0, ends[i].lo), hi: share(ends[i].e0, ends[i].hi) })),
    }
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
