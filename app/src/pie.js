// Dashboard style "pie" (screens/Home.jsx PieDash): the radius is calories (0 in the centre), and each ring, the
// circle at one total, is split by angle into the shares of that energy the macros may take, from their targets:
// kcal = 4·protein + 9·fat + 4·carbs, so a target of grams is a share that shrinks as the ring grows (4·min / kcal).
// Angles are in turns, clockwise from the top. Kept free of the DOM so the Android app can port it.
import { energySplit } from './energy'
import { calories, fmt } from './nutrients'
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
function ringIntervals(shares, keepEmpty = false) {
  const [A, B, C] = shares
  const iv = []
  // keepEmpty: zero-width ones too, so the list is the same on every ring (targetCurves follows each one's edges).
  const put = (c, w, x, core) => (keepEmpty || w > EPS) && iv.push({ a: c - w / 2, b: c + w / 2, key: x.m.key, core })
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
 * The edges of the macros' targets (each restricted macro's min and max, as on ringSegments) from the ring at `k0` up
 * to the one at `k1`, as curves: [[{kcal, t} | null]], one per edge, t in turns; null where the edge isn't there (no
 * split fits, or that min or max is 0 wide). Drawn dashed over the eaten history, from the calorie min up to the
 * calories eaten (or the max): the target zone the eaten ring has gone past.
 */
export function targetCurves(model, k0, k1, n = 64) {
  if (!(k1 > k0)) return []
  const curves = []
  for (let j = 0; j <= n; j++) {
    const kcal = k0 + ((k1 - k0) * j) / n
    const ring = ringShares(model, kcal)
    const iv = ring.out ? [] : ringIntervals(ring.shares, true)
    iv.forEach((x, i) => {
      const wide = x.b - x.a > EPS
      for (const [e, t] of [[2 * i, x.a], [2 * i + 1, x.b]]) (curves[e] ??= Array(j).fill(null)).push(wide ? { kcal, t: mod1(t) } : null)
    })
    for (const c of curves) if (c.length < j + 1) c.push(null)
  }
  return curves
}

/**
 * Each macro's share of the energy eaten from its least to its most likely amount (the ends of its grams' interval),
 * the other macros kept at their means: {key: [lo, hi]}. Shares as eatenArcs' (of the macros' summed kcal).
 */
export function eatenShareRanges(total) {
  const split = energySplit(total)
  if (!(split.total > 0)) return {}
  return Object.fromEntries(split.macros.map((m) => {
    const rest = split.total - m.kcal
    const share = (k) => (k + rest > 0 ? k / (k + rest) : 0)
    const [lo, hi] = bounds(m.kcalN)
    return [m.key, [share(lo), share(hi)]]
  }))
}

/**
 * Error bars of the eaten split, in the eaten arcs' places: [{from, to, key}] in turns, each macro's share range
 * (eatenShareRanges) at its arc's moving edge(s): the first and second macros' both edges (they grow from their
 * centres, top and bottom), the third's edge away from the first (it grows from the first's edge, on each side).
 * `lane`: which part of the ring's width (below).
 */
export function eatenErrorBars(model, total) {
  const split = energySplit(total)
  if (!(split.total > 0)) return []
  const ranges = eatenShareRanges(total)
  const [A, B, C] = model.order
  const a = (split.macros.find((m) => m.key === A.key)?.kcal ?? 0) / split.total
  const out = []
  const both = (key, c, sign) => {
    const r = ranges[key]
    if (!r || r[1] - r[0] < 1e-3) return
    out.push({ from: c + (sign * r[0]) / 2, to: c + (sign * r[1]) / 2, key }, { from: c - (sign * r[1]) / 2, to: c - (sign * r[0]) / 2, key })
  }
  both(A.key, 0, 1)
  both(B.key, 0.5, 1)
  const r = ranges[C.key]
  if (r && r[1] - r[0] >= 1e-3) out.push({ from: a / 2 + r[0] / 2, to: a / 2 + r[1] / 2, key: C.key }, { from: 1 - a / 2 - r[1] / 2, to: 1 - a / 2 - r[0] / 2, key: C.key })
  // Lanes across the ring's width: 0 all of it; where the third macro's bar overlaps another's (it shares an edge
  // with the second when there's no alcohol), the third takes the outer half (1) and the other the inner one (−1).
  const bars = out.map((x) => ({ ...(x.from > x.to ? { ...x, from: x.to, to: x.from } : x), lane: 0 }))
  for (const c of bars.filter((x) => x.key === C.key)) {
    for (const o of bars.filter((x) => x.key !== C.key && x.from < c.to && c.from < x.to)) {
      o.lane = -1
      c.lane = 1
    }
  }
  return bars
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
 * now (at the eaten ring) out to its min and its max allowed at the min, each share linear in kcal (straight lines
 * in the square). (kcal) → ringShares-like {calories: 'under', shares}, for
 * eaten ≤ kcal < min; null without a min, past it, with nothing eaten, or when the macros can't fit at the min. A
 * macro already past its min (or max) at the min stays at what it is (nothing eaten can be taken back).
 */
export function guideToMin(model, total, eaten) {
  const min = model.energy.min
  const split = energySplit(total)
  if (!has(min) || !(eaten > 0) || eaten >= min || !(split.total > 0)) return null
  const atMin = ringShares(model, min)
  if (atMin.out) return null
  // In kcal of each macro, scaled to the ring's calories (registered energy can differ from the macros' sum); at the
  // min, never less than what's already eaten.
  const now = Object.fromEntries(split.macros.map((m) => [m.key, (m.kcal / split.total) * eaten]))
  const ends = atMin.shares.map((x) => {
    const e0 = now[x.m.key] ?? 0
    return { e0, lo: Math.max(e0, x.lo * min), hi: Math.max(e0, x.hi * min) }
  })
  return (kcal) => {
    const t = Math.min(1, Math.max(0, (kcal - eaten) / (min - eaten)))
    const share = (e0, e1) => Math.min(1, e0 / eaten + t * (e1 / min - e0 / eaten))
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

// --- The picture -------------------------------------------------------------------------------------------------
// What the pie shows, in pixels, for whoever draws it (Home.jsx PieCanvas on a canvas, the Android app's HomeScreen.kt
// through native/core.js): the colour of every ring (or row) and the lines and rings over them. Drawn one ring per
// pixel of radius (the shares' edges curve: a share of grams shrinks as the ring grows), then what was eaten on top:
// a white-edged ring at the calories eaten, split by the macros' shares; the calories' interval as two dashed
// circles (a ring as thick as the interval hid the targets under it).

const mix = (a, b, t) => a.map((x, i) => Math.round(x * t + b[i] * (1 - t)))
const WHITE = [255, 255, 255]

/** "#rrggbb" → [r, g, b]. */
export const rgbOf = (s) => {
  const h = s.trim().replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/** The pie's colours from the app's colour variables (`v(name)` → [r, g, b]), mixed with the tile's background. */
export function piePalette(v) {
  const bg = v('panel-2')
  const tones = Object.fromEntries(['prot', 'fat', 'carb', 'muted'].map((t) => [t, v(t)]))
  const pal = {
    // Where the macros' targets can't fit: deep blue, plain. Outside the calorie target: the same split, faded.
    // Where no macro target applies: a lighter blue within the calorie target, the same deep blue outside it.
    out: rgbOf('#000421'),
    free: rgbOf('#1e3a78'), shared: mix(v('muted'), bg, 0.6),
    core: Object.fromEntries(PIE_MACROS.map((m) => [m.key, tones[m.tone]])),
    flank: Object.fromEntries(PIE_MACROS.map((m) => [m.key, mix(tones[m.tone], WHITE, 0.5)])),
    tone: tones, range: v('range'), barLine: v('kcal'), bg,
  }
  const fadeAll = (x) => (Array.isArray(x) ? fade(x, bg) : Object.fromEntries(Object.entries(x).map(([k, c]) => [k, fade(c, bg)])))
  pal.faded = Object.fromEntries(['free', 'shared', 'core', 'flank'].map((k) => [k, fadeAll(pal[k])]))
  pal.faded.free = pal.out
  return pal
}
/** A colour faded for the rings outside the calorie target: most of its saturation gone (`sat` left), a little
 * darker (`keep` of it over the background). */
const fade = (c, bg, sat = 0.4, keep = 0.42) => {
  const grey = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
  return mix(mix(c, [grey, grey, grey], sat), bg, keep)
}
/** The bars of the target zone under the eaten history: between the history (55% over the background) and the eaten
 * ring (full) in brightness, most of their saturation kept. */
const barColour = (pal, s) => fade(segColour(pal, { ...s, dim: false }), pal.bg, 0.85, 0.78)
const segColour = (pal, s) => {
  const p = s.dim ? pal.faded : pal
  return s.kind === 'core' || s.kind === 'flank' ? p[s.kind][s.key] : p[s.kind]
}

export const PIE_RING = 9 // CSS px: the eaten ring's thickness

/** Arcs (eatenArcs) as segments of the turn, 0–1 in order, each with its colour from `colour(tone)`. */
const arcSegs = (arcs, colour) =>
  arcs.flatMap((a) => (a.from < 0 ? [{ ...a, from: a.from + 1, to: 1 }, { ...a, from: 0 }] : [a]))
    .sort((a, b) => a.from - b.from).map((a) => ({ to: a.to, c: colour(a.tone) }))

/**
 * The pie as drawn on `n` × `n` pixels, `k` pixels a CSS px (line widths, the eaten ring). In "levels" (px from
 * 0 kcal: the radius, or for the square the height from the bottom) and turns (angles; the square shows the right
 * half, x = 2 × turns):
 * - S: the top level (n / 2 round, n square); full: the kcal there;
 * - levels[i]: level i's colours, [{to, c}] (c [r, g, b] from turn `to`'s predecessor up to `to`);
 * - lines: dashed radial lines {t, L0, L1} (the macros' targets up to the calorie target's lowest ring);
 * - curves: dashed curves, [[{t, L} | null]] (those edges as they curve up the zone the history went past);
 * - bars: the bars at the calorie min and max as far as drawn, {L0, L1}, outlined in a thin solid `barLine`;
 * - rings: the calories' interval, dashed (levels); mid, thick: the eaten ring; arcs: its parts {from, to, c};
 * - errs: the macros' share ranges on it {L0, L1, from, to, c, hatch} (see-through c, hatched in `hatch`);
 * - edges: the eaten ring's white edges (levels).
 */
export function pieScene({ model, val, total, steps, square, n, k, pal }) {
  const full = pieFull(model, val)
  const [lo, hi] = bounds(val)
  const arcs = eatenArcs(model, total)
  const errs = eatenErrorBars(model, total)
  const S = square ? n : n / 2
  const at = (kcal) => (kcal / full) * S
  const thick = PIE_RING * k
  const mid = Math.min(S - thick / 2, Math.max(thick / 2, at(val.value)))
  // Inside the eaten ring: the split as the calories grew (eatenAt), in the eaten ring's colours, darker.
  const inner = arcs.length && steps?.length > 1 ? mid - thick / 2 : 0
  const hist = Object.fromEntries(Object.entries(pal.tone).map(([t, c]) => [t, mix(c, pal.bg, 0.55)]))
  // From the eaten ring to the calorie min: the macros' room fanning out to their targets there (guideToMin).
  const guide = guideToMin(model, total, val.value)
  // Where the history covers the calorie target, two thin bars stay in place and show as the eaten ring goes past
  // them (only under the history): right below the min, its split all through; right below the max, the zone as it
  // is there, ring by ring. Between them (or up to the ring), the macros' targets' edges as dashed curves (below),
  // meeting the bars' inner edges. Each bar a band of levels [from, to).
  const { min: cMin, max: cMax } = model.energy
  const bar = thick / 2
  const zone = has(cMin) && cMin > 0 && inner > 0
  const minBar = zone && inner > at(cMin) - bar ? [at(cMin) - bar, at(cMin)] : null
  const maxBar = minBar && has(cMax) && cMax > cMin && inner > at(cMax) - bar ? [at(cMax) - bar, at(cMax)] : null
  const inBar = (b, i) => b && i + 1 > b[0] && i < b[1] && i + 1 <= inner
  const minSegs = minBar && ringSegments(model, cMin).map((sg) => ({ to: sg.to, c: barColour(pal, sg) }))
  const levels = []
  for (let i = 0; i <= Math.floor(S); i++) {
    const kcal = ((i + 0.5) / S) * full
    levels.push(inBar(maxBar, i) ? ringSegments(model, kcal).map((sg) => ({ to: sg.to, c: barColour(pal, sg) }))
      : inBar(minBar, i) ? minSegs
      : i + 1 <= inner
      ? arcSegs(eatenArcs(model, eatenAt(steps, val.value, kcal)), (tone) => hist[tone])
      : ringSegments(model, kcal, guide && kcal >= val.value && kcal < cMin ? guide(kcal) : undefined)
        .map((sg) => ({ to: sg.to, c: segColour(pal, sg) })))
  }
  const shown = (t) => !square || t <= 0.5 + 1e-9
  // The macros' targets at the calorie target's lowest ring (its min, else its max): dashed lines from 0 kcal up
  // to it (or to the bar below the min) at each one's min and max there (those splits, eaten in proportion).
  const target = targetEdges(model)
  const lines = target.edges.filter(shown).map((t) => ({ t, L0: 0, L1: Math.min(S, at(target.kcal), minBar ? minBar[0] : Infinity) }))
  // Between the bars: each target edge as it curves up the zone (a share of grams shrinks as the calories grow).
  const curveTop = Math.min(inner, maxBar ? maxBar[0] : Infinity)
  const curves = minBar && curveTop > minBar[1]
    ? targetCurves(model, cMin, (curveTop / S) * full).map((c) => c.map((pt) => (pt && shown(pt.t) ? { t: pt.t, L: at(pt.kcal) } : null)))
    : []
  // Each bar's outline: the levels it's drawn on (whole ones, up to the history's top).
  const bars = [minBar, maxBar].filter(Boolean).map((b) => ({ L0: Math.floor(b[0]), L1: Math.min(Math.ceil(b[1]), Math.floor(inner)) }))
    .filter((b) => b.L1 > b.L0)
  const scene = { n, k, S, square, full, levels, lines, curves, bars, barLine: pal.barLine, rings: [], mid, thick, arcs: [], errs: [], edges: [], range: pal.range }
  if (!arcs.length) return scene
  // The calories' interval: two thin dashed rings at its ends.
  if (hi > lo) scene.rings = [at(lo), at(hi)]
  scene.arcs = arcs.map((a) => ({ from: a.from, to: a.to, c: pal.tone[a.tone] }))
  // Each macro's share range (from its least to its most likely amount, the others at their means), at its arc's
  // moving edge: as the bars' error range, its colour see-through, hatched with slanted lines of a lighter shade.
  // Where two overlap, each takes half the ring's width (lane).
  scene.errs = errs.flatMap((e) => {
    const tone = PIE_MACROS.find((m) => m.key === e.key)?.tone
    if (!tone) return []
    const c = pal.tone[tone]
    return [{ L0: e.lane > 0 ? mid : mid - thick / 2, L1: e.lane < 0 ? mid : mid + thick / 2, from: e.from, to: e.to, c, hatch: mix(c, WHITE, 0.6) }]
  })
  scene.edges = [mid - thick / 2, mid + thick / 2]
  return scene
}

/** The line under the pie for the ring at `pointed` kcal: {bold: "1866 kcal", text: ": below the calorie min · …"}. */
export function pieReadout(model, total, steps, pointed) {
  const kcal = calories(total)
  const bold = `${fmt(pointed, 0)} kcal`
  if (pointed < kcal.value && steps.length > 1) return { bold, text: ` eaten: ${sharesText(eatenAt(steps, kcal.value, pointed))}` }
  const guide = guideToMin(model, total, kcal.value)
  return { bold, text: `: ${ringText(model, pointed, guide && pointed < model.energy.min ? guide(pointed) : undefined)}` }
}
