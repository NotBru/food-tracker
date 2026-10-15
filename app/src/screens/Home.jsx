import { useId, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportAll, getConfig, importAll } from '../db'
import { loadContext, nutrientsFor, sumNutrients, targetBar, windowTargets } from '../calc'
import { NUTRIENTS, calories, fmt, rangeLabel } from '../nutrients'
import { WINDOWS, dayBounds, prettyDay, today, windowDays } from '../time'
import { go } from '../components'

// Always shown; any other nutrient gets a row when a target covers it.
const ROWS = [
  { key: 'energy', label: 'Calories', unit: 'kcal', cls: 'c-kcal' },
  { key: 'proteins', label: 'Protein', unit: 'g', cls: 'c-prot' },
  { key: 'fat', label: 'Fat', unit: 'g', cls: 'c-fat' },
  { key: 'carbohydrates', label: 'Carbs', unit: 'g', cls: 'c-carb' },
]

function windowTitle(win, first, last) {
  if (win === 'daily') return `Today · ${prettyDay(first)}`
  if (win === 'weekly') return `This week · ${first.slice(5)} → ${last.slice(5)}`
  const [y, m] = first.split('-').map(Number)
  return `This month · ${new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
}

// --- Gauge -------------------------------------------------------------------
// Semicircle version of the target bar: same scale (targetBar), tinted regions, fill in the status colour,
// and a plain line at min/max. Without a target it keeps its space but draws nothing.

const G = { cx: 60, cy: 60, r: 46, w: 10 }
// p in [0, 1] along the arc, left to right over the top.
const pt = (p, r = G.r) => {
  const a = Math.PI * (1 - p)
  return [G.cx + r * Math.cos(a), G.cy - r * Math.sin(a)]
}
const arc = (p0, p1) => {
  const [x0, y0] = pt(p0)
  const [x1, y1] = pt(p1)
  return `M ${x0} ${y0} A ${G.r} ${G.r} 0 ${p1 - p0 > 1 ? 1 : 0} 1 ${x1} ${y1}`
}
// Regions are drawn with square ends, overshooting both ends of the gauge, then masked to the round-ended track.
const OVER = 0.08
// Min/max marker: a plain radial line across the arc, slightly longer than its width.
const tick = (p) => {
  const [x0, y0] = pt(p, G.r - G.w / 2 - 3)
  const [x1, y1] = pt(p, G.r + G.w / 2 + 3)
  return `M ${x0} ${y0} L ${x1} ${y1}`
}

function Gauge({ bar }) {
  const maskId = useId()
  const f = (x) => (x ?? 0) / 100
  const lo = (x) => (x > 0 ? x : -OVER) // a region touching an end overshoots it
  const hi = (x) => (x < 1 ? x : 1 + OVER)
  return (
    <svg className={`gauge ${bar?.status ?? 'none'}`} viewBox="0 0 120 66" aria-hidden="true" style={bar ? undefined : { visibility: 'hidden' }}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="66">
        <path d={arc(0, 1)} className="g-mask" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path className="g-track" d={arc(-OVER, 1 + OVER)} />
        {bar?.minAt > 0 && <path className="g-zone under" d={arc(-OVER, f(bar.minAt))} />}
        {bar && <path className="g-zone ok" d={arc(lo(f(bar.minAt)), hi(bar.maxAt != null ? f(bar.maxAt) : 1))} />}
        {bar?.maxAt != null && bar.maxAt < 100 && <path className="g-zone over" d={arc(f(bar.maxAt), 1 + OVER)} />}
      </g>
      {bar && (
        <>
          {bar.fill > 0 && <path className="g-fill" d={arc(0, f(bar.fill))} />}
          {bar.minAt != null && <path className="g-tick" d={tick(f(bar.minAt))} />}
          {bar.maxAt != null && <path className="g-tick" d={tick(f(bar.maxAt))} />}
        </>
      )}
    </svg>
  )
}

const statusMark = (s) => (s === 'ok' ? '✓' : s === 'under' ? '↓' : '↑')

/** "1800–2200 kcal ✓" line, or a blank line of the same height when there's no target. */
function RangeLine({ bar, range, unit }) {
  return (
    <span className={`bar-label ${bar?.status ?? ''}`}>
      {bar ? <>{rangeLabel(range)} {unit} {statusMark(bar.status)}</> : '\u00a0'}
    </span>
  )
}

/** Dashboard style "bars": one full-width row per nutrient with a horizontal bar and [ ] brackets. */
function BarRow({ row: r, val, range }) {
  const bar = targetBar(val.value, range)
  return (
    <div className="dash-row">
      <span className="dash-label">{r.label}</span>
      <span className={`dash-value ${r.cls}`}>
        {val.estimated ? '~' : ''}{fmt(val.value, 0)}
        <small> {r.unit} ±{fmt(val.delta)}</small>
      </span>
      {/* Without a target the bar keeps its space, so every row is equally spaced. */}
      <div className={`dash-target ${bar ? '' : 'placeholder'}`} aria-hidden={!bar}>
        <div className={`bar ${bar?.status ?? ''}`}>
          {bar && (
            <>
              <div className="bar-track">
                {/* Tinted regions: below min, within range, above max. */}
                {bar.minAt != null && <div className="zone under" style={{ left: 0, width: `${bar.minAt}%` }} />}
                <div className="zone ok" style={{ left: `${bar.minAt ?? 0}%`, width: `${(bar.maxAt ?? 100) - (bar.minAt ?? 0)}%` }} />
                {bar.maxAt != null && <div className="zone over" style={{ left: `${bar.maxAt}%`, width: `${100 - bar.maxAt}%` }} />}
                <div className="bar-fill" style={{ width: `${bar.fill}%` }} />
              </div>
              {bar.minAt != null && <div className="bracket open" style={{ left: `${bar.minAt}%` }} />}
              {bar.maxAt != null && <div className="bracket close" style={{ left: `${bar.maxAt}%` }} />}
            </>
          )}
        </div>
        <RangeLine bar={bar} range={range} unit={r.unit} />
      </div>
    </div>
  )
}

/** Dashboard style "gauges": equal tiles in a 2-column grid, value inside a semicircle gauge. */
function GaugeTile({ row: r, val, range }) {
  const bar = targetBar(val.value, range)
  return (
    <div className="tile">
      <span className="tile-label">{r.label}</span>
      <div className="gauge-wrap">
        <Gauge bar={bar} />
        <span className={`gauge-value ${r.cls}`}>{val.estimated ? '~' : ''}{fmt(val.value, 0)}</span>
      </div>
      <span className="tile-sub">{r.unit} ±{fmt(val.delta)}</span>
      <RangeLine bar={bar} range={range} unit={r.unit} />
    </div>
  )
}

export default function Home() {
  const [winIdx, setWinIdx] = useState(0)
  const win = WINDOWS[winIdx]
  const touchX = useRef(null)
  const fileRef = useRef(null)

  const data = useLiveQuery(async () => {
    const config = await getConfig()
    const [first, last] = windowDays(win, today(config.dayStart))
    const start = dayBounds(first, config.dayStart)[0]
    const end = dayBounds(last, config.dayStart)[1]
    const logs = await db.logs.where('datetime').between(start.toISOString(), end.toISOString(), true, false).toArray()
    const ctx = await loadContext()
    const results = logs.map((l) => nutrientsFor(ctx, l.itemId, l.amount, l.unit))
    const allTargets = await db.targets.toArray()
    const targets = windowTargets(allTargets, first, last, config.dayStart)
    // Every nutrient that any target mentions gets a row, even if no target covers this window.
    const targeted = new Set(allTargets.flatMap((t) => Object.keys(t.values)))
    const extra = NUTRIENTS.filter((n) => targeted.has(n.key) && !ROWS.some((r) => r.key === n.key))
      .map((n) => ({ key: n.key, label: n.label, unit: n.unit, cls: '' }))
    return {
      first, last, count: logs.length, targets, rows: [...ROWS, ...extra], style: config.dashboard,
      failed: results.filter((r) => !r.ok).length,
      total: sumNutrients(results.map((r) => r.nutrients)),
    }
  }, [win])

  const shift = (d) => setWinIdx((i) => (i + d + WINDOWS.length) % WINDOWS.length)
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - (touchX.current ?? 0)
    if (Math.abs(dx) > 40) shift(dx < 0 ? 1 : -1)
  }

  async function doExport() {
    const text = await exportAll()
    const name = `food-tracker-${new Date().toISOString().slice(0, 10)}.json`
    const file = new File([text], name, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return } catch { /* fall back to download */ }
    }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: name })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function doImport(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!confirm('Importing REPLACES all current data with the file contents. Continue?')) return
    try {
      await importAll(await f.text())
      alert('Import done.')
    } catch (err) {
      alert(`Import failed: ${err.message}`)
    }
  }

  return (
    <div className="screen">
      <header
        className="window-header"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={onTouchEnd}
      >
        <button className="icon" onClick={() => shift(-1)} aria-label="Previous window">‹</button>
        <div>
          <div className="win-name">{win}</div>
          <div className="win-range">{data ? windowTitle(win, data.first, data.last) : '…'}</div>
          <div className="dots">{WINDOWS.map((w) => <span key={w} className={w === win ? 'on' : ''} />)}</div>
        </div>
        <button className="icon" onClick={() => shift(1)} aria-label="Next window">›</button>
      </header>

      <main>
        {data && (
          <section className={`dashboard ${data.style}`}>
            {data.rows.map((r) => {
              const n = data.total[r.key]
              const val = r.key === 'energy' ? calories(data.total) : { value: n?.value ?? 0, delta: n?.delta ?? 0 }
              const Item = data.style === 'bars' ? BarRow : GaugeTile
              return <Item key={r.key} row={r} val={val} range={data.targets[r.key]} />
            })}
            <p className="muted">
              {data.count} consumption{data.count === 1 ? '' : 's'}
              {data.failed > 0 && <span className="warn"> · {data.failed} couldn't be computed</span>}
            </p>
          </section>
        )}

        <nav className="menu">
          <button onClick={() => go('/consumptions')}>Consumptions</button>
          <button onClick={() => go('/foods')}>Foods</button>
          <button onClick={() => go('/targets')}>Targets</button>
          <button onClick={() => go('/config')}>Config</button>
          <div className="row">
            <button className="secondary" onClick={() => fileRef.current.click()}>Import databases</button>
            <button className="secondary" onClick={doExport}>Export databases</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
        </nav>
      </main>
    </div>
  )
}
