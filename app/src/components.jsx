import { useEffect, useRef, useState } from 'react'
import { itemLabel, kindOf } from './db'
import { calories, fmt } from './nutrients'

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

export function Screen({ title, back = true, right, children }) {
  return (
    <div className="screen">
      <header className="topbar">
        {back ? <button className="icon" onClick={() => history.back()} aria-label="Back">‹</button> : <span />}
        <h1>{title}</h1>
        {right ?? <span />}
      </header>
      <main>{children}</main>
    </div>
  )
}

// --- Form bits -------------------------------------------------------------

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

/** Free-text unit, used where units are defined (database screens). */
export function UnitInput({ value, onChange, placeholder = 'unit' }) {
  return <input value={value ?? ''} placeholder={placeholder} autoCapitalize="none" onChange={(e) => onChange(e.target.value)} />
}

/** Unit choice for a consumption: disabled until an item is set, then only the units that item can be measured in. */
export function UnitSelect({ units, value, onChange }) {
  if (!units) return <select disabled><option>pick an item first</option></select>
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {value && !units.includes(value) && <option value={value}>{value} (no conversion)</option>}
      {units.map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
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

/**
 * One search box over every food: ingredients, recipes and concoctions are interchangeable,
 * so the picker never asks which kind you want.
 */
export function ItemPicker({ ctx, value, onChange, exclude }) {
  const [query, setQuery] = useState(null) // null = closed
  const inputRef = useRef(null)
  const selected = value != null ? ctx.items.get(value) : null
  const words = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const matches = ctx.list
    .filter((it) => it.id !== exclude)
    .map((it) => [it, itemLabel(it)])
    .filter(([, label]) => words.every((w) => label.toLowerCase().includes(w)))
    // Most recently made concoctions first, then alphabetical.
    .sort(([a, la], [b, lb]) => (b.madeAt ?? '').localeCompare(a.madeAt ?? '') || la.localeCompare(lb))
    .slice(0, 50)
  const nav = useListNav(matches.length, (i) => {
    onChange(matches[i][0].id)
    inputRef.current.blur()
  }, () => inputRef.current.blur())

  return (
    <div className="picker">
      <input
        ref={inputRef}
        value={query ?? (selected ? itemLabel(selected) : '')}
        placeholder="Search foods…"
        onFocus={(e) => { setQuery(''); nav.reset(); e.target.select() }}
        onBlur={() => setQuery(null)}
        onChange={(e) => { setQuery(e.target.value); nav.reset() }}
        {...nav.inputProps}
      />
      {query !== null && (
        <ul className="picker-list" ref={nav.listRef}>
          {matches.map(([it, label], i) => (
            <li key={it.id} {...nav.itemProps(i)}>
              {label}
              {kindOf(it) !== 'ingredient' && <small className="muted"> · {kindOf(it)}</small>}
            </li>
          ))}
          {!matches.length && <li className="muted">No match</li>}
        </ul>
      )}
    </div>
  )
}

/** Text box with autocomplete over `options` (nutrients not shown yet). Tap a suggestion, or Enter for the first one. */
export function NutrientAdder({ options, onAdd }) {
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
      <input className="add-nutrient" value={text} placeholder="+ add nutrient…"
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

/** "P 12 · F 5 · C 30 · 230 kcal" line. */
export function MacroLine({ nutrients, ok = true }) {
  if (!ok) return <span className="macros warn">can't compute (unit conversion missing?)</span>
  const v = (k) => nutrients[k]?.value ?? 0
  const kcal = calories(nutrients)
  return (
    <span className="macros">
      <b className="c-prot">P {fmt(v('proteins'))}</b> · <b className="c-fat">F {fmt(v('fat'))}</b> ·{' '}
      <b className="c-carb">C {fmt(v('carbohydrates'))}</b> · <b className="c-kcal">{kcal.estimated ? '~' : ''}{fmt(kcal.value, 0)} kcal</b>
    </span>
  )
}
