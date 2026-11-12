import { Fragment, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { targetBar } from '../calc'
import { fmt, pmText, rangeLabel, rangeText } from '../nutrients'
import { bounds, sdOf } from '../stats'
import { addDays, prettyDay } from '../time'
import { Screen, go, replace, useToday } from '../components'
import { statusMark } from '../dashboard'
import { DEFAULT_DAYS, MAX_DAYS, SLIDER_STOPS, columnShapes, loadGraphs, measureScale, nutrientScale, spanOf, stopDays, stopIndex, weekPoints } from '../graphs'
import { t } from '../i18n'

// Time graphs: per nutrient on the dashboard, one column per day, back to back. Each column: the day's target range
// in light green; the day's interval hatched, green within the range and red outside it (nothing below it); a white
// tick at the estimate (graphs.js columnShapes). Calories use the day's weekly-corrected target, as the daily dashboard did that day.
// A day without consumptions is no data: its target shows, no fill.
// Over the columns, the 7-day average: per day, the per-day average over it and the 6 days before (those with
// consumptions, as the dashboard's windows): its interval as a dark grey band between two lines.
// Body measurements come right after calories, one chart each that has ever been measured (weight, body fat, lean
// mass, muscle, waist, the user's own): a dot per day measured with its error bar, and its 7-day average the same
// way as above (body.js weekMean), on a scale fitted to the values rather than from 0. Data and scales: graphs.js.

/** `days` (how many) and `end` (the last day shown; none = today) live in the URL, like the dashboard's view. */
export default function Graphs({ days: daysParam, end: endParam }) {
  const span = spanOf(daysParam)
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
  const stop = last ? stopIndex(span, last) : 0

  const data = useLiveQuery(async () => (last ? loadGraphs(last, span) : null), [last, span])

  const shown = sel && data?.list.includes(sel) ? sel : data?.list.at(-1)
  return (
    <Screen className="graphs" title={t('Time graphs')} subtitle={data ? `${data.list[0]} → ${data.list.at(-1)} · ${t('daily')}` : ''}>
      <div className="tg-days">
        {/* Stops (graphs.js SLIDER_STOPS): 12 months on the left, down to 1 day on the right. */}
        <input type="range" min="0" max={SLIDER_STOPS.length - 1} value={stop} aria-label={t('Days')}
          aria-valuetext={t(SLIDER_STOPS[stop].label)} disabled={!last}
          onChange={(e) => { const n = stopDays(SLIDER_STOPS[Number(e.target.value)], last); setText(String(n)); setSpan(n) }} />
        <input inputMode="numeric" value={text} aria-label={t('Days')} onChange={(e) => onType(e.target.value)}
          onBlur={() => setText(String(span))} />
        <span className="muted">{t('days')}</span>
        <button className="secondary tg-today" onClick={() => setView(span)} disabled={last === day}>{t('Today')}</button>
      </div>
      {data?.rows.map((r) => (
        <Fragment key={r.key}>
          <TimeChart row={r} data={data} shown={shown} onPick={setSel} onPan={pan} />
          {r.key === 'energy' && data.measures.map((m) => <MeasureChart key={m.key} list={data.list} measure={m} shown={shown} onPick={setSel} onPan={pan} />)}
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

/**
 * A body measurement over the days: a dot per day measured with its interval as a bar, the 7-day average band, on a
 * scale fitted to them.
 */
function MeasureChart({ list, measure, shown, onPick, onPan }) {
  const { label, unit, daily } = measure
  const { avgOf, pos, grid, digits } = measureScale(measure, list)
  const pointer = usePlotPointer(list, onPick, onPan)
  const labelled = [...new Set([0, Math.floor((list.length - 1) / 2), list.length - 1])]
  const x = daily[shown]
  const avg = avgOf(shown)

  return (
    <section className="tg">
      <h3>
        {label} <small className="muted">{unit}</small>
        <span className="tg-key"><svg viewBox="0 0 16 10" aria-hidden="true"><rect x="0" y="1" width="16" height="8" /><path d="M0 1 H16 M0 9 H16" /></svg>{t('7-day average')}</span>
      </h3>
      <div className="tg-chart">
        <div className="tg-y" aria-hidden="true">
          {grid.map((t) => <span key={t} style={{ bottom: `${pos(t)}%` }}>{fmt(t, digits)}</span>)}
        </div>
        <div className="tg-plot" role="img" aria-label={t('{name} per day', { name: label })} {...pointer}>
          {list.map((d) => (
            <div key={d} className={`tg-col ${d === shown ? 'picked' : ''}`}>
              {daily[d] && <Dot val={daily[d]} pos={pos} />}
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
        {x ? (
          <>
            <b>{fmt(x.value, 2)}</b> {unit} {x.v > 0 && <>{pmText(x, 2)} <span className="err-range">({rangeText(x, 1)})</span></>}
          </>
        ) : <span className="muted">{t('not measured')}</span>}
        <br />
        <span className="muted">{t('7-day average')} · </span>
        {avg ? (
          <>
            <b className="tg-avg">{fmt(avg.value, 2)}</b> {unit} {avg.v > 0 && <>{pmText(avg, 2)} <span className="err-range">({rangeText(avg, 1)})</span></>}
          </>
        ) : <span className="muted">{t('none')}</span>}
      </p>
    </section>
  )
}

/** A day's measurement: a dot, and its interval as a thin bar through it. */
function Dot({ val, pos }) {
  const [lo, hi] = bounds(val)
  return (
    <>
      {hi > lo && <div className="tg-whisker" style={{ bottom: `${pos(lo)}%`, height: `${pos(hi) - pos(lo)}%` }} />}
      <div className="tg-dot" style={{ bottom: `${pos(val.value)}%` }} />
    </>
  )
}

/** One nutrient over the days: the columns, a y axis, a few dates, and the picked day spelled out underneath. */
function TimeChart({ row, data, shown, onPick, onPan }) {
  const { list, targets } = data
  const { valueOf, avgOf, pos, grid, digits } = nutrientScale(row, data)

  const pointer = usePlotPointer(list, onPick, onPan)
  const v = valueOf(shown)
  const avg = avgOf(shown)
  const range = targets[shown]?.[row.key]
  const bar = v && targetBar(v, range, pos)
  const labelled = [...new Set([0, Math.floor((list.length - 1) / 2), list.length - 1])]

  return (
    <section className="tg">
      <h3>
        {row.label} <small className="muted">{row.unit}</small>
        <span className="tg-key"><svg viewBox="0 0 16 10" aria-hidden="true"><rect x="0" y="1" width="16" height="8" /><path d="M0 1 H16 M0 9 H16" /></svg>{t('7-day average')}</span>
      </h3>
      <div className="tg-chart">
        <div className="tg-y" aria-hidden="true">
          {grid.map((t) => <span key={t} style={{ bottom: `${pos(t)}%` }}>{fmt(t, digits)}</span>)}
        </div>
        <div className="tg-plot" role="img" aria-label={t('{name} per day', { name: row.label })} {...pointer}>
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
        ) : <span className="muted">{t('no consumptions')}</span>}
        {range && (Number.isFinite(range.min) || Number.isFinite(range.max)) && (
          <span className={`bar-label ${bar?.status ?? ''}`}> · {rangeLabel(range)} {bar ? statusMark(bar.status) : ''}</span>
        )}
        <br />
        <span className="muted">{t('7-day average')} · </span>
        {avg ? (
          <>
            <b className="tg-avg">{avg.estimated ? '~' : ''}{fmt(avg.value, 0)}</b> {row.unit} {pmText(avg)}
            {sdOf(avg) > 0 && <span className="err-range"> ({rangeText(avg)})</span>}
          </>
        ) : <span className="muted">{t('no consumptions')}</span>}
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
  const pts = weekPoints(list, avgOf, pos)
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

/** A day (graphs.js columnShapes): the target's range, light; the estimate's interval, hatched; its tick. */
function Column({ val, range, pos, picked }) {
  const { zones, pieces, mean } = columnShapes(val, range, pos)
  return (
    <div className={`tg-col ${picked ? 'picked' : ''}`}>
      {zones.map((z, i) => <div key={i} className={`zone ${z.region}`} style={{ bottom: `${z.from}%`, height: `${z.to - z.from}%` }} />)}
      {pieces.map((pc, i) => (
        <div key={i} className={`bar-err r-${pc.region}`} style={{ bottom: `${pc.from}%`, height: `${pc.to - pc.from}%` }} />
      ))}
      {mean != null && <div className="tg-mean" style={{ bottom: `${mean}%` }} />}
    </div>
  )
}
