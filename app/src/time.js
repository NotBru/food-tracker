// "Logical day": with dayStart = 05:00, a meal at 02:00 on the 16th belongs to the 15th.

const pad = (n) => String(n).padStart(2, '0')

export function offsetMinutes(dayStart = '05:00') {
  const [h, m] = dayStart.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toLocalInput(d) {
  return `${toDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function logicalDay(datetime, dayStart) {
  const d = new Date(datetime)
  d.setMinutes(d.getMinutes() - offsetMinutes(dayStart))
  return toDateStr(d)
}

export function today(dayStart) {
  return logicalDay(new Date(), dayStart)
}

function parseDay(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole days from `a` to `b` (both "YYYY-MM-DD"). */
export function daysBetween(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / 86_400_000)
}

export function addDays(dayStr, n) {
  const d = parseDay(dayStr)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** Real-time [start, end) of a logical day. */
export function dayBounds(dayStr, dayStart) {
  const start = parseDay(dayStr)
  start.setMinutes(offsetMinutes(dayStart))
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return [start, end]
}

export const WINDOWS = ['daily', 'last7', 'weekly', 'monthly']
export const WINDOW_NAMES = { daily: 'daily', last7: 'last 7 days', weekly: 'weekly', monthly: 'monthly' }

/**
 * Logical days [firstDay, lastDay] of the window containing `dayStr`. Weeks start on Monday. last7 is rolling: the
 * 6 days before `dayStr` and `dayStr` itself, the days the weekly calorie correction looks at.
 */
export function windowDays(win, dayStr) {
  const d = parseDay(dayStr)
  if (win === 'daily') return [dayStr, dayStr]
  if (win === 'last7') return [addDays(dayStr, -6), dayStr]
  if (win === 'weekly') {
    const first = addDays(dayStr, -((d.getDay() + 6) % 7))
    return [first, addDays(first, 6)]
  }
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return [toDateStr(first), toDateStr(last)]
}

/** "Fri 2026-10-16": dates are always shown as YYYY-MM-DD; the weekday helps when browsing days. */
export function prettyDay(dayStr) {
  return `${parseDay(dayStr).toLocaleDateString(undefined, { weekday: 'short' })} ${dayStr}`
}

/** "202610161430" (local time): the app version's build date (Config → "App version"). */
export const versionStamp = (datetime) => toLocalInput(new Date(datetime)).replace(/\D/g, '')

/** "2026-10-16 14:30" (local time). */
export function formatDateTime(datetime) {
  return toLocalInput(new Date(datetime)).replace('T', ' ')
}
