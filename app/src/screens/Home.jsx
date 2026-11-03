import { useId, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { exportAll, importAll } from '../db'
import { barScale } from '../calc'
import { calories, fmt, pmText, rangeLabel, rangeText } from '../nutrients'
import { bounds, sdOf, zero } from '../stats'
import { WINDOWS, WINDOW_NAMES, addDays, daysBetween, versionStamp } from '../time'
import { barFor, exportFileName, fillEnd, fillPieces, ghostFor, hasMean, loadDashboard, statusMark, windowTitle } from '../dashboard'
import { Chevron, go, replace, useToday } from '../components'
import { getState } from '../backup'
import { SyncStatus } from './Backup'

// What the dashboard loads and its bars' layout are in dashboard.js (shared with the Android app's native screen).

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
// Regions are drawn with square ends, overshooting both ends of the gauge, then masked to the square-ended track.
const OVER = 0.08
// The fill is solid up to the interval's low end; the interval continues it as one hatched band: the fill colour,
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

function Gauge({ bar, ghost }) {
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
          {/* The whole fill's shape: from 0 to its end. Pieces are square-ended and cut to it. */}
          <mask id={`${maskId}-fill`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="66">
            <path d={arc(0, f(fillEnd(bar)))} className="g-fill-mask" />
          </mask>
          <g mask={`url(#${maskId}-fill)`}>
            {fillPieces(bar).map((pc, i, all) => {
              // The first and last pieces overshoot so the mask's ends are filled.
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
          {hasMean(bar) && <path className="g-mean" d={`M ${pt(f(bar.fill), G.r - G.w / 2 - 2)} L ${pt(f(bar.fill), G.r + G.w / 2 + 2)}`} />}
        </>
      )}
      {ghost && ghost.to > ghost.from && <path className="g-ghost" d={arc(ghost.from / 100, ghost.to / 100)} />}
    </svg>
  )
}

/** The interval on its own line, under "unit ±x"; a blank line of the same height when there's no error. */
const ErrRange = ({ val }) => <span className="err-range">{sdOf(val) > 0 ? rangeText(val) : '\u00a0'}</span>
const enterOpen = (open) => (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())

/** "1800–2200 kcal ✓" line, or a blank line of the same height when there's no target. */
function RangeLine({ bar, range, unit }) {
  return (
    <span className={`bar-label ${bar?.status ?? ''}`}>
      {bar && !bar.dummy ? <>{rangeLabel(range)} {unit} {statusMark(bar.status)}</> : '\u00a0'}
    </span>
  )
}

/**
 * Calories only, with a max in the target: what's left to eat, against the high end of what was eaten so far.
 * One short label either way (a tile cuts long text): negative = over budget.
 */
function Budget({ row, val, range }) {
  if (row.key !== 'energy' || !Number.isFinite(range?.max)) return null
  const left = range.max - bounds(val)[1]
  return (
    <span className={`budget ${left > 0 ? '' : 'over'}`}>
      Δ Budget: <b>{left < 0 ? '−' : ''}{fmt(Math.abs(left), 0)}</b> {row.unit}
    </span>
  )
}

/** Dashboard style "bars": one full-width row per nutrient with a horizontal bar over tinted regions. */
function BarRow({ row: r, val, range, adj, onOpen }) {
  const bar = barFor(r, val, range)
  const ghost = ghostFor(r, val, range, adj)
  // Mouse hover over a bar with a target: the amount under the cursor, in % of the bar's width.
  const [hover, setHover] = useState(null)
  const onHover = (e) => {
    if (e.pointerType !== 'mouse' || !bar || bar.dummy) return
    const box = e.currentTarget.getBoundingClientRect()
    setHover(Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100)))
  }
  return (
    <div className="dash-row" role="button" tabIndex={0} onClick={onOpen} onKeyDown={enterOpen(onOpen)}>
      <span className="dash-label">{r.label}</span>
      <span className={`dash-value ${r.cls}`}>
        {val.estimated ? '~' : ''}{fmt(val.value, 0)}
        <small> {r.unit} {pmText(val)}</small>
        <ErrRange val={val} />
      </span>
      {/* Without a target the bar keeps its space, so every row is equally spaced. */}
      <div className={`dash-target ${bar ? '' : 'placeholder'}`} aria-hidden={!bar}>
        <div className={`bar ${bar?.status ?? ''}`} onPointerMove={onHover} onPointerLeave={() => setHover(null)}>
          {bar && (
            <>
              <div className="bar-track">
                {/* Tinted regions: below min, within range, above max. */}
                {bar.minAt != null && <div className="zone under" style={{ left: 0, width: `${bar.minAt}%` }} />}
                {!bar.dummy && <div className="zone ok" style={{ left: `${bar.minAt ?? 0}%`, width: `${(bar.maxAt ?? 100) - (bar.minAt ?? 0)}%` }} />}
                {bar.maxAt != null && <div className="zone over" style={{ left: `${bar.maxAt}%`, width: `${100 - bar.maxAt}%` }} />}
                {/* The fill's shape (0 → end); pieces inside are placed in % of it. */}
                <div className="bar-fillbox" style={{ width: `${fillEnd(bar)}%` }}>
                  {fillPieces(bar).map((pc, i) => {
                    const end = fillEnd(bar)
                    const style = { left: `${(pc.from / end) * 100}%`, width: `${((pc.to - pc.from) / end) * 100}%` }
                    return <div key={i} className={`${pc.hatched ? 'bar-err' : 'bar-fill'} r-${pc.region}`} style={style} />
                  })}
                </div>
              </div>
              {hasMean(bar) && <div className="bar-mean" style={{ left: `${bar.fill}%` }} />}
              {ghost && <div className="bar-ghost" style={{ left: `${ghost.from}%`, width: `${ghost.to - ghost.from}%` }} />}
              {hover != null && (
                <div className="bar-hover" style={{ left: `${hover}%` }}>
                  <span className="bar-tip">{fmt(barScale(range, val).at(hover), 0)} {r.unit}</span>
                </div>
              )}
            </>
          )}
        </div>
        <RangeLine bar={bar} range={range} unit={r.unit} />
        <Budget row={r} val={val} range={range} />
      </div>
    </div>
  )
}

/** Dashboard style "gauges": equal tiles in a 2-column grid, value inside a semicircle gauge. */
function GaugeTile({ row: r, val, range, adj, onOpen }) {
  const bar = barFor(r, val, range)
  const ghost = ghostFor(r, val, range, adj)
  return (
    <div className="tile" role="button" tabIndex={0} onClick={onOpen} onKeyDown={enterOpen(onOpen)}>
      <span className="tile-label">{r.label}</span>
      <div className="gauge-wrap">
        <Gauge bar={bar} ghost={ghost} />
        <span className={`gauge-value ${r.cls}`}>{val.estimated ? '~' : ''}{fmt(val.value, 0)}</span>
      </div>
      <span className="tile-sub">{r.unit} {pmText(val)}</span>
      <ErrRange val={val} />
      <RangeLine bar={bar} range={range} unit={r.unit} />
      <Budget row={r} val={val} range={range} />
    </div>
  )
}

/**
 * The window and the picked day live in the URL (`#/?win=weekly&day=2026-10-15`), so going back from a screen
 * opened here (breakdown, consumptions) returns to the same view. No `day` = today, following midnight.
 */
/** Import: merge the file into what's here, or replace everything with it. */
function ImportSheet({ file, onClose }) {
  const [busy, setBusy] = useState(false)
  async function run(merge) {
    const synced = getState() ? ' It also replaces the data on every device synced with this backup.' : ''
    if (!merge && !confirm(`Replace ALL data on this device with the file?${synced} This cannot be undone.`)) return
    setBusy(true)
    try {
      await importAll(await file.text(), { merge })
      onClose()
    } catch (err) {
      alert(`Import failed: ${err.message}`)
      setBusy(false)
    }
  }
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Import {file.name}</h2>
        <p className="small"><strong>Merge</strong> <span className="muted">adds the file's foods, consumptions, targets
          and body measurements to what's here. A user with the same name is the same user; entries already here are
          skipped; config stays as it is.</span></p>
        <p className="small"><strong>Replace</strong> <span className="muted">deletes everything here and puts the
          file's data in its place.</span></p>
        <div className="row actions">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button className="danger" disabled={busy} onClick={() => run(false)}>Replace</button>
          <button disabled={busy} onClick={() => run(true)}>Merge</button>
        </div>
      </div>
    </div>
  )
}

// The homescreen's open button group (Logs or Database), kept while the app is open so coming back finds it as it was.
let openGroup = null

export default function Home({ query = {} }) {
  const win = WINDOWS.includes(query.win) ? query.win : WINDOWS[0]
  const winIdx = WINDOWS.indexOf(win)
  const touchX = useRef(null)
  const fileRef = useRef(null)
  const [importing, setImporting] = useState(null) // the file picked, until merge or replace is chosen
  const [group, setGroupState] = useState(openGroup)
  const setGroup = (g) => setGroupState((openGroup = g))
  const toggle = (g) => setGroup(group === g ? null : g)
  const day = useToday()
  // Daily window only: the day shown (the day arrows); at most tomorrow, to preview its (weekly-corrected) bounds.
  const inRange = (d) => d && day && d !== day && d <= addDays(day, 1)
  const picked = inRange(query.day) ? query.day : undefined
  const back = picked ? daysBetween(picked, day) : 0 // −1 = tomorrow
  const setView = (w, d) => {
    const qs = new URLSearchParams({ ...(w !== WINDOWS[0] && { win: w }), ...(inRange(d) && { day: d }) }).toString()
    replace(`/${qs ? `?${qs}` : ''}`)
  }

  const data = useLiveQuery(() => loadDashboard({ win, day, picked }), [win, day, picked])

  const otherDay = win === 'daily' && back !== 0 && data ? data.first : null
  const shift = (d) => setView(WINDOWS[(winIdx + d + WINDOWS.length) % WINDOWS.length], picked)
  const stepDay = (n) => day && setView(win, addDays(picked ?? day, n))
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - (touchX.current ?? 0)
    if (Math.abs(dx) > 40) shift(dx < 0 ? 1 : -1)
  }

  async function doExport() {
    const text = await exportAll()
    const name = exportFileName()
    const file = new File([text], name, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return } catch { /* fall back to download */ }
    }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: name })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function pickImport(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) setImporting(f)
  }

  return (
    <div className="screen home">
      <div className="home-top">
        <SyncStatus />
        {data?.showVersion && <span className="app-version" title="App version (when it was built)">v{versionStamp(__BUILT_AT__)}</span>}
        <button className="user-btn config-btn" onClick={() => go('/config')}>
          <span aria-hidden="true">⚙️</span> Config
        </button>
        <button className="user-btn" onClick={() => go('/users')} aria-label="Users">
          <span aria-hidden="true">👤</span> {data?.user.name ?? '…'}
        </button>
      </div>
      <header
        className="window-header"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={onTouchEnd}
      >
        <button className="icon" onClick={() => shift(-1)} aria-label="Previous window"><Chevron /></button>
        <div>
          <div className="win-name">{WINDOW_NAMES[win]}</div>
          <div className="win-range">{data ? windowTitle(win, data.first, data.last, back) : '…'}</div>
          <div className="dots">{WINDOWS.map((w) => <span key={w} className={w === win ? 'on' : ''} />)}</div>
        </div>
        <button className="icon" onClick={() => shift(1)} aria-label="Next window"><Chevron dir="right" /></button>
      </header>
      {win === 'daily' && (
        // Previous / next day; the middle button jumps back to today. No days after tomorrow.
        <div className="day-step">
          <button className="icon" onClick={() => stepDay(-1)} aria-label="Previous day"><Chevron /></button>
          <button className="secondary" onClick={() => setView(win)} disabled={back === 0}>Today</button>
          <button className="icon" onClick={() => stepDay(1)} disabled={back < 0} aria-label="Next day"><Chevron dir="right" /></button>
        </div>
      )}

      {/* Only the dashboard scrolls; the header and the buttons stay in view. */}
      <main className="home-main">
        {data && (
          <section className={`dashboard ${data.style}`}>
            {data.rows.map((r) => {
              const n = data.total[r.key]
              const val = r.key === 'energy' ? calories(data.total) : n ?? zero()
              const Item = data.style === 'bars' ? BarRow : GaugeTile
              return <Item key={r.key} row={r} val={val} range={data.targets[r.key]} adj={data.adj} onOpen={() => go(`/breakdown/${r.key}?from=${data.first}&to=${data.last}&win=${win}`)} />
            })}
            <p className="muted">
              {data.count} consumption{data.count === 1 ? '' : 's'}
              {win !== 'daily' && ` · per day, over ${data.days} day${data.days === 1 ? '' : 's'} with consumptions`}
              {data.failed > 0 && <span className="warn"> · {data.failed} couldn't be computed</span>}
            </p>
          </section>
        )}
        <button className="secondary time-graphs" onClick={() => go('/graphs')}>Time graphs</button>

        {/* Two buttons; each opens its group above them, so they stay under the thumb. One group open at a time. */}
        <nav className="menu">
          {group === 'logs' && (
            <div className="menu-group" id="menu-logs">
              {/* Looking at another day (past, or tomorrow): open that day's consumptions (+: add one on that day). */}
              <div className="menu-item">
                <button onClick={() => go(`/consumptions${otherDay ? `?day=${otherDay}` : ''}`)}>Consumptions</button>
                <button className="plus" onClick={() => go(`/consumptions?${otherDay ? `day=${otherDay}&` : ''}new`)} aria-label="Add consumption">+</button>
              </div>
              <div className="menu-item">
                <button onClick={() => go('/targets')}>Targets</button>
                <button className="plus" onClick={() => go('/targets?new')} aria-label="Add target">+</button>
              </div>
              <div className="menu-item">
                <button onClick={() => go('/body')}>Body measurements</button>
                <button className="plus" onClick={() => go('/body?new')} aria-label="Add body measurements">+</button>
              </div>
              <div className="menu-item">
                <button onClick={() => go('/notes')}>Temp notes</button>
                <button className="plus" onClick={() => go('/notes?new')} aria-label="Add temp note">+</button>
              </div>
            </div>
          )}
          {group === 'database' && (
            <div className="menu-group" id="menu-database">
              <div className="menu-item">
                <button onClick={() => go('/foods')}>Foods</button>
                <button className="plus" onClick={() => go('/foods/new')} aria-label="Add food">+</button>
              </div>
              <div className="row">
                <button className="secondary" onClick={() => fileRef.current.click()}>Import databases</button>
                <button className="secondary" onClick={doExport}>Export databases</button>
              </div>
            </div>
          )}
          <div className="menu-toggles">
            {[['logs', 'Logs'], ['database', 'Database']].map(([g, label]) => (
              <button key={g} className={group === g ? 'open' : ''} onClick={() => toggle(g)} aria-expanded={group === g} aria-controls={`menu-${g}`}>
                {label} <Chevron dir="right" />
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={pickImport} />
        </nav>
      </main>
      {importing && <ImportSheet file={importing} onClose={() => setImporting(null)} />}
    </div>
  )
}
