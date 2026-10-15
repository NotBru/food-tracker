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

export const WINDOWS = ['daily', 'weekly', 'monthly']

/** Logical days [firstDay, lastDay] of the window containing `dayStr`. Weeks start on Monday. */
export function windowDays(win, dayStr) {
  const d = parseDay(dayStr)
  if (win === 'daily') return [dayStr, dayStr]
  if (win === 'weekly') {
    const first = addDays(dayStr, -((d.getDay() + 6) % 7))
    return [first, addDays(first, 6)]
  }
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return [toDateStr(first), toDateStr(last)]
}

export function prettyDay(dayStr) {
  return parseDay(dayStr).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
