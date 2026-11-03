// What the Android app's native screens ask the web app's logic for (through bridge.js). Each view returns what its
// screen shows, as plain JSON: texts already formatted and links as routes, so the Kotlin side only lays it out and
// no logic is copied there. One function per native screen; the web screen it replaces uses the same modules.
import { exportAll, getConfig, importAll } from '../db'
import { calories, fmt, pmText, rangeLabel, rangeText } from '../nutrients'
import { bounds, sdOf, setCoverage, zero } from '../stats'
import { WINDOWS, WINDOW_NAMES, addDays, daysBetween, today, versionStamp } from '../time'
import { barFor, exportFileName, fillEnd, fillPieces, ghostFor, hasMean, loadDashboard, statusMark, windowTitle } from '../dashboard'
import { conflictLabelShown, getState, status } from '../backup'
import { statusText } from '../screens/Backup'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const finite = (x) => (Number.isFinite(x) ? x : null)

/** The homescreen (screens/Home.jsx): `query` is its route's (`win`, `day`). */
export async function home(query = {}) {
  const config = await getConfig()
  setCoverage(config.coverage) // as App does (main.jsx) before any screen draws
  const day = today(config.dayStart)
  const win = WINDOWS.includes(query.win) ? query.win : WINDOWS[0]
  const winIdx = WINDOWS.indexOf(win)
  // As in Home.jsx: the day shown is at most tomorrow; today is no `day` at all.
  const inRange = (d) => d && d !== day && d <= addDays(day, 1)
  const picked = inRange(query.day) ? query.day : undefined
  const back = picked ? daysBetween(picked, day) : 0
  const view = (w, d) => {
    const qs = new URLSearchParams({ ...(w !== WINDOWS[0] && { win: w }), ...(inRange(d) && { day: d }) }).toString()
    return `/${qs ? `?${qs}` : ''}`
  }
  const data = await loadDashboard({ win, day, picked })
  const otherDay = win === 'daily' && back !== 0 ? data.first : null
  const rows = data.rows.map((r) => {
    const val = r.key === 'energy' ? calories(data.total) : data.total[r.key] ?? zero()
    const range = data.targets[r.key]
    const bar = barFor(r, val, range)
    const ghost = ghostFor(r, val, range, data.adj)
    const left = r.key === 'energy' && Number.isFinite(range?.max) ? range.max - bounds(val)[1] : null
    return {
      key: r.key, label: r.label, unit: r.unit, color: r.cls,
      value: `${val.estimated ? '~' : ''}${fmt(val.value, 0)}`,
      pm: pmText(val),
      err: sdOf(val) > 0 ? rangeText(val) : '',
      bar: bar && {
        status: bar.status, dummy: !!bar.dummy, minAt: finite(bar.minAt), maxAt: finite(bar.maxAt), fill: finite(bar.fill),
        end: finite(fillEnd(bar)), pieces: fillPieces(bar), mean: hasMean(bar),
      },
      ghost: ghost && ghost.to > ghost.from ? ghost : null,
      rangeLine: bar && !bar.dummy ? `${rangeLabel(range)} ${r.unit} ${statusMark(bar.status)}` : '',
      budget: left == null ? null : { text: `${left < 0 ? '−' : ''}${fmt(Math.abs(left), 0)}`, over: !(left > 0) },
      open: `/breakdown/${r.key}?from=${data.first}&to=${data.last}&win=${win}`,
    }
  })
  return {
    win, winName: WINDOW_NAMES[win], title: windowTitle(win, data.first, data.last, back), dots: WINDOWS.map((w) => w === win),
    daily: win === 'daily',
    prevWin: view(WINDOWS[(winIdx + WINDOWS.length - 1) % WINDOWS.length], picked),
    nextWin: view(WINDOWS[(winIdx + 1) % WINDOWS.length], picked),
    prevDay: view(win, addDays(picked ?? day, -1)),
    nextDay: back < 0 ? null : view(win, addDays(picked ?? day, 1)),
    todayView: back === 0 ? null : view(win),
    user: data.user.name,
    version: data.showVersion ? `v${versionStamp(__BUILT_AT__)}` : null,
    style: data.style,
    rows,
    summary: `${plural(data.count, 'consumption')}${win !== 'daily' ? ` · per day, over ${plural(data.days, 'day')} with consumptions` : ''}`,
    failed: data.failed > 0 ? `${data.failed} couldn't be computed` : null,
    consumptions: `/consumptions${otherDay ? `?day=${otherDay}` : ''}`,
    addConsumption: `/consumptions?${otherDay ? `day=${otherDay}&` : ''}new`,
  }
}

/** The sync icon (screens/Backup.jsx SyncStatus): its state (colour), what it means, and whether "Merge conflict" shows. */
export function syncStatus() {
  const s = getState()
  const st = status(s)
  return {
    state: st,
    text: `${statusText(s)} Tap to ${{ off: 'set it up', conflict: 'pick which to keep' }[st] ?? 'open Backup'}.`,
    label: st === 'conflict' && conflictLabelShown() ? 'Merge conflict' : null,
  }
}

/** Export databases: the file's name and text. */
export const exportFile = async () => ({ name: exportFileName(), text: await exportAll() })

/** Import databases: merge the file's text into what's here, or replace everything with it. */
export const importFile = (text, merge) => importAll(text, { merge })

/** For the Replace confirmation (Home.jsx ImportSheet): whether a backup is set up, so other devices are replaced too. */
export const backupOn = () => !!getState()
