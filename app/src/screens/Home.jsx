import { useId, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportAll, getConfig, importAll } from '../db'
import { consumptionNutrients, loadContext, sumNutrients, targetBar, windowTargets } from '../calc'
import { NUTRIENTS, calories, fmt, rangeLabel } from '../nutrients'
import { WINDOWS, dayBounds, prettyDay, toDateStr, toLocalInput, today, windowDays } from '../time'
import { go } from '../components'

// Always shown; any other nutrient gets a row when a target covers it.
const ROWS = [
  { key: 'energy', label: 'Calories', unit: 'kcal', cls: 'c-kcal' },
  { key: 'proteins', label: 'Protein', unit: 'g', cls: 'c-prot' },
  { key: 'fat', label: 'Fat', unit: 'g', cls: 'c-fat' },
  { key: 'carbohydrates', label: 'Carbs', unit: 'g', cls: 'c-carb' },
]

// Mandatory rows without a target still get a neutral, full bar/gauge (no regions, markers or label).
const DUMMY = { fill: 100, minAt: null, maxAt: null, status: 'none', dummy: true }
const barFor = (row, val, range) => targetBar(val.value, range, val.delta) ?? (ROWS.some((r) => r.key === row.key) ? DUMMY : null)

function windowTitle(win, first, last) {
  if (win === 'daily') return `Today · ${prettyDay(first)}`
  if (win === 'weekly') return `This week · ${first.slice(5)} → ${last.slice(5)}`
  const [y, m] = first.split('-').map(Number)
  return `This month · ${new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
}

// --- Fill pieces ---------------------------------------------------------------
// The fill (solid up to value − Δ, hatched from there to value + Δ) is cut at the min and max, and each piece takes
// the colour of the region it lies in: under (below min), ok, over (above max). A bar without a target: one grey piece.

const regionAt = (bar, x) => (bar.dummy ? 'none' : bar.minAt != null && x < bar.minAt ? 'under' : bar.maxAt != null && x > bar.maxAt ? 'over' : 'ok')

/** [{from, to, region, hatched}] covering 0 → end of the fill, in % of the bar. */
function fillPieces(bar) {
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
const fillEnd = (bar) => (bar.errLo != null ? bar.errHi : bar.fill)

// --- Gauge -------------------------------------------------------------------
// Semicircle version of the target bar: same scale (targetBar), tinted regions (no min/max markers; the colours
// alone show them), fill coloured per region (see fillPieces). Without a target it keeps its space but draws nothing.

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
// The fill is solid up to value − Δ; the error range (value ± Δ) continues it as one hatched band: the fill colour,
// see-through, with slightly slanted lines in a lighter solid shade. The lines follow the arc, so the slant is the
// same all round: each goes from the inner edge at p to the outer edge a little further along.
const HATCH_STEP = 3.2 // arc length between lines (viewBox units)
const HATCH_SLANT = 2.2 // how far along the arc a line's outer end leans
function hatch(p0, p1) {
  const len = Math.PI * G.r
  const d = []
  for (let s = p0 * len - HATCH_SLANT; s < p1 * len; s += HATCH_STEP) {
    const [x0, y0] = pt(s / len, G.r - G.w / 2)
    const [x1, y1] = pt((s + HATCH_SLANT) / len, G.r + G.w / 2)
    d.push(`M ${x0} ${y0} L ${x1} ${y1}`)
  }
  return d.join(' ')
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
        {bar && !bar.dummy && <path className="g-zone ok" d={arc(lo(f(bar.minAt)), hi(bar.maxAt != null ? f(bar.maxAt) : 1))} />}
        {bar?.maxAt != null && bar.maxAt < 100 && <path className="g-zone over" d={arc(f(bar.maxAt), 1 + OVER)} />}
      </g>
      {bar && fillEnd(bar) > 0 && (
        <>
          {/* The whole fill's shape: round-ended from 0 to its end. Pieces are square-ended and cut to it. */}
          <mask id={`${maskId}-fill`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="66">
            <path d={arc(0, f(fillEnd(bar)))} className="g-fill-mask" />
          </mask>
          <g mask={`url(#${maskId}-fill)`}>
            {fillPieces(bar).map((pc, i, all) => {
              // The first and last pieces overshoot so the mask's round ends are filled.
              const p0 = i === 0 ? -OVER : f(pc.from)
              const p1 = i === all.length - 1 ? f(pc.to) + OVER : f(pc.to)
              if (!pc.hatched) return <path key={i} className={`g-fill r-${pc.region}`} d={arc(p0, p1)} />
              // Hatch lines are cut to their piece with a mask (a clipPath would use the arc's fill, not its stroke).
              const id = `${maskId}-p${i}`
              return (
                <g key={i} className={`g-err r-${pc.region}`}>
                  <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="66">
                    <path d={arc(f(pc.from), p1)} className="g-err-mask" />
                  </mask>
                  <g mask={`url(#${id})`}>
                    <path className="g-err-bg" d={arc(f(pc.from), p1)} />
                    <path className="g-err-lines" d={hatch(f(pc.from), p1)} />
                  </g>
                </g>
              )
            })}
          </g>
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
      {bar && !bar.dummy ? <>{rangeLabel(range)} {unit} {statusMark(bar.status)}</> : '\u00a0'}
    </span>
  )
}

/** Dashboard style "bars": one full-width row per nutrient with a horizontal bar over tinted regions. */
function BarRow({ row: r, val, range }) {
  const bar = barFor(r, val, range)
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
                {!bar.dummy && <div className="zone ok" style={{ left: `${bar.minAt ?? 0}%`, width: `${(bar.maxAt ?? 100) - (bar.minAt ?? 0)}%` }} />}
                {bar.maxAt != null && <div className="zone over" style={{ left: `${bar.maxAt}%`, width: `${100 - bar.maxAt}%` }} />}
                {/* The fill's shape (round-ended, 0 → end); pieces inside are placed in % of it. */}
                <div className="bar-fillbox" style={{ width: `${fillEnd(bar)}%` }}>
                  {fillPieces(bar).map((pc, i) => {
                    const end = fillEnd(bar)
                    const style = { left: `${(pc.from / end) * 100}%`, width: `${((pc.to - pc.from) / end) * 100}%` }
                    return <div key={i} className={`${pc.hatched ? 'bar-err' : 'bar-fill'} r-${pc.region}`} style={style} />
                  })}
                </div>
              </div>
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
  const bar = barFor(r, val, range)
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
    const results = logs.map((l) => consumptionNutrients(ctx, l))
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
    // Local date and time to the second; dashes, since ":" isn't allowed in filenames everywhere.
    const now = new Date()
    const name = `food-tracker-${toDateStr(now)}_${toLocalInput(now).slice(11).replace(':', '-')}-${String(now.getSeconds()).padStart(2, '0')}.json`
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
