import { Fragment, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Dexie from 'dexie'
import { db, getConfig, getCurrentUser } from '../db'
import { averageTargets, consumptionNutrients, loadContext, perDay, sumNutrients, targetBar, weeklyCorrection } from '../calc'
import { NUTRIENTS, calories, fmt, pmText, rangeLabel, rangeText } from '../nutrients'
import { bounds, sdOf, zero } from '../stats'
import { addDays, dayBounds, logicalDay, prettyDay } from '../time'
import { Screen, go, replace, useToday } from '../components'
import { dailyWeights, weekWeight } from '../weight'
import { ROWS, fillPieces, hasMean, statusMark } from './Home'

// Time graphs: per nutrient on the dashboard, one column per day, back to back. Each column is a dashboard bar
// standing up: the day's target as tinted regions (below min, within, above max), the fill solid up to the low end
// of the day's interval and hatched from there to its high end, each piece in its region's colour, and a white tick
// at the estimate. Calories use the day's weekly-corrected target, as the daily dashboard did that day.
// A day without consumptions is no data: its target shows, no fill.
// Over the columns, the 7-day average: per day, the per-day average over it and the 6 days before (those with
// consumptions, as the dashboard's windows): its interval as a dark grey band between two lines.
// Weight, once there are weigh-ins, comes right after calories: a dot per day weighed and its 7-day average the same
// way (the mean of the days weighed, ± its standard error), on a scale fitted to the weights rather than from 0.

// Days shown: the slider covers up to MAX_SLIDER; the box takes up to MAX_DAYS.
const DEFAULT_DAYS = 30
const MAX_SLIDER = 180
const MAX_DAYS = 730

/** Ticks at 1/2/5 × 10^k strictly between `lo` and `hi`: the finest step that gives at most four. */
function ticks(lo, hi) {
  if (!(hi > lo)) return { step: 1, list: [] }
  const p = 10 ** Math.floor(Math.log10((hi - lo) / 4))
  const count = (s) => Math.ceil(hi / s - 1e-9) - Math.floor(lo / s + 1e-9) - 1
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => count(s) <= 4)
  const list = []
  for (let t = (Math.floor(lo / step + 1e-9) + 1) * step; t < hi - 1e-9; t += step) list.push(t)
  return { step, list }
}

/** `days` (how many) and `end` (the last day shown; none = today) live in the URL, like the dashboard's view. */
export default function Graphs({ days: daysParam, end: endParam }) {
  const span = Number.isInteger(Number(daysParam)) && daysParam >= 1 && daysParam <= MAX_DAYS ? Number(daysParam) : DEFAULT_DAYS
  const day = useToday()
  const last = endParam && day && endParam < day ? endParam : day
  const setView = (n, e) => {
    const qs = new URLSearchParams({ ...(n !== DEFAULT_DAYS && { days: n }), ...(e && day && e < day && { end: e }) }).toString()
    replace(`/graphs${qs ? `?${qs}` : ''}`)
  }
  // The box's text while typing; the URL follows each valid number.
  const [text, setText] = useState(String(span))
  const setSpan = (n) => setView(n, last)
  const onType = (t) => {
    setText(t)
    const n = Number(t)
    if (Number.isInteger(n) && n >= 1 && n <= MAX_DAYS) setSpan(n)
  }
  // Sliding a chart moves every chart: `cols` columns from where the drag started (right = earlier days).
  const panFrom = useRef(null)
  const pan = (cols, done) => {
    panFrom.current ??= last
    const e = addDays(panFrom.current, -cols)
    setView(span, e < day ? e : day)
    if (done) panFrom.current = null
  }
  const [sel, setSel] = useState(null)

  const data = useLiveQuery(async () => {
    if (!last) return null
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
    // Weigh-ins over the same days; none ever: no weight chart.
    const anyWeight = await db.weights.where('[userId+datetime]').between([user.id, Dexie.minKey], [user.id, Dexie.maxKey]).first()
    const weighIns = await db.weights.where('[userId+datetime]').between([user.id, from.toISOString()], [user.id, end.toISOString()], true, false).toArray()
    const daily = dailyWeights(weighIns, config.dayStart)
    const weight = anyWeight && { daily, week: Object.fromEntries([addDays(first, -1), ...list].map((d) => [d, weekWeight(daily, d)])) }
    return { list, totals, week, targets, weight, rows: [...ROWS, ...extra] }
  }, [last, span])

  const shown = sel && data?.list.includes(sel) ? sel : data?.list.at(-1)
  return (
    <Screen className="graphs" title="Time graphs" subtitle={data ? `${data.list[0]} → ${data.list.at(-1)} · daily` : ''}>
      <div className="tg-days">
        <input type="range" min="1" max={MAX_SLIDER} value={Math.min(span, MAX_SLIDER)} aria-label="Days"
          onChange={(e) => { setText(e.target.value); setSpan(Number(e.target.value)) }} />
        <input inputMode="numeric" value={text} aria-label="Days" onChange={(e) => onType(e.target.value)}
          onBlur={() => setText(String(span))} />
        <span className="muted">days</span>
        <button className="secondary tg-today" onClick={() => setView(span)} disabled={last === day}>Today</button>
      </div>
      {data?.rows.map((r) => (
        <Fragment key={r.key}>
          <TimeChart row={r} data={data} shown={shown} onPick={setSel} onPan={pan} />
          {r.key === 'energy' && data.weight && <WeightChart list={data.list} weight={data.weight} shown={shown} onPick={setSel} onPan={pan} />}
        </Fragment>
      ))}
    </Screen>
  )
}

/**
 * A plot's pointer handlers. A tap picks a day; a drag sideways (past a few pixels) slides the days, a column per
 * column width. A mouse picks on hover too.
 */
function usePlotPointer(list, onPick, onPan) {
  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const i = Math.floor(((e.clientX - box.left) / box.width) * list.length)
    onPick(list[Math.max(0, Math.min(list.length - 1, i))])
  }
  const drag = useRef(null)
  const cols = (e) => Math.round((e.clientX - drag.current.x) / drag.current.w)
  const up = (e) => {
    if (!drag.current) return
    if (drag.current.moved) onPan(cols(e), true)
    else if (e.type === 'pointerup') pick(e)
    drag.current = null
  }
  return {
    onPointerDown: (e) => {
      drag.current = { x: e.clientX, w: e.currentTarget.getBoundingClientRect().width / list.length, moved: false }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e) => {
      if (!drag.current) return e.pointerType === 'mouse' && pick(e)
      if (!drag.current.moved && Math.abs(e.clientX - drag.current.x) > 6) drag.current.moved = true
      if (drag.current.moved) onPan(cols(e), false)
    },
    onPointerUp: up,
    onPointerCancel: up,
  }
}

/** Weight over the days: a dot per day weighed, the 7-day average band, on a scale fitted to them. */
function WeightChart({ list, weight, shown, onPick, onPan }) {
  const { daily, week } = weight
  const avgOf = (d) => week[d]
  // The scale: the weights and the average's interval in view (the day before the first too), with a margin, at
  // least 2 kg tall.
  const vals = []
  for (const d of [addDays(list[0], -1), ...list]) {
    if (daily[d] != null && d >= list[0]) vals.push(daily[d])
    if (week[d]) vals.push(...bounds(week[d]))
  }
  let lo = vals.length ? Math.min(...vals) : 0
  let hi = vals.length ? Math.max(...vals) : 0
  const pad = Math.max(0.1 * (hi - lo), (2 - (hi - lo)) / 2)
  lo -= pad
  hi += pad
  const pos = (x) => Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100))
  const { step, list: grid } = ticks(vals.length ? lo : 0, vals.length ? hi : 0)
  const digits = step < 1 ? Math.ceil(-Math.log10(step)) : 0
  const pointer = usePlotPointer(list, onPick, onPan)
  const labelled = [0, Math.floor((list.length - 1) / 2), list.length - 1]
  const kg = daily[shown]
  const avg = avgOf(shown)

  return (
    <section className="tg">
      <h3>
        Weight <small className="muted">kg</small>
        <span className="tg-key"><svg viewBox="0 0 16 10" aria-hidden="true"><rect x="0" y="1" width="16" height="8" /><path d="M0 1 H16 M0 9 H16" /></svg>7-day average</span>
      </h3>
      <div className="tg-chart">
        <div className="tg-y" aria-hidden="true">
          {grid.map((t) => <span key={t} style={{ bottom: `${pos(t)}%` }}>{fmt(t, digits)}</span>)}
        </div>
        <div className="tg-plot" role="img" aria-label="Weight per day" {...pointer}>
          {list.map((d) => (
            <div key={d} className={`tg-col ${d === shown ? 'picked' : ''}`}>
              {daily[d] != null && <div className="tg-dot" style={{ bottom: `${pos(daily[d])}%` }} />}
            </div>
          ))}
          {grid.map((t) => <div key={t} className="tg-grid" style={{ bottom: `${pos(t)}%` }} />)}
          <WeekOverlay list={list} avgOf={avgOf} pos={pos} />
        </div>
        <div className="tg-x" aria-hidden="true">
          {labelled.map((i) => (
            <span key={i} style={{ left: `${((i + 0.5) / list.length) * 100}%` }}>{list[i].slice(5)}</span>
          ))}
        </div>
      </div>
      <p className="tg-readout">
        <span className="muted">{shown && prettyDay(shown)} · </span>
        {kg != null ? <><b>{Math.round(kg * 100) / 100}</b> kg</> : <span className="muted">no weigh-in</span>}
        <br />
        <span className="muted">7-day average · </span>
        {avg ? (
          <>
            <b className="tg-avg">{fmt(avg.value, 2)}</b> kg {avg.v > 0 && <>{pmText(avg, 2)} <span className="err-range">({rangeText(avg, 1)})</span></>}
          </>
        ) : <span className="muted">no weigh-ins</span>}
      </p>
    </section>
  )
}

/** One nutrient over the days: the columns, a y axis, a few dates, and the picked day spelled out underneath. */
function TimeChart({ row, data, shown, onPick, onPan }) {
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
  const { step, list: grid } = ticks(0, top > 0 ? full : 0) // nothing to measure: no gridlines
  const digits = step < 1 ? Math.ceil(-Math.log10(step)) : 0

  const pointer = usePlotPointer(list, onPick, onPan)
  const v = valueOf(shown)
  const avg = avgOf(shown)
  const range = targets[shown]?.[row.key]
  const bar = v && targetBar(v, range, pos)
  const labelled = [0, Math.floor((list.length - 1) / 2), list.length - 1]

  return (
    <section className="tg">
      <h3>
        {row.label} <small className="muted">{row.unit}</small>
        <span className="tg-key"><svg viewBox="0 0 16 10" aria-hidden="true"><rect x="0" y="1" width="16" height="8" /><path d="M0 1 H16 M0 9 H16" /></svg>7-day average</span>
      </h3>
      <div className="tg-chart">
        <div className="tg-y" aria-hidden="true">
          {grid.map((t) => <span key={t} style={{ bottom: `${pos(t)}%` }}>{fmt(t, digits)}</span>)}
        </div>
        <div className="tg-plot" role="img" aria-label={`${row.label} per day`} {...pointer}>
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
 * The 7-day average over the columns: its interval as two lines, low and high ends joined straight from day to day,
 * and dark grey filled between them. Drawn in column units across, % of the plot up; strokes keep their width
 * when stretched.
 */
function WeekOverlay({ list, avgOf, pos }) {
  // The day before the first is in too, half a column left of the plot (which clips it): the band enters at the edge.
  const pts = [addDays(list[0], -1), ...list].map((d, i) => {
    const a = avgOf(d)
    if (!a) return null
    const [lo, hi] = bounds(a)
    return { x: i - 0.5, lo: 100 - pos(lo), hi: 100 - pos(hi) }
  })
  // Breaks where a day has no average (7 days without consumptions).
  const runs = [[]]
  for (const p of pts) p ? runs.at(-1).push(p) : runs.push([])
  const path = (r, k) => r.map((p, j) => `${j ? 'L' : 'M'} ${p.x} ${p[k]}`).join(' ')
  const kept = runs.filter((r) => r.length)
  const band = kept.map((r) => `${path(r, 'hi')} ${path([...r].reverse(), 'lo').replace('M', 'L')} Z`).join(' ')
  const edges = kept.map((r) => `${path(r, 'hi')} ${path(r, 'lo')}`).join(' ')
  return (
    <svg className="tg-week" viewBox={`0 0 ${list.length} 100`} preserveAspectRatio="none" aria-hidden="true">
      <path className="tg-week-band" d={band} />
      <path className="tg-week-edge" d={edges} />
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
