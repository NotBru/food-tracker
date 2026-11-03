import Dexie from 'dexie'
import { db, getConfig, getCurrentUser } from './db'
import { averageTargets, consumptionNutrients, loadContext, perDay, sumNutrients, targetBar, weeklyCorrection } from './calc'
import { NUTRIENTS, calories } from './nutrients'
import { bounds, zero } from './stats'
import { addDays, addMonths, dayBounds, daysBetween, logicalDay } from './time'
import { dailyValues, measures, weekMean } from './body'
import { ROWS, fillPieces } from './dashboard'

// Time graphs' data and scales (screens/Graphs.jsx; the Android app's native screen too).

// Days shown: the slider's stops (SLIDER_STOPS) or any number up to MAX_DAYS in the box.
export const DEFAULT_DAYS = 30
export const MAX_SLIDER = 180 // the Android app's slider, until it has the stops (android/README.md Next port)
export const MAX_DAYS = 730

/** The slider's stops, left to right: 12 months, 11, …, 1 month, 3 weeks, 2 weeks, 13 days, …, 1 day. */
export const SLIDER_STOPS = [
  ...Array.from({ length: 12 }, (_, i) => ({ months: 12 - i, label: `${12 - i} month${12 - i > 1 ? 's' : ''}` })),
  { days: 21, label: '3 weeks' },
  { days: 14, label: '2 weeks' },
  ...Array.from({ length: 13 }, (_, i) => ({ days: 13 - i, label: `${13 - i} day${13 - i > 1 ? 's' : ''}` })),
]

/** A stop's days, ending on `last`: a month is a calendar month back from it (1 month on 11-03: 10-04 → 11-03, 31). */
export const stopDays = (stop, last) => stop.days ?? daysBetween(addMonths(last, -stop.months), last)

/** The slider's stop for `span` days ending on `last`: the one with those days, else the nearest. */
export function stopIndex(span, last) {
  let best = 0
  SLIDER_STOPS.forEach((st, i) => {
    if (Math.abs(stopDays(st, last) - span) < Math.abs(stopDays(SLIDER_STOPS[best], last) - span)) best = i
  })
  return best
}

/** The `days` route parameter as a number of days (the default if it isn't one). */
export const spanOf = (daysParam) =>
  Number.isInteger(Number(daysParam)) && daysParam >= 1 && daysParam <= MAX_DAYS ? Number(daysParam) : DEFAULT_DAYS

/** Ticks at 1/2/5 × 10^k strictly between `lo` and `hi`: the finest step that gives at most four. */
export function ticks(lo, hi) {
  if (!(hi > lo)) return { step: 1, list: [] }
  const p = 10 ** Math.floor(Math.log10((hi - lo) / 4))
  const count = (s) => Math.ceil(hi / s - 1e-9) - Math.floor(lo / s + 1e-9) - 1
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => count(s) <= 4)
  const list = []
  for (let t = (Math.floor(lo / step + 1e-9) + 1) * step; t < hi - 1e-9; t += step) list.push(t)
  return { step, list }
}

/** `span` days up to `last`: each day's totals, 7-day averages and targets, the rows to chart and the measures. */
export async function loadGraphs(last, span) {
  const config = await getConfig()
  const first = addDays(last, -(span - 1))
  const list = []
  for (let d = first; d <= last; d = addDays(d, 1)) list.push(d)
  // The 7 days before are loaded too, for the weekly calorie correction and the 7-day average (from the day before
  // the first, so its band comes in from the left edge instead of starting mid-column).
  const from = dayBounds(addDays(first, -7), config.dayStart)[0]
  const end = dayBounds(last, config.dayStart)[1]
  const user = await getCurrentUser()
  const logs = await db.logs.where('[userId+datetime]').between([user.id, from.toISOString()], [user.id, end.toISOString()], true, false).toArray()
  const ctx = await loadContext()
  const byDay = {}
  for (const l of logs) (byDay[logicalDay(l.datetime, config.dayStart)] ??= []).push(consumptionNutrients(ctx, l).nutrients)
  const totals = Object.fromEntries(Object.entries(byDay).map(([d, ns]) => [d, sumNutrients(ns)]))
  const eaten = Object.fromEntries(Object.entries(totals).map(([d, t]) => [d, calories(t)]))
  const allTargets = await db.targets.where('userId').equals(user.id).toArray()
  const targets = Object.fromEntries(list.map((d) => {
    const t = averageTargets(allTargets, [d], config.dayStart)
    const adj = weeklyCorrection(allTargets, d, config.dayStart, eaten, config.adjCap)
    if (adj) t.energy = adj.range
    return [d, t]
  }))
  // The dashboard's rows: the macros, plus any nutrient a target mentions.
  const targeted = new Set(allTargets.flatMap((t) => Object.keys(t.values)))
  const extra = NUTRIENTS.filter((n) => targeted.has(n.key) && !ROWS.some((r) => r.key === n.key))
    .map((n) => ({ key: n.key, label: n.label, unit: n.unit, cls: '' }))
  const week = Object.fromEntries([addDays(first, -1), ...list].map((d) => {
    const had = [0, 1, 2, 3, 4, 5, 6].map((i) => totals[addDays(d, -i)]).filter(Boolean)
    return [d, had.length ? perDay(sumNutrients(had), had.length) : null]
  }))
  // Body measurements: the user's few rows, all of them (a measure never taken: no chart).
  const body = await db.weights.where('[userId+datetime]').between([user.id, Dexie.minKey], [user.id, Dexie.maxKey]).toArray()
  const shownMeasures = measures(body).filter((m) => body.some((r) => m.of(r))).map((m) => {
    const daily = dailyValues(body, m.of, config.dayStart)
    return { ...m, daily, week: Object.fromEntries([addDays(first, -1), ...list].map((d) => [d, weekMean(daily, d)])) }
  })
  return { list, totals, week, targets, measures: shownMeasures, rows: [...ROWS, ...extra] }
}

const digitsOf = (step) => (step < 1 ? Math.ceil(-Math.log10(step)) : 0)

/**
 * A nutrient's chart scale: the highest of the days' bounds and intervals' tops (the average's too) at 90% of the
 * height. `pos` maps a value to % of the plot's height; `grid` its gridlines, labelled with `digits`.
 */
export function nutrientScale(row, data) {
  const { list, totals, week, targets } = data
  const of = (t) => t && (row.key === 'energy' ? calories(t) : t[row.key] ?? zero())
  const valueOf = (d) => of(totals[d])
  const avgOf = (d) => of(week[d])
  let top = 0
  for (const d of list) {
    const r = targets[d][row.key] ?? {}
    const v = valueOf(d)
    const a = avgOf(d)
    top = Math.max(top, ...[r.min, r.max, v && bounds(v)[1], a && bounds(a)[1]].filter(Number.isFinite))
  }
  const full = top > 0 ? top / 0.9 : 1
  const pos = (x) => Math.min(100, Math.max(0, (x / full) * 100))
  const { step, list: grid } = ticks(0, top > 0 ? full : 0) // nothing to measure: no gridlines
  return { valueOf, avgOf, pos, grid, digits: digitsOf(step) }
}

/**
 * A body measurement's scale: the values and the average's interval in view (the day before the first too), with a
 * margin, at least `minRange` tall (a user's field: 5% of its value, or 1).
 */
export function measureScale(measure, list) {
  const { minRange, daily, week } = measure
  const vals = []
  for (const d of [addDays(list[0], -1), ...list]) {
    if (daily[d] && d >= list[0]) vals.push(...bounds(daily[d]))
    if (week[d]) vals.push(...bounds(week[d]))
  }
  let lo = vals.length ? Math.min(...vals) : 0
  let hi = vals.length ? Math.max(...vals) : 0
  const least = minRange ?? Math.max(Math.abs(hi) * 0.05, 1)
  const pad = Math.max(0.1 * (hi - lo), (least - (hi - lo)) / 2)
  lo -= pad
  hi += pad
  const pos = (x) => Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100))
  const { step, list: grid } = ticks(vals.length ? lo : 0, vals.length ? hi : 0)
  return { valueOf: (d) => daily[d], avgOf: (d) => week[d], pos, grid, digits: digitsOf(step) }
}

/** A day's column: the target's bar (its regions), and the bar to fill when it has consumptions (`val`). */
export function columnBars(val, range, pos) {
  const target = targetBar(val ?? zero(), range, pos)
  let bar = val && target
  if (val && !bar) {
    const [lo, hi] = bounds(val)
    bar = { fill: pos(val.value), minAt: null, maxAt: null, status: 'none', dummy: true, errLo: hi > lo ? pos(lo) : null, errHi: hi > lo ? pos(hi) : null }
  }
  return { target, bar }
}

/**
 * What a day's column draws, in % of the plot from the bottom: `zones`, the target's range, a light green (the parts
 * the day's estimate covers get a full green piece over it); `pieces`, the estimate's interval, hatched, in green where
 * it's within the target and red where it's outside it (grey without a target), and nothing below it; `mean`, the
 * estimate's tick (null without consumptions). Outside both the range and the interval: nothing.
 */
export function columnShapes(val, range, pos) {
  const { target, bar } = columnBars(val, range, pos)
  return {
    zones: target ? [{ from: target.minAt ?? 0, to: target.maxAt ?? 100, region: 'ok' }] : [],
    pieces: bar ? fillPieces(bar).filter((pc) => pc.hatched).map(({ from, to, region }) => ({ from, to, region, hatched: true })) : [],
    mean: bar ? bar.fill : null,
  }
}

/** The 7-day average's points: per day from the day before the first, {x (columns), lo, hi (% from the top)}, or null. */
export function weekPoints(list, avgOf, pos) {
  return [addDays(list[0], -1), ...list].map((d, i) => {
    const a = avgOf(d)
    if (!a) return null
    const [lo, hi] = bounds(a)
    return { x: i - 0.5, lo: 100 - pos(lo), hi: 100 - pos(hi) }
  })
}
