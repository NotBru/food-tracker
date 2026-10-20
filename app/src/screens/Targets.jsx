import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getCurrentUser } from '../db'
import { NUTRIENTS, rangeLabel } from '../nutrients'
import { formatDateTime, toLocalInput } from '../time'
import { DateTimeInput, Field, NutrientAdder, Screen, enterTo, replace } from '../components'

// design.md: targets are listed latest first; each holds user-chosen nutrients (energy included) and is valid
// from its timestamp until the next target's. Values are daily ranges {min?, max?}; either bound is optional.

const byKey = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n]))
// Same order as the nutrient list (energy, proteins, fat, carbs, …).
const rank = (key) => NUTRIENTS.findIndex((n) => n.key === key)
const inOrder = (entries) => [...entries].sort(([a], [b]) => rank(a) - rank(b))
const when = formatDateTime

export default function Targets({ add }) {
  const data = useLiveQuery(async () => {
    const user = await getCurrentUser()
    const targets = await db.targets.where('userId').equals(user.id).reverse().sortBy('validFrom')
    return { user, targets }
  })
  const [editing, setEditing] = useState(null)
  // A new target starts from now, with the latest target's values.
  const newTarget = () => setEditing({ validFrom: new Date().toISOString(), userId: data.user.id, values: structuredClone(data.targets[0]?.values ?? {}) })
  // Opened with ?new (the homescreen's +): straight into a new target, once; the flag leaves the URL.
  const added = useRef(false)
  useEffect(() => {
    if (!add || !data || added.current) return
    added.current = true
    newTarget()
    replace('/targets')
  }, [add, data])

  if (!data) return null
  const { user, targets } = data
  const now = new Date().toISOString()
  const activeId = targets.find((t) => t.validFrom <= now)?.id

  return (
    <Screen title="Targets" subtitle={user.name}>
      <ul className="list">
        <li className="add" onClick={newTarget}>+ add target</li>
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
  const adderRef = useRef(null) // Enter in a min or max goes here
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
    const rec = { validFrom: new Date(validFrom).toISOString(), userId: target.userId, values }
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
          <DateTimeInput value={validFrom} onChange={setValidFrom} />
        </Field>
        <div className="nutrients">
          <div className="n-row with-x n-head"><span>per day</span><span>min</span><span>max</span><span /></div>
          {rows.map(([k, minT, maxT], i) => (
            <div className="n-row with-x" key={k}>
              <span>{byKey[k]?.label ?? k} <small className="muted">{byKey[k]?.unit}</small></span>
              <input ref={(el) => (refs.current[k] = el)} inputMode="decimal" value={minT} placeholder="–" enterKeyHint="next" onKeyDown={enterTo(adderRef)} onChange={(e) => setCell(i, 1, e.target.value)} />
              <input inputMode="decimal" value={maxT} placeholder="–" enterKeyHint="next" onKeyDown={enterTo(adderRef)} onChange={(e) => setCell(i, 2, e.target.value)} />
              <button className="icon small" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove ${byKey[k]?.label ?? k}`}>×</button>
            </div>
          ))}
          <NutrientAdder inputRef={adderRef} options={NUTRIENTS.filter((n) => !rows.some(([k]) => k === n.key))}
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
