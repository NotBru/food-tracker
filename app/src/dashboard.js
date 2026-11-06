// The homescreen's dashboard: what it loads and how its bars are laid out, shared by the web screen (screens/Home.jsx)
// and the Android app's native one (native/core.js).
import { db, getConfig, getCurrentUser } from './db'
import { averageTargets, barScale, consumptionNutrients, loadContext, perDay, sumNutrients, targetBar, weeklyCorrection } from './calc'
import { NUTRIENTS, calories, fmt } from './nutrients'
import { bounds } from './stats'
import { addDays, dayBounds, logicalDay, prettyDay, toDateStr, toLocalInput, today, windowDays } from './time'

// Always shown (unless Config's "only nutrients with a target" is on); any other nutrient gets a row when a target covers it.
export const ROWS = [
  { key: 'energy', label: 'Calories', unit: 'kcal', cls: 'c-kcal' },
  { key: 'proteins', label: 'Protein', unit: 'g', cls: 'c-prot' },
  { key: 'fat', label: 'Fat', unit: 'g', cls: 'c-fat' },
  { key: 'carbohydrates', label: 'Carbs', unit: 'g', cls: 'c-carb' },
]

// Mandatory rows without a target still get a neutral, full bar/gauge (no regions, markers or label).
const DUMMY = { fill: 100, minAt: null, maxAt: null, status: 'none', dummy: true }
export const barFor = (row, val, range) => targetBar(val, range) ?? (ROWS.some((r) => r.key === row.key) ? DUMMY : null)
/**
 * Daily calories with the ghost on, when a cap was hit: where the uncapped correction's range would lie, as
 * {from, to} in % of the real bar (same scale, so it lines up with the fill and the coloured regions).
 */
export function ghostFor(row, val, range, adj) {
  if (row.key !== 'energy' || !adj?.ghost || !adj.days || !Object.values(adj.capped).some(Boolean)) return null
  const pos = barScale(range, val)
  const { min, max } = adj.uncapped
  return { from: Number.isFinite(min) ? pos(min) : 0, to: Number.isFinite(max) ? pos(max) : 100 }
}

/**
 * Dashboard style "bars" (web for now): every number is a note on the bar, at its place on the bar's scale (% of its
 * width). Above: the estimate (its value; its interval's low and high ends). Below: the target's min and max.
 * Calories with a max: the budget, a segment between the near ends of the estimate and the target (from the
 * interval's high end to the max: what's left to eat, or how far over). Without a target the bar still has a scale
 * (barScale: the interval's top at 80%), with a grey fill.
 * Returns {bar (as targetBar), top, bottom: [{at, text, kind}], budget: {from, to, text, over} | null}.
 */
export function barNotes(row, val, range = {}) {
  const pos = barScale(range, val)
  const [lo, hi] = bounds(val)
  const spread = hi > lo
  const bar = targetBar(val, range, pos) ??
    { fill: pos(val.value), minAt: null, maxAt: null, status: 'none', dummy: true, errLo: spread ? pos(lo) : null, errHi: spread ? pos(hi) : null }
  const n = (x) => fmt(x, 0)
  const value = { at: bar.fill, text: `${val.estimated ? '~' : ''}${n(val.value)}`, kind: 'value' }
  const top = spread ? [{ at: pos(lo), text: n(lo), kind: 'lo' }, value, { at: pos(hi), text: n(hi), kind: 'hi' }] : [value]
  const bottom = [['min', range.min, bar.minAt], ['max', range.max, bar.maxAt]]
    .filter(([, x]) => Number.isFinite(x)).map(([kind, x, at]) => ({ at, text: n(x), kind }))
  let budget = null
  if (row.key === 'energy' && Number.isFinite(range.max)) {
    const left = range.max - hi
    budget = { from: Math.min(pos(hi), bar.maxAt), to: Math.max(pos(hi), bar.maxAt), text: `Δ ${left < 0 ? '−' : ''}${n(Math.abs(left))}`, over: !(left > 0) }
  }
  return { bar, top, bottom, budget }
}

export function windowTitle(win, first, last, back = 0) {
  if (win === 'daily') return `${back === 0 ? 'Today' : back === 1 ? 'Yesterday' : back === -1 ? 'Tomorrow' : `${back} days ago`} · ${prettyDay(first)}`
  if (win === 'last7') return `Last 7 days · ${first} → ${last}`
  if (win === 'weekly') return `This week · ${first} → ${last}`
  return `This month · ${first.slice(0, 7)}`
}

// --- Fill pieces ---------------------------------------------------------------
// The fill (solid up to the interval's low end, hatched from there to its high end) is cut at the min and max, and each piece takes
// the colour of the region it lies in: under (below min), ok, over (above max). A bar without a target: one grey piece.

const regionAt = (bar, x) => (bar.dummy ? 'none' : bar.minAt != null && x < bar.minAt ? 'under' : bar.maxAt != null && x > bar.maxAt ? 'over' : 'ok')

/** [{from, to, region, hatched}] covering 0 → end of the fill, in % of the bar. */
export function fillPieces(bar) {
  const solidEnd = bar.errLo ?? bar.fill
  const spans = [[0, solidEnd, false]]
  if (bar.errLo != null && bar.errHi > bar.errLo) spans.push([bar.errLo, bar.errHi, true])
  const out = []
  for (const [a, b, hatched] of spans) {
    if (!(b > a)) continue
    const cuts = [a, ...[bar.minAt, bar.maxAt].filter((x) => x != null && x > a && x < b).sort((x, y) => x - y), b]
    for (let i = 1; i < cuts.length; i++) out.push({ from: cuts[i - 1], to: cuts[i], region: regionAt(bar, (cuts[i - 1] + cuts[i]) / 2), hatched })
  }
  return out
}
export const fillEnd = (bar) => (bar.errLo != null ? bar.errHi : bar.fill)
// With an error range, a short white tick across the band (a little past its edges) marks the estimate itself (value).
export const hasMean = (bar) => bar.errLo != null && bar.errHi > bar.errLo

export const statusMark = (s) => (s === 'ok' ? '✓' : s === 'under' ? '↓' : '↑')

/**
 * What the dashboard shows for window `win`, ending on `picked` (daily: the day shown) or on today (`day`, today's
 * logical day; computed when not given).
 */
export async function loadDashboard({ win, day, picked }) {
  const config = await getConfig()
  const todayDay = day ?? today(config.dayStart)
  const [first, last] = windowDays(win, win === 'daily' && picked ? picked : todayDay)
  // Daily: the 6 days before are loaded too, for the weekly calorie correction.
  const daily = win === 'daily'
  const start = dayBounds(first, config.dayStart)[0]
  const end = dayBounds(last, config.dayStart)[1]
  const from = daily ? dayBounds(addDays(first, -6), config.dayStart)[0] : start
  const user = await getCurrentUser()
  const all = await db.logs.where('[userId+datetime]').between([user.id, from.toISOString()], [user.id, end.toISOString()], true, false).toArray()
  const logs = all.filter((l) => l.datetime >= start.toISOString())
  const ctx = await loadContext()
  const results = logs.map((l) => consumptionNutrients(ctx, l))
  const allTargets = await db.targets.where('userId').equals(user.id).toArray()
  // Weekly/monthly: per-day averages over the days that have consumptions (a day with none is no data, not 0 kcal);
  // with no such day yet, the targets average over the whole window.
  const logged = [...new Set(logs.map((l) => logicalDay(l.datetime, config.dayStart)))].sort()
  const windowList = []
  for (let d = first; d <= last; d = addDays(d, 1)) windowList.push(d)
  const targets = averageTargets(allTargets, logged.length ? logged : windowList, config.dayStart)
  let adj = null
  if (daily) {
    // Kcal per earlier day that has consumptions.
    const byDay = {}
    for (const l of all) if (l.datetime < start.toISOString()) (byDay[logicalDay(l.datetime, config.dayStart)] ??= []).push(consumptionNutrients(ctx, l).nutrients)
    const eaten = Object.fromEntries(Object.entries(byDay).map(([d, list]) => [d, calories(sumNutrients(list))]))
    adj = weeklyCorrection(allTargets, first, config.dayStart, eaten, config.adjCap)
    if (adj) {
      targets.energy = adj.range
      adj.ghost = config.adjGhost
    }
  }
  // Every nutrient that any target mentions gets a row, even if no target covers this window. With onlyTargets, the
  // always-shown rows follow the same rule.
  const targeted = new Set(allTargets.flatMap((t) => Object.keys(t.values)))
  const extra = NUTRIENTS.filter((n) => targeted.has(n.key) && !ROWS.some((r) => r.key === n.key))
    .map((n) => ({ key: n.key, label: n.label, unit: n.unit, cls: '' }))
  return {
    user, first, last, count: logs.length, days: logged.length, targets, adj, rows: [...ROWS.filter((r) => !config.onlyTargets || targeted.has(r.key)), ...extra], style: config.dashboard, pie: config.pie, pieSquare: config.pieSquare, showVersion: config.showVersion,
    failed: results.filter((r) => !r.ok).length,
    total: perDay(sumNutrients(results.map((r) => r.nutrients)), daily ? 1 : Math.max(1, logged.length)),
    steps: eatingSteps(results, daily ? 1 : Math.max(1, logged.length)),
  }
}

const STEP_MACROS = ['proteins', 'fat', 'carbohydrates', 'alcohol']

/**
 * How the window's eating went, consumption by consumption in time order (per day, like the total): the running
 * calories and macro grams after each, from {kcal: 0} (the energy pie draws the macros' split as the calories grew).
 */
export function eatingSteps(results, days) {
  const num = (v) => (Number.isFinite(v?.value) ? Math.max(0, v.value) : 0)
  const steps = [{ kcal: 0, g: Object.fromEntries(STEP_MACROS.map((k) => [k, 0])) }]
  for (const r of results) {
    const last = steps[steps.length - 1]
    steps.push({
      kcal: last.kcal + num(calories(r.nutrients)) / days,
      g: Object.fromEntries(STEP_MACROS.map((k) => [k, last.g[k] + num(r.nutrients[k]) / days])),
    })
  }
  return steps
}

/** The export file's name: local date and time to the second; dashes, since ":" isn't allowed in filenames everywhere. */
export function exportFileName(now = new Date()) {
  return `food-tracker-${toDateStr(now)}_${toLocalInput(now).slice(11).replace(':', '-')}-${String(now.getSeconds()).padStart(2, '0')}.json`
}
