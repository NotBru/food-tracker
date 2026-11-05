import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { exportAll, importAll } from '../db'
import { barScale, targetBar } from '../calc'
import { calories, fmt, pmText, rangeLabel, rangeText } from '../nutrients'
import { bounds, sdOf, zero } from '../stats'
import { WINDOWS, WINDOW_NAMES, addDays, daysBetween, versionStamp } from '../time'
import { ROWS, barFor, barNotes, exportFileName, fillEnd, fillPieces, ghostFor, hasMean, loadDashboard, statusMark, windowTitle } from '../dashboard'
import { PIE_MACROS, eatenArcs, pieFull, pieModel, ringSegments, ringText } from '../pie'
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

// --- Bar notes -----------------------------------------------------------------
// Dashboard style "bars": each number sits on the bar, at its place (dashboard.js barNotes). Notes in a lane that
// would overlap are pushed apart, as little as needed, and kept within the bar's width.

const NOTE_GAP = 6 // px between two notes in a lane

/**
 * Widths (px) of the elements given `ref(i)`, as the browser drew them (its fonts, text size and zoom: a canvas
 * measure in the CSS font missed text scaling and let notes overlap); null until measured. Measured before paint.
 */
function useWidths(n) {
  const els = useRef([])
  els.current.length = n
  const [ws, setWs] = useState(null)
  const measure = () => {
    const next = Array.from({ length: n }, (_, i) => els.current[i]?.getBoundingClientRect().width ?? 0)
    setWs((prev) => (prev?.length === n && prev.every((w, i) => Math.abs(w - next[i]) < 0.5) ? prev : next))
  }
  useLayoutEffect(measure)
  // A note's size changing by itself (a font arriving, text scaling changed): measured again.
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => measure())
    for (const el of els.current) el && ro.observe(el)
    return () => ro.disconnect()
  })
  return [(i) => (el) => { els.current[i] = el }, ws?.length === n ? ws : null]
}

/**
 * Left edges (px) for labels of widths `w` wanted centred at `c`, in a lane `W` wide: neighbours that would overlap
 * become one block, centred where its labels want it on average, then kept inside the lane.
 */
function spreadNotes(items, W, gap = NOTE_GAP) {
  const place = (b) => {
    let o = 0
    let sum = 0
    for (const it of b.list) { sum += it.c - (o + it.w / 2); o += it.w + gap }
    b.w = o - gap
    b.left = Math.min(Math.max(sum / b.list.length, 0), Math.max(0, W - b.w))
    return b
  }
  const blocks = []
  for (const it of items.map((it, i) => ({ ...it, i })).sort((a, b) => a.c - b.c)) {
    blocks.push(place({ list: [it] }))
    while (blocks.length > 1) {
      const [a, b] = blocks.slice(-2)
      if (a.left + a.w + gap <= b.left) break
      blocks.splice(-2, 2, place({ list: [...a.list, ...b.list] }))
    }
  }
  const lefts = []
  for (const b of blocks) {
    let x = b.left
    for (const it of b.list) { lefts[it.i] = x; x += it.w + gap }
  }
  return lefts
}

/**
 * One lane of notes, in a row on one baseline, left to right as on the bar: each note's margin puts it where
 * spreadNotes wants it (at least NOTE_GAP from the one before).
 */
function NoteLane({ notes, width, className }) {
  const sorted = [...notes].sort((a, b) => a.at - b.at)
  const [ref, ws] = useWidths(sorted.length)
  const lefts = width && ws ? spreadNotes(sorted.map((n, i) => ({ c: (n.at / 100) * width, w: ws[i] })), width) : null
  return (
    <div className={`note-lane ${className}`}>
      {width > 0 && sorted.map((n, i) => (
        <span key={n.kind} ref={ref(i)} className={`note ${n.kind}`}
          style={lefts ? { marginLeft: lefts[i] - (i ? lefts[i - 1] + ws[i - 1] : 0) } : { visibility: 'hidden' }}>{n.text}</span>
      ))}
    </div>
  )
}

/** Calories with a max: a segment from the estimate's high end to the max, labelled with what's left (Δ). */
function BudgetLane({ budget, width }) {
  const [ref, ws] = useWidths(1)
  const w = ws?.[0] ?? 0
  const mid = ((budget.from + budget.to) / 200) * width
  return (
    <div className={`note-lane budget-lane ${budget.over ? 'over' : ''}`} title={budget.over ? 'Over the max by' : "Budget: what's left to eat"}>
      <div className="budget-seg" style={{ left: `${budget.from}%`, width: `${budget.to - budget.from}%` }} />
      {width > 0 && <span ref={ref(0)} className="note budget-note" style={ws ? { left: Math.min(Math.max(mid - w / 2, 0), Math.max(0, width - w)) } : { visibility: 'hidden' }}>{budget.text}</span>}
    </div>
  )
}

/** The width of an element, kept up to date (0 until it's laid out). */
function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/**
 * Dashboard style "bars": one slim row per nutrient, its name and unit, then the bar with its numbers on it: the
 * estimate above, the target below; calories also get the budget under those.
 */
function BarRow({ row: r, val, range, adj, onOpen }) {
  const { bar, top, bottom, budget } = barNotes(r, val, range)
  const ghost = ghostFor(r, val, range, adj)
  const [laneRef, width] = useWidth()
  // Mouse hover over a bar with a target: the amount under the cursor, in % of the bar's width.
  const [hover, setHover] = useState(null)
  const onHover = (e) => {
    if (e.pointerType !== 'mouse' || bar.dummy) return
    const box = e.currentTarget.getBoundingClientRect()
    setHover(Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100)))
  }
  return (
    <div className="dash-row" role="button" tabIndex={0} onClick={onOpen} onKeyDown={enterOpen(onOpen)}>
      <span className="dash-name">
        <span className="dash-label">{r.label}</span>
        <small>{r.unit}</small>
      </span>
      <div className={`dash-bar ${r.cls}`} ref={laneRef}>
        <NoteLane notes={top} width={width} className="above" />
        <div className={`bar ${bar.status}`} onPointerMove={onHover} onPointerLeave={() => setHover(null)}>
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
              <span className="bar-tip">{fmt(barScale(range ?? {}, val).at(hover), 0)} {r.unit}</span>
            </div>
          )}
        </div>
        {/* Always there, so rows with and without a target are spaced alike. */}
        <NoteLane notes={bottom} width={width} className={`below ${bar.status}`} />
        {budget && <BudgetLane budget={budget} width={width} />}
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

// --- Pie -----------------------------------------------------------------------
// Dashboard style "pie" (pie.js): calories as the radius, the macros' shares of them as angles. Drawn on a canvas
// pixel by pixel, one ring per pixel of radius (the shares' edges curve: a share of grams shrinks as the ring grows),
// then what was eaten on top: a white-edged ring at the calories eaten, split by the macros' shares; the calories'
// interval as two dashed circles (a ring as thick as the interval hid the targets under it).

const rgb = (s) => {
  const h = s.trim().replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const mix = (a, b, t) => a.map((x, i) => Math.round(x * t + b[i] * (1 - t)))
const css = (c) => `rgb(${c.join(' ')})`

/** The pie's colours from the app's colour variables, mixed with the tile's background. */
function piePalette() {
  const style = getComputedStyle(document.documentElement)
  const v = (n) => rgb(style.getPropertyValue(`--${n}`))
  const bg = v('panel-2')
  const tones = Object.fromEntries(['prot', 'fat', 'carb', 'muted'].map((t) => [t, v(t)]))
  return {
    // Where no split is allowed (outside the calorie target, or the macros can't fit): deep blue, plain.
    out: rgb('#000421'),
    free: mix(v('kcal'), bg, 0.4), shared: mix(v('muted'), bg, 0.6),
    core: Object.fromEntries(PIE_MACROS.map((m) => [m.key, tones[m.tone]])),
    flank: Object.fromEntries(PIE_MACROS.map((m) => [m.key, mix(tones[m.tone], [255, 255, 255], 0.5)])),
    tone: tones, range: v('range'),
  }
}
const segColour = (pal, s) => (s.kind === 'core' || s.kind === 'flank' ? pal[s.kind][s.key] : pal[s.kind])

const RING = 9 // px: the eaten ring's thickness

function PieCanvas({ model, val, total, onPoint }) {
  const [boxRef, width] = useWidth()
  const ref = useRef(null)
  const full = pieFull(model, val)
  const [lo, hi] = bounds(val)
  const arcs = eatenArcs(model, total)
  const key = JSON.stringify([model.targets, full, val.value, lo, hi, arcs])
  useLayoutEffect(() => {
    const cv = ref.current
    if (!cv || !width) return
    const k = Math.max(2, devicePixelRatio || 1) // at least 2× and scaled down: smoother edges
    const n = Math.round(width * k)
    cv.width = cv.height = n
    const ctx = cv.getContext('2d')
    const pal = piePalette()
    const R = n / 2
    const img = ctx.createImageData(n, n)
    const rings = []
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = x + 0.5 - R
        const dy = y + 0.5 - R
        const r = Math.hypot(dx, dy)
        if (r > R) continue
        const i = Math.floor(r)
        const segs = (rings[i] ??= ringSegments(model, ((i + 0.5) / R) * full))
        let t = Math.atan2(dx, -dy) / (2 * Math.PI)
        if (t < 0) t += 1
        const seg = segs.find((s) => t < s.to) ?? segs[segs.length - 1]
        const c = segColour(pal, seg)
        const o = (y * n + x) * 4
        img.data[o] = c[0]
        img.data[o + 1] = c[1]
        img.data[o + 2] = c[2]
        img.data[o + 3] = Math.round(Math.min(1, R - r) * 255) // the disc's edge, anti-aliased
      }
    }
    ctx.putImageData(img, 0, 0)
    if (!arcs.length) return
    const at = (kcal) => (kcal / full) * R
    // The calories' interval: two thin dashed circles at its ends, in the dashboard's range colour.
    ctx.setLineDash([4 * k, 3 * k])
    ctx.lineWidth = 1.5 * k
    ctx.strokeStyle = css(pal.range)
    if (hi > lo) for (const kcal of [lo, hi]) {
      ctx.beginPath()
      ctx.arc(R, R, at(kcal), 0, 2 * Math.PI)
      ctx.stroke()
    }
    ctx.setLineDash([])
    // The estimate: a ring split by what was eaten, edged in white.
    const thick = RING * k
    const mid = Math.min(R - thick / 2, Math.max(thick / 2, at(val.value)))
    const ang = (turns) => turns * 2 * Math.PI - Math.PI / 2
    ctx.lineWidth = thick
    for (const a of arcs) {
      ctx.strokeStyle = css(pal.tone[a.tone])
      ctx.beginPath()
      ctx.arc(R, R, mid, ang(a.from), ang(a.to))
      ctx.stroke()
    }
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5 * k
    for (const r of [mid - thick / 2, mid + thick / 2]) {
      if (r <= 0) continue
      ctx.beginPath()
      ctx.arc(R, R, r, 0, 2 * Math.PI)
      ctx.stroke()
    }
  }, [width, key]) // eslint-disable-line react-hooks/exhaustive-deps
  // Pointing (hover with a mouse, a tap on a phone) reads the ring under it.
  const point = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const r = Math.hypot(e.clientX - box.left - box.width / 2, e.clientY - box.top - box.height / 2)
    onPoint(r <= box.width / 2 ? (r / (box.width / 2)) * full : null)
  }
  return (
    <div className="pie-box" ref={boxRef}>
      <canvas ref={ref} onPointerMove={point} onPointerDown={point} onPointerLeave={(e) => e.pointerType === 'mouse' && onPoint(null)}
        role="img" aria-label="Calories as the radius, the macros' shares of them by angle" />
    </div>
  )
}

/**
 * Dashboard style "pie": calories, protein, fat and carbs in one pie (PieCanvas), a line reading the ring at what
 * was eaten (or the one pointed at), a legend; then bars for any other nutrient with a target.
 */
function PieDash({ data, open }) {
  const [pointed, setPointed] = useState(null)
  const model = pieModel(data.targets)
  const kcal = calories(data.total)
  const at = pointed ?? (kcal.value > 0 ? kcal.value : null)
  const macroKcal = PIE_MACROS.reduce((s, m) => s + m.kcal * Math.max(0, data.total[m.key]?.value || 0), 0)
  const rows = [
    { ...ROWS[0], val: kcal },
    ...PIE_MACROS.map((m) => ({ ...ROWS.find((r) => r.key === m.key), val: data.total[m.key] ?? zero(), share: macroKcal > 0 ? (m.kcal * Math.max(0, data.total[m.key]?.value || 0)) / macroKcal : null })),
  ]
  const others = data.rows.filter((r) => !ROWS.some((x) => x.key === r.key) && (Number.isFinite(data.targets[r.key]?.min) || Number.isFinite(data.targets[r.key]?.max)))
  return (
    <>
      <div className="pie-tile">
        <PieCanvas model={model} val={kcal} total={data.total} onPoint={setPointed} />
        <p className="pie-readout">{at == null ? '\u00a0' : <><b>{fmt(at, 0)} kcal</b>{pointed == null && ' (eaten)'}: {ringText(model, at)}</>}</p>
        <div className="pie-legend">
          {rows.map((r) => {
            const range = data.targets[r.key]
            const bar = targetBar(r.val, range)
            return (
              <div key={r.key} className="pie-row" role="button" tabIndex={0} onClick={() => open(r.key)} onKeyDown={enterOpen(() => open(r.key))}>
                <span className={`pie-name ${r.cls}`}>{r.label}</span>
                <span className="num"><b>{r.val.estimated ? '~' : ''}{fmt(r.val.value, 0)}</b> <span className="muted">{pmText(r.val, 0)} {r.unit}</span></span>
                <span className="num muted">{r.share != null ? `${Math.round(r.share * 100)}%` : ''}</span>
                <span className={`pie-target ${bar?.status ?? ''}`}>{bar ? <>{rangeLabel(range)} {statusMark(bar.status)}</> : ''}</span>
              </div>
            )
          })}
        </div>
      </div>
      {others.map((r) => (
        <BarRow key={r.key} row={r} val={data.total[r.key] ?? zero()} range={data.targets[r.key]} adj={data.adj} onOpen={() => open(r.key)} />
      ))}
    </>
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
  const openBreakdown = (key) => go(`/breakdown/${key}?from=${data.first}&to=${data.last}&win=${win}`)
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
            {data.style === 'pie' ? <PieDash data={data} open={openBreakdown} /> : data.rows.map((r) => {
              const n = data.total[r.key]
              const val = r.key === 'energy' ? calories(data.total) : n ?? zero()
              const Item = data.style === 'bars' ? BarRow : GaugeTile
              return <Item key={r.key} row={r} val={val} range={data.targets[r.key]} adj={data.adj} onOpen={() => openBreakdown(r.key)} />
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
