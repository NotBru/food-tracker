import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { NUTRIENTS, rangeLabel } from '../nutrients'
import { toLocalInput } from '../time'
import { Field, NutrientAdder, Screen } from '../components'

// design.md: targets are listed latest first; each holds user-chosen nutrients (energy included) and is valid
// from its timestamp until the next target's. Values are daily ranges {min?, max?}; either bound is optional.

const byKey = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n]))
// Same order as the nutrient list (energy, proteins, fat, carbs, …).
const rank = (key) => NUTRIENTS.findIndex((n) => n.key === key)
const inOrder = (entries) => [...entries].sort(([a], [b]) => rank(a) - rank(b))
const when = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export default function Targets() {
  const targets = useLiveQuery(() => db.targets.orderBy('validFrom').reverse().toArray())
  const [editing, setEditing] = useState(null)
  if (!targets) return null
  const now = new Date().toISOString()
  const activeId = targets.find((t) => t.validFrom <= now)?.id

  return (
    <Screen title="Targets">
      <ul className="list">
        {targets.map((t, i) => (
          <li key={t.id} onClick={() => setEditing(t)}>
            <div className="list-main">
              <span>From {when(t.validFrom)}</span>
              {t.id === activeId ? <span className="tag ok">active</span> : t.validFrom > now ? <span className="tag">upcoming</span> : null}
            </div>
            {i > 0 && <span className="muted">until {when(targets[i - 1].validFrom)}</span>}
            <span className="macros">
              {inOrder(Object.entries(t.values)).map(([k, r]) => `${byKey[k]?.label ?? k} ${rangeLabel(r)} ${byKey[k]?.unit ?? ''}`).join(' · ')}
              <span className="muted"> per day</span>
            </span>
          </li>
        ))}
        <li className="add" onClick={() => setEditing({ validFrom: now, values: structuredClone(targets[0]?.values ?? {}) })}>+ add target</li>
      </ul>
      {editing && <TargetEditor target={editing} onClose={() => setEditing(null)} />}
    </Screen>
  )
}

function TargetEditor({ target, onClose }) {
  const [validFrom, setValidFrom] = useState(toLocalInput(new Date(target.validFrom)))
  // [key, minText, maxText], kept in nutrient-list order.
  const txt = (x) => (Number.isFinite(x) ? String(x) : '')
  const [rows, setRows] = useState(
    NUTRIENTS.filter((n) => n.key in target.values).map((n) => [n.key, txt(target.values[n.key].min), txt(target.values[n.key].max)]),
  )
  const setCell = (i, j, v) => setRows(rows.map((r, k) => (k === i ? r.map((c, m) => (m === j ? v : c)) : r)))
  const [focusKey, setFocusKey] = useState(null)
  const refs = useRef({})
  useEffect(() => {
    if (focusKey && refs.current[focusKey]) {
      refs.current[focusKey].focus()
      setFocusKey(null)
    }
  }, [focusKey])

  async function save() {
    const num = (t) => (t.trim() !== '' && Number.isFinite(Number(t)) ? Number(t) : undefined)
    const values = {}
    for (const [k, minT, maxT] of rows) {
      const min = num(minT)
      const max = num(maxT)
      if (min === undefined && max === undefined) continue
      if (min !== undefined && max !== undefined && min > max) return alert(`${byKey[k]?.label ?? k}: min is above max.`)
      values[k] = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) }
    }
    if (!Object.keys(values).length) return alert('Set at least one min or max.')
    const rec = { validFrom: new Date(validFrom).toISOString(), values }
    if (target.id) await db.targets.update(target.id, rec)
    else await db.targets.add(rec)
    onClose()
  }
  async function remove() {
    if (confirm('Delete this target?')) {
      await db.targets.delete(target.id)
      onClose()
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{target.id ? 'Edit target' : 'New target'}</h2>
        <Field label="Valid from">
          <input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </Field>
        <div className="nutrients">
          <div className="n-row with-x n-head"><span>per day</span><span>min</span><span>max</span><span /></div>
          {rows.map(([k, minT, maxT], i) => (
            <div className="n-row with-x" key={k}>
              <span>{byKey[k]?.label ?? k} <small className="muted">{byKey[k]?.unit}</small></span>
              <input ref={(el) => (refs.current[k] = el)} inputMode="decimal" value={minT} placeholder="–" onChange={(e) => setCell(i, 1, e.target.value)} />
              <input inputMode="decimal" value={maxT} placeholder="–" onChange={(e) => setCell(i, 2, e.target.value)} />
              <button className="icon small" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove ${byKey[k]?.label ?? k}`}>×</button>
            </div>
          ))}
          <NutrientAdder options={NUTRIENTS.filter((n) => !rows.some(([k]) => k === n.key))}
            onAdd={(key) => { setRows(inOrder([...rows, [key, '', '']])); setFocusKey(key) }} />
        </div>
        <div className="row actions">
          {target.id && <button className="danger" onClick={remove}>Delete</button>}
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
