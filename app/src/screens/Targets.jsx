import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getCurrentUser } from '../db'
import { NUTRIENTS } from '../nutrients'
import { inOrder, newTarget as makeTarget, nutrientByKey, saveTarget, targetRows, targetText } from '../forms'
import { formatDateTime, toLocalInput } from '../time'
import { DateTimeInput, Field, NutrientAdder, Screen, enterSaves, enterTo, replace } from '../components'
import { t } from '../i18n'

// design.md: targets are listed latest first; each holds user-chosen nutrients (energy included) and is valid
// from its timestamp until the next target's. Values are daily ranges {min?, max?}; either bound is optional.

const byKey = nutrientByKey
const when = formatDateTime

export default function Targets({ add }) {
  const data = useLiveQuery(async () => {
    const user = await getCurrentUser()
    const targets = await db.targets.where('userId').equals(user.id).reverse().sortBy('validFrom')
    return { user, targets }
  })
  const [editing, setEditing] = useState(null)
  // A new target starts from now, with the latest target's values.
  const newTarget = () => setEditing(makeTarget(data.user.id, data.targets[0]))
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
  const activeId = targets.find((tg) => tg.validFrom <= now)?.id

  return (
    <Screen title={t('Targets')} subtitle={user.name}>
      <ul className="list">
        <li className="add" onClick={newTarget}>{t('+ add target')}</li>
        {targets.map((tg, i) => (
          <li key={tg.id} onClick={() => setEditing(tg)}>
            <div className="list-main">
              <span>{t('From {when}', { when: when(tg.validFrom) })}</span>
              {tg.id === activeId ? <span className="tag ok">{t('active')}</span> : tg.validFrom > now ? <span className="tag">{t('upcoming')}</span> : null}
            </div>
            {i > 0 && <span className="muted">{t('until {when}', { when: when(targets[i - 1].validFrom) })}</span>}
            <span className="macros">
              {targetText(tg)}
              <span className="muted"> {t('per day')}</span>
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
  const [rows, setRows] = useState(() => targetRows(target))
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
    const problem = await saveTarget(target, validFrom, rows)
    if (problem) return alert(problem.alert)
    onClose()
  }
  async function remove() {
    if (confirm(t('Delete this target?'))) {
      await db.targets.delete(target.id)
      onClose()
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} onKeyDown={enterSaves(save)}>
        <h2>{target.id ? t('Edit target') : t('New target')}</h2>
        <Field label={t('Valid from')}>
          <DateTimeInput value={validFrom} onChange={setValidFrom} />
        </Field>
        <div className="nutrients">
          <div className="n-row with-x n-head"><span>{t('per day')}</span><span>{t('min')}</span><span>{t('max')}</span><span /></div>
          {rows.map(([k, minT, maxT], i) => (
            <div className="n-row with-x" key={k}>
              <span>{byKey[k]?.label ?? k} <small className="muted">{byKey[k]?.unit}</small></span>
              <input ref={(el) => (refs.current[k] = el)} inputMode="decimal" value={minT} placeholder="–" enterKeyHint="next" onKeyDown={enterTo(adderRef)} onChange={(e) => setCell(i, 1, e.target.value)} />
              <input inputMode="decimal" value={maxT} placeholder="–" enterKeyHint="next" onKeyDown={enterTo(adderRef)} onChange={(e) => setCell(i, 2, e.target.value)} />
              <button className="icon small" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={t('Remove {name}', { name: byKey[k]?.label ?? k })}>×</button>
            </div>
          ))}
          <NutrientAdder inputRef={adderRef} options={NUTRIENTS.filter((n) => !rows.some(([k]) => k === n.key))}
            onAdd={(key) => { setRows(inOrder([...rows, [key, '', '']])); setFocusKey(key) }} />
        </div>
        <div className="row actions">
          {target.id && <button className="danger" onClick={remove}>{t('Delete')}</button>}
          <button className="secondary" onClick={onClose}>{t('Cancel')}</button>
          <button onClick={save}>{t('Save')}</button>
        </div>
      </div>
    </div>
  )
}
