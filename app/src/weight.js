import { addScaled, zero } from './stats'
import { addDays, daysBetween, logicalDay } from './time'

// Weigh-ins: {userId, datetime, kg}, per user like consumptions. A day's weight is the mean of its weigh-ins (by
// logical day). Day-to-day water swings are larger than real change, so what's read is the 7-day average and the
// trend over weeks.

// kcal in a kg of body weight lost or gained (mostly fat, some lean tissue and water): the usual rule of thumb.
export const KCAL_PER_KG = 7700
// The maintenance estimate looks at the last MAINT_DAYS days; it needs MIN_WEIGH_INS days with a weigh-in, at
// least MIN_SPAN days apart (first to last).
export const MAINT_DAYS = 28
export const MIN_WEIGH_INS = 4
export const MIN_SPAN = 7

/** Logical day -> mean kg of that day's weigh-ins. */
export function dailyWeights(weighIns, dayStart) {
  const byDay = {}
  for (const w of weighIns) (byDay[logicalDay(w.datetime, dayStart)] ??= []).push(w.kg)
  return Object.fromEntries(Object.entries(byDay).map(([d, ks]) => [d, ks.reduce((a, k) => a + k, 0) / ks.length]))
}

/**
 * The 7-day average on day `d`: the mean of the days among d−6..d with a weigh-in, as {value, v, s} (stats.js), its
 * variance the standard error² of that mean (the days' spread² / n). One day: no spread, a point. None: null.
 */
export function weekWeight(daily, d) {
  const ks = [0, 1, 2, 3, 4, 5, 6].map((i) => daily[addDays(d, -i)]).filter((k) => k != null)
  if (!ks.length) return null
  const mean = ks.reduce((a, k) => a + k, 0) / ks.length
  const s2 = ks.length > 1 ? ks.reduce((a, k) => a + (k - mean) ** 2, 0) / (ks.length - 1) : 0
  return { value: mean, v: s2 / ks.length, s: {} }
}

/**
 * Maintenance calories from weight and intake, over the MAINT_DAYS days up to `last`:
 *   maintenance = mean logged kcal per day − trend (kg/day) × KCAL_PER_KG.
 * The trend is the least-squares line through the days' weights; its error, the line's standard error. The intake
 * is the per-day mean over the days with consumptions from the first weigh-in to the day before the last (a
 * weigh-in, in the morning, comes before that day's food), with its own error. Both errors add.
 * `eaten`: logical day -> calories ({value, v, s}). Returns null, with `need`, when there is too little to go on.
 */
export function maintenance(daily, eaten, last, days = MAINT_DAYS) {
  const from = addDays(last, -(days - 1))
  const pts = Object.entries(daily).filter(([d]) => d >= from && d <= last).sort(([a], [b]) => a.localeCompare(b))
  const span = pts.length ? daysBetween(pts[0][0], pts.at(-1)[0]) : 0
  if (pts.length < MIN_WEIGH_INS || span < MIN_SPAN) return { need: { weighIns: pts.length, span } }
  const xs = pts.map(([d]) => daysBetween(pts[0][0], d))
  const ys = pts.map(([, k]) => k)
  const n = xs.length
  const mx = xs.reduce((a, x) => a + x, 0) / n
  const my = ys.reduce((a, y) => a + y, 0) / n
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx
  const rss = xs.reduce((a, x, i) => a + (ys[i] - my - slope * (x - mx)) ** 2, 0)
  const trend = { value: slope, v: rss / (n - 2) / sxx, s: {} }

  const logged = []
  for (let d = pts[0][0]; d < pts.at(-1)[0]; d = addDays(d, 1)) if (eaten[d]) logged.push(eaten[d])
  if (!logged.length) return { need: { logged: 0 } }
  const intake = zero()
  for (const e of logged) addScaled(intake, e, 1 / logged.length)

  const value = addScaled(addScaled(zero(), intake), trend, -KCAL_PER_KG)
  return {
    value,
    intake,
    trend, // kg/day
    weighIns: n,
    from: pts[0][0],
    to: pts.at(-1)[0],
    loggedDays: logged.length,
    days: span,
  }
}
