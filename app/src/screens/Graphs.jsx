import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getConfig, getCurrentUser } from '../db'
import { averageTargets, consumptionNutrients, loadContext, perDay, sumNutrients, targetBar, weeklyCorrection } from '../calc'
import { NUTRIENTS, calories, fmt, pmText, rangeLabel, rangeText } from '../nutrients'
import { bounds, sdOf, zero } from '../stats'
import { addDays, dayBounds, logicalDay, prettyDay } from '../time'
import { Screen, go, replace, useToday } from '../components'
import { ROWS, fillPieces, hasMean, statusMark } from './Home'

// Time graphs: per nutrient on the dashboard, one column per day, back to back. Each column is a dashboard bar
// standing up: the day's target as tinted regions (below min, within, above max), the fill solid up to the low end
// of the day's interval and hatched from there to its high end, each piece in its region's colour, and a white tick
// at the estimate. Calories use the day's weekly-corrected target, as the daily dashboard did that day.
// A day without consumptions is no data: its target shows, no fill.
// Over the columns, the 7-day average: per day, the per-day average over it and the 6 days before (those with
// consumptions, as the dashboard's windows), a line through the estimates with an error bar at each day.

// Days shown: the slider covers up to MAX_SLIDER; the box takes up to MAX_DAYS.
const DEFAULT_DAYS = 30
const MAX_SLIDER = 180
const MAX_DAYS = 730

/** Ticks at 1/2/5 × 10^k below `top`: the finest step that gives at most four. */
function ticks(top) {
  if (!(top > 0)) return { step: 1, list: [] }
  const p = 10 ** Math.floor(Math.log10(top / 4))
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => Math.ceil(top / s) - 1 <= 4)
  const list = []
  for (let t = step; t < top - 1e-9; t += step) list.push(t)
  return { step, list }
}

export default function Graphs({ days: daysParam }) {
  const span = Number.isInteger(Number(daysParam)) && daysParam >= 1 && daysParam <= MAX_DAYS ? Number(daysParam) : DEFAULT_DAYS
  // The box's text while typing; the URL follows each valid number.
  const [text, setText] = useState(String(span))
  const setSpan = (n) => replace(`/graphs${n === DEFAULT_DAYS ? '' : `?days=${n}`}`)
  const onType = (t) => {
    setText(t)
    const n = Number(t)
    if (Number.isInteger(n) && n >= 1 && n <= MAX_DAYS) setSpan(n)
  }
  const day = useToday()
  const [sel, setSel] = useState(null)

  const data = useLiveQuery(async () => {
    if (!day) return null
    const config = await getConfig()
    const first = addDays(day, -(span - 1))
    const list = []
    for (let d = first; d <= day; d = addDays(d, 1)) list.push(d)
    // The 6 days before are loaded too, for the weekly calorie correction and the 7-day average.
    const from = dayBounds(addDays(first, -6), config.dayStart)[0]
    const end = dayBounds(day, config.dayStart)[1]
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
    const week = Object.fromEntries(list.map((d) => {
      const had = [0, 1, 2, 3, 4, 5, 6].map((i) => totals[addDays(d, -i)]).filter(Boolean)
      return [d, had.length ? perDay(sumNutrients(had), had.length) : null]
    }))
    return { list, totals, week, targets, rows: [...ROWS, ...extra] }
  }, [day, span])

  const shown = sel && data?.list.includes(sel) ? sel : data?.list.at(-1)
  return (
    <Screen className="graphs" title="Time graphs" subtitle={data ? `${data.list[0]} → ${data.list.at(-1)} · daily` : ''}>
      <div className="tg-days">
        <input type="range" min="1" max={MAX_SLIDER} value={Math.min(span, MAX_SLIDER)} aria-label="Days"
          onChange={(e) => { setText(e.target.value); setSpan(Number(e.target.value)) }} />
        <input inputMode="numeric" value={text} aria-label="Days" onChange={(e) => onType(e.target.value)}
          onBlur={() => setText(String(span))} />
        <span className="muted">days</span>
      </div>
      {data?.rows.map((r) => <TimeChart key={r.key} row={r} data={data} shown={shown} onPick={setSel} />)}
    </Screen>
  )
}

/** One nutrient over the days: the columns, a y axis, a few dates, and the picked day spelled out underneath. */
function TimeChart({ row, data, shown, onPick }) {
  const { list, totals, week, targets } = data
  const of = (t) => t && (row.key === 'energy' ? calories(t) : t[row.key] ?? zero())
  const valueOf = (d) => of(totals[d])
  const avgOf = (d) => of(week[d])
  // One scale for the chart: the highest of the days' bounds and intervals' tops (the average's too) at 90% of the
  // height.
  let top = 0
  for (const d of list) {
    const r = targets[d][row.key] ?? {}
    const v = valueOf(d)
    const a = avgOf(d)
    top = Math.max(top, ...[r.min, r.max, v && bounds(v)[1], a && bounds(a)[1]].filter(Number.isFinite))
  }
  const full = top > 0 ? top / 0.9 : 1
  const pos = (x) => Math.min(100, Math.max(0, (x / full) * 100))
  const { step, list: grid } = ticks(top > 0 ? full : 0) // nothing to measure: no gridlines
  const digits = step < 1 ? Math.ceil(-Math.log10(step)) : 0

  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const i = Math.floor(((e.clientX - box.left) / box.width) * list.length)
    onPick(list[Math.max(0, Math.min(list.length - 1, i))])
  }
  const v = valueOf(shown)
  const avg = avgOf(shown)
  const range = targets[shown]?.[row.key]
  const bar = v && targetBar(v, range, pos)
  const labelled = [0, Math.floor((list.length - 1) / 2), list.length - 1]

  return (
    <section className="tg">
      <h3>
        {row.label} <small className="muted">{row.unit}</small>
        <span className="tg-key"><svg viewBox="0 0 16 8" aria-hidden="true"><path d="M0 4 H16" /></svg>7-day average</span>
      </h3>
      <div className="tg-chart">
        <div className="tg-y" aria-hidden="true">
          {grid.map((t) => <span key={t} style={{ bottom: `${pos(t)}%` }}>{fmt(t, digits)}</span>)}
        </div>
        <div className="tg-plot" role="img" aria-label={`${row.label} per day`} onPointerDown={pick} onPointerMove={(e) => e.pointerType === 'mouse' && pick(e)}>
          {list.map((d) => <Column key={d} val={valueOf(d)} range={targets[d][row.key]} pos={pos} picked={d === shown} />)}
          {grid.map((t) => <div key={t} className="tg-grid" style={{ bottom: `${pos(t)}%` }} />)}
          <WeekOverlay list={list} avgOf={avgOf} pos={pos} />
        </div>
        <div className="tg-x" aria-hidden="true">
          {labelled.map((i) => (
            <span key={i} style={{ left: `${((i + 0.5) / list.length) * 100}%` }}>{list[i].slice(5)}</span>
          ))}
        </div>
      </div>
      <p className="tg-readout" role="button" tabIndex={0} onClick={() => v && go(`/breakdown/${row.key}?from=${shown}&to=${shown}&win=daily`)}>
        <span className="muted">{shown && prettyDay(shown)} · </span>
        {v ? (
          <>
            <b className={row.cls}>{v.estimated ? '~' : ''}{fmt(v.value, 0)}</b> {row.unit} {pmText(v)}
            {sdOf(v) > 0 && <span className="err-range"> ({rangeText(v)})</span>}
          </>
        ) : <span className="muted">no consumptions</span>}
        {range && (Number.isFinite(range.min) || Number.isFinite(range.max)) && (
          <span className={`bar-label ${bar?.status ?? ''}`}> · {rangeLabel(range)} {bar ? statusMark(bar.status) : ''}</span>
        )}
        <br />
        <span className="muted">7-day average · </span>
        {avg ? (
          <>
            <b className="tg-avg">{avg.estimated ? '~' : ''}{fmt(avg.value, 0)}</b> {row.unit} {pmText(avg)}
            {sdOf(avg) > 0 && <span className="err-range"> ({rangeText(avg)})</span>}
          </>
        ) : <span className="muted">no consumptions</span>}
      </p>
    </section>
  )
}

/**
 * The 7-day average over the columns: a line through the estimates, and at each day an error bar (its interval)
 * with short caps. Drawn in column units across, % of the plot up; strokes keep their width when stretched.
 */
function WeekOverlay({ list, avgOf, pos }) {
  const pts = list.map((d, i) => {
    const a = avgOf(d)
    if (!a) return null
    const [lo, hi] = bounds(a)
    return { x: i + 0.5, y: 100 - pos(a.value), lo: 100 - pos(lo), hi: 100 - pos(hi) }
  })
  // The line breaks where a day has no average (7 days without consumptions).
  const runs = [[]]
  for (const p of pts) p ? runs.at(-1).push(p) : runs.push([])
  const line = runs.filter((r) => r.length).map((r) => r.map((p, j) => `${j ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')).join(' ')
  const cap = Math.min(0.3, 0.3 * (list.length / 30)) // narrower relative to a column when columns are wide
  const bars = pts.filter((p) => p && p.lo > p.hi)
    .map((p) => `M ${p.x} ${p.lo} V ${p.hi} M ${p.x - cap} ${p.lo} H ${p.x + cap} M ${p.x - cap} ${p.hi} H ${p.x + cap}`).join(' ')
  return (
    <svg className="tg-week" viewBox={`0 0 ${list.length} 100`} preserveAspectRatio="none" aria-hidden="true">
      <path className="tg-week-halo" d={`${bars} ${line}`} />
      <path className="tg-week-bars" d={bars} />
      <path className="tg-week-line" d={line} />
    </svg>
  )
}

/** A day: the target's regions, and the fill when it has consumptions. Heights in % of the plot. */
function Column({ val, range, pos, picked }) {
  const target = targetBar(val ?? zero(), range, pos)
  const minAt = target?.minAt
  const maxAt = target?.maxAt
  let bar = val && target
  if (val && !bar) {
    const [lo, hi] = bounds(val)
    bar = { fill: pos(val.value), minAt: null, maxAt: null, status: 'none', dummy: true, errLo: hi > lo ? pos(lo) : null, errHi: hi > lo ? pos(hi) : null }
  }
  return (
    <div className={`tg-col ${picked ? 'picked' : ''}`}>
      {minAt != null && <div className="zone under" style={{ bottom: 0, height: `${minAt}%` }} />}
      {target && <div className="zone ok" style={{ bottom: `${minAt ?? 0}%`, height: `${(maxAt ?? 100) - (minAt ?? 0)}%` }} />}
      {maxAt != null && <div className="zone over" style={{ bottom: `${maxAt}%`, height: `${100 - maxAt}%` }} />}
      {bar && fillPieces(bar).map((pc, i) => (
        <div key={i} className={`${pc.hatched ? 'bar-err' : 'bar-fill'} r-${pc.region}`} style={{ bottom: `${pc.from}%`, height: `${pc.to - pc.from}%` }} />
      ))}
      {bar && hasMean(bar) && <div className="tg-mean" style={{ bottom: `${bar.fill}%` }} />}
    </div>
  )
}
