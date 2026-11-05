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
 * The share of energy (0–1) each macro may take on the ring at `kcal`: [{m, lo, hi, hasMax, restricted}] in the
 * model's order, each range narrowed by what the others leave (protein ≤ 1 − fat's min − carbs' min, and so on).
 * {out: 'under' | 'over' | 'none'} when no split works: below the calorie min, above the max, or the macros' targets
 * can't fit (their minimums over 100%, a min over its max, or all three maxes under 100%).
 */
export function ringShares(model, kcal) {
  const { min, max } = model.energy
  if (has(min) && kcal < min) return { out: 'under' }
  if (has(max) && kcal > max) return { out: 'over' }
  if (!(kcal > 0)) return { out: 'none' }
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
  if (sumLo > 1 + EPS || sumHi < 1 - EPS || s.some((x) => x.lo > x.hi + EPS)) return { out: 'none' }
  return { shares: s.map((x) => ({ ...x, lo: Math.max(x.lo, 1 - (sumHi - x.hi)), hi: Math.min(x.hi, 1 - (sumLo - x.lo)) })) }
}

const mod1 = (x) => ((x % 1) + 1) % 1
const covers = (iv, t) => iv.b - iv.a >= 1 - EPS || mod1(t - iv.a) < iv.b - iv.a

/**
 * The ring at `kcal`, as arcs covering the whole turn: [{from, to, kind, key}], from < to, in turns from the top.
 * kind: 'out' (red: outside the calorie target, or no split fits), 'free' (green: no macro target says anything
 * here), 'core' (a macro's minimum: its colour), 'flank' (from its minimum out to its maximum, half on each side:
 * brighter), 'shared' (two macros' flanks overlap: grey). A minimum always wins over another macro's flank (that
 * macro can't reach it). The third macro, when all three have targets, sits halfway between the other two's cores.
 */
export function ringSegments(model, kcal) {
  const ring = ringShares(model, kcal)
  if (ring.out) return [{ from: 0, to: 1, kind: 'out', key: ring.out }]
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
    else out.push({ from, to, ...seg })
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

/** One line on the ring at `kcal`: "Protein 19–29% · Fat 20–35%", or why it's red. */
export function ringText(model, kcal) {
  const ring = ringShares(model, kcal)
  if (ring.out === 'under') return 'below the calorie min'
  if (ring.out === 'over') return 'above the calorie max'
  if (ring.out) return "the macros' targets can't all be met"
  const span = (x) => (x.hi - x.lo < 0.005 ? pct(x.lo) : x.lo < 0.005 ? `≤ ${pct(x.hi)}` : x.hi > 0.995 ? `≥ ${pct(x.lo)}` : `${pct(x.lo)}–${pct(x.hi)}`)
  const parts = ring.shares.filter((x) => x.restricted).map((x) => `${x.m.label} ${span(x)}`)
  return parts.length ? parts.join(' · ') : 'any split'
}
