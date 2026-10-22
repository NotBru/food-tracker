import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { fold, getConfig, itemLabel, kindOf, madeText, searchText } from './db'
import { today } from './time'
import { autoAmountDelta, calories, fmt, pmText } from './nutrients'

// --- Current day -----------------------------------------------------------
// Today's logical day (see time.js), kept current: live queries only re-run on database changes, so screens that
// show "today" pass this as a dependency. Checked every 30 s and whenever the app comes back to the foreground
// (timers stall while a phone sleeps). Undefined until the config has loaded.

export function useToday() {
  const config = useLiveQuery(getConfig)
  const loaded = config != null
  const dayStart = config?.dayStart
  const [day, setDay] = useState()
  useEffect(() => {
    if (!loaded) return
    const check = () => setDay(today(dayStart))
    check()
    const timer = setInterval(check, 30_000)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [loaded, dayStart])
  return day
}

// --- Hash router -----------------------------------------------------------
// Hash routes keep the phone's back gesture working and need no server config.

export function useRoute() {
  const read = () => {
    const [path, qs = ''] = (location.hash.slice(1) || '/').split('?')
    return { parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs)) }
  }
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export const go = (path) => (location.hash = path)
// Same, without adding a history entry (so back skips it).
export const replace = (path) => location.replace(`#${path}`)

/** ‹ / › for icon buttons. An SVG, not a text glyph: glyphs sit off-centre in a round button (font metrics). */
export function Chevron({ dir = 'left' }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="chevron">
      <path d={dir === 'left' ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'} />
    </svg>
  )
}

/** Trash can for delete buttons; an SVG for the same reason as Chevron. */
export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="chevron">
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />
    </svg>
  )
}

export function Screen({ title, subtitle, back = true, right, className = '', children }) {
  return (
    <div className={`screen ${className}`.trim()}>
      <header className="topbar">
        {back ? <button className="icon" onClick={() => history.back()} aria-label="Back"><Chevron /></button> : <span />}
        <h1>{title}{subtitle && <small className="subtitle">{subtitle}</small>}</h1>
        {right ?? <span />}
      </header>
      <main>{children}</main>
    </div>
  )
}

// --- Form bits -------------------------------------------------------------

/**
 * Date and time as typed text, "YYYY-MM-DD HH:MM": a native datetime-local input would show the phone's locale
 * format instead. `value`/`onChange` use the datetime-local form ("YYYY-MM-DDTHH:MM"). onChange fires only for a
 * valid date; until then the field is marked invalid, and on blur it falls back to the last valid value. 📅 opens
 * the native picker (a hidden input).
 */
export function DateTimeInput({ value, onChange }) {
  const shown = (v) => (v ?? '').replace('T', ' ')
  const [text, setText] = useState(shown(value))
  const pickerRef = useRef(null)
  useEffect(() => setText(shown(value)), [value])
  const parse = (t) => {
    const m = t.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/)
    if (!m) return null
    const [, y, mo, d, h, mi] = m.map(Number)
    const dt = new Date(y, mo - 1, d, h, mi)
    const ok = dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d && h < 24 && mi < 60
    return ok ? `${m[1]}-${m[2]}-${m[3]}T${String(h).padStart(2, '0')}:${m[5]}` : null
  }
  const valid = parse(text) != null
  return (
    <span className="datetime">
      <input value={text} inputMode="numeric" placeholder="YYYY-MM-DD HH:MM" className={valid ? '' : 'invalid'}
        onChange={(e) => { setText(e.target.value); const v = parse(e.target.value); if (v) onChange(v) }}
        onBlur={() => setText(shown(value))} />
      <button type="button" className="icon small" aria-label="Pick date and time"
        onClick={(e) => { e.preventDefault(); const el = pickerRef.current; el.showPicker ? el.showPicker() : el.focus() }}>📅</button>
      <input ref={pickerRef} type="datetime-local" className="hidden-date" tabIndex={-1} aria-hidden="true" value={value ?? ''}
        onChange={(e) => e.target.value && onChange(e.target.value)} />
    </span>
  )
}


export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

/** onKeyDown for a value field: Enter moves the cursor to `ref` (e.g. "add nutrient"), to type the next one. */
export const enterTo = (ref) => (e) => {
  if (e.key !== 'Enter' || !ref.current) return
  e.preventDefault()
  ref.current.focus()
}

/** Free-text unit, used where units are defined (database screens). */
export function UnitInput({ value, onChange, placeholder = 'unit' }) {
  return <input value={value ?? ''} placeholder={placeholder} autoCapitalize="none" onChange={(e) => onChange(e.target.value)} />
}

/** Error of an amount ("± Δ"). Blank = from the digits of `amount` (shown as the placeholder). */
export function DeltaInput({ value, onChange, amount, unit }) {
  const auto = autoAmountDelta(amount ?? '', unit)
  return (
    <div className="delta">
      <span aria-hidden="true">±</span>
      <input inputMode="decimal" value={value ?? ''} placeholder={Number.isFinite(auto) ? String(auto) : 'auto'} aria-label="± Δ" onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/**
 * Unit for a consumption: free text with autocomplete over the units the food converts to (`units`, own unit
 * first). Disabled until a food is picked. Typing filters the list; ↑/↓/Enter pick, Esc closes.
 */
export function UnitCombo({ units, value, onChange }) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const q = (value ?? '').trim().toLowerCase()
  // While the text is exactly one of the units, show them all (it was just picked or prefilled), that one first:
  // it's the highlighted row, so Enter keeps what was typed.
  const matches = !units ? [] : units.includes(q) ? [q, ...units.filter((u) => u !== q)] : units.filter((u) => u.includes(q))
  const nav = useListNav(matches.length, (i) => {
    onChange(matches[i])
    setOpen(false)
  }, () => setOpen(false))
  if (!units) return <input disabled placeholder="pick a food first" />
  return (
    <div className="picker">
      <input ref={inputRef} value={value ?? ''} placeholder={units[0] ?? 'unit'} autoCapitalize="none" autoComplete="off"
        onFocus={(e) => { setOpen(true); nav.reset(); e.target.select() }}
        onBlur={() => setOpen(false)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); nav.reset() }}
        {...nav.inputProps} />
      {open && (
        <ul className="picker-list" ref={nav.listRef}>
          {matches.map((u, i) => <li key={u} {...nav.itemProps(i)}>{u}</li>)}
          {!matches.length && <li className="muted">No conversion to “{value}” for this food</li>}
        </ul>
      )}
    </div>
  )
}

export function AttributesEditor({ value = [], onChange }) {
  const set = (i, j, v) => onChange(value.map((row, k) => (k === i ? (j === 0 ? [v, row[1]] : [row[0], v]) : row)))
  return (
    <div className="attrs">
      {value.map(([k, v], i) => (
        <div className="row" key={i}>
          <input placeholder="key" value={k} onChange={(e) => set(i, 0, e.target.value)} />
          <input placeholder="value" value={v} onChange={(e) => set(i, 1, e.target.value)} />
          <button className="icon" onClick={() => onChange(value.filter((_, k2) => k2 !== i))} aria-label="Remove">×</button>
        </div>
      ))}
      <button className="link" onClick={() => onChange([...value, ['', '']])}>+ attribute</button>
    </div>
  )
}

/**
 * Keyboard navigation for an autocomplete list: ↑/↓ move, Enter picks, Esc closes.
 * Spread `inputProps` on the input; use `itemProps(i)` on each option and `listRef` on the list.
 */
export function useListNav(count, onPick, onClose) {
  const [active, setActive] = useState(0)
  const listRef = useRef(null)
  const current = Math.max(0, Math.min(active, count - 1))
  useEffect(() => {
    listRef.current?.children[current]?.scrollIntoView({ block: 'nearest' })
  }, [current])
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(current + 1, count - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(current - 1, 0)) }
    else if (e.key === 'Enter' && count > 0) { e.preventDefault(); onPick(current) }
    else if (e.key === 'Escape') onClose()
  }
  return {
    listRef,
    reset: () => setActive(0),
    inputProps: { onKeyDown },
    itemProps: (i) => ({
      className: i === current ? 'active' : '',
      onMouseEnter: () => setActive(i),
      onMouseDown: (e) => { e.preventDefault(); onPick(i) },
    }),
  }
}

const isOld = (it, before) => !!(before && it.madeAt && it.madeAt < before)

/**
 * One search box over every food: ingredients, recipes and concoctions are interchangeable,
 * so the picker never asks which kind you want.
 */
/** `onCreate(text)`: if given, a + beside the box, to make a new food from what's typed.
 * `oldBefore` (ISO time): if given, concoctions made before it go last, after every other food.
 * `show(item)`: if given, only foods it accepts are listed.
 * CIQUAL's foods (`ctx.ciqual`) come after the user's own, once something is typed. */
export function ItemPicker({ ctx, value, onChange, exclude, onCreate, oldBefore, show }) {
  const [query, setQuery] = useState(null) // null = closed
  const inputRef = useRef(null)
  const selected = value != null ? ctx.items.get(value) : null
  const words = fold(query ?? '').split(/\s+/).filter(Boolean)
  const matches = (words.length ? [...ctx.list, ...ctx.ciqual] : ctx.list)
    .filter((it) => it.id !== exclude && (!show || show(it)))
    .filter((it) => words.every((w) => searchText(it).includes(w)))
    .map((it) => [it, itemLabel(it)])
    // Most recently made concoctions first, then alphabetical; old concoctions (if `oldBefore`) last, newest first;
    // CIQUAL after everything of the user's.
    .sort(([a, la], [b, lb]) => !!a.readOnly - !!b.readOnly || isOld(a, oldBefore) - isOld(b, oldBefore)
      || (b.madeAt ?? '').localeCompare(a.madeAt ?? '') || la.localeCompare(lb))
    .slice(0, 50)
  const nav = useListNav(matches.length, (i) => {
    onChange(matches[i][0].id)
    inputRef.current.blur()
  }, () => inputRef.current.blur())

  return (
    <div className="picker">
      <div className="picker-box">
        <input
          ref={inputRef}
          value={query ?? (selected ? itemLabel(selected) : '')}
          placeholder="Search foods…"
          onFocus={(e) => { setQuery(''); nav.reset(); e.target.select() }}
          onBlur={() => setQuery(null)}
          onChange={(e) => { setQuery(e.target.value); nav.reset() }}
          {...nav.inputProps}
        />
        {/* mousedown kept from blurring the box, so what's typed is still there on click. */}
        {onCreate && <button type="button" className="icon plus" aria-label="New food" onMouseDown={(e) => e.preventDefault()} onClick={() => onCreate((query ?? '').trim())}>+</button>}
      </div>
      {/* The box holds text only, so a picked concoction's made-at time sits under it. */}
      {query === null && <MadeTag item={selected} />}
      {query !== null && (
        <ul className="picker-list" ref={nav.listRef}>
          {matches.map(([it, label], i) => (
            <li key={it.id} {...nav.itemProps(i)}>
              {label}
              {kindOf(it) === 'recipe' && <small className="muted"> · recipe</small>}
              <MadeTag item={it} />
            </li>
          ))}
          {!matches.length && <li className="muted">No match</li>}
        </ul>
      )}
    </div>
  )
}

/** A concoction's made-at time as a tag (nothing for other foods). Kept out of the label, which is name, brand and
 * attributes only. */
export function MadeTag({ item }) {
  const text = madeText(item)
  return text ? <span className="tag made">{text}</span> : null
}

/**
 * Text box with autocomplete over `options` (nutrients not shown yet). Tap a suggestion, or Enter for the first one.
 * `inputRef` lets a value field send the cursor back here (Enter).
 */
export function NutrientAdder({ options, onAdd, inputRef }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const q = text.trim().toLowerCase()
  const words = q.split(/\s+/).filter(Boolean)
  // Every typed word must appear ("vit b" -> Vitamin B1…); labels starting with the text come first.
  const matches = options
    .filter((n) => words.every((w) => n.label.toLowerCase().includes(w)))
    .sort((a, b) => b.label.toLowerCase().startsWith(q) - a.label.toLowerCase().startsWith(q))
  const nav = useListNav(matches.length, (i) => {
    onAdd(matches[i].key)
    setText('')
    nav.reset()
  }, () => setOpen(false))
  return (
    <div className="picker">
      <input ref={inputRef} className="add-nutrient" value={text} placeholder="+ add nutrient…"
        onFocus={(e) => {
          setOpen(true)
          // Keep the suggestions above the on-screen keyboard.
          const el = e.target
          setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300)
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => { setText(e.target.value); setOpen(true); nav.reset() }}
        {...nav.inputProps} />
      {open && (
        <ul className="picker-list" ref={nav.listRef}>
          {matches.map((n, i) => (
            <li key={n.key} {...nav.itemProps(i)}>
              {n.label} <small className="muted">{n.unit}</small>
            </li>
          ))}
          {!matches.length && <li className="muted">No match</li>}
        </ul>
      )}
    </div>
  )
}

/** "P 12 · F 5 · C 30 · 230 kcal" line; with `deltas`, each value also shows its interval ("P 12 ±1 · …"). */
export function MacroLine({ nutrients, ok = true, deltas = false }) {
  if (!ok) return <span className="macros warn">can't compute (unit conversion missing?)</span>
  const v = (k) => nutrients[k]?.value ?? 0
  const kcal = calories(nutrients)
  const pm = (n, digits) => deltas && n && <small className="pm"> {pmText(n, digits)}</small>
  return (
    <span className="macros">
      <b className="c-prot">P {fmt(v('proteins'))}{pm(nutrients.proteins)}</b> ·{' '}
      <b className="c-fat">F {fmt(v('fat'))}{pm(nutrients.fat)}</b> ·{' '}
      <b className="c-carb">C {fmt(v('carbohydrates'))}{pm(nutrients.carbohydrates)}</b> ·{' '}
      <b className="c-kcal">{kcal.estimated ? '~' : ''}{fmt(kcal.value, 0)}{pm(kcal, 0)} kcal</b>
    </span>
  )
}
