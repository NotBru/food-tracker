import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { loadContext } from '../calc'
import { db, fold, itemLabel, searchText } from '../db'
import { NUTRIENTS, fmt, pmText } from '../nutrients'
import { Screen, go } from '../components'
import { ROWS } from '../dashboard'
import { USER_DB, exploreDbs, exploreFoods } from '../explore'
import EnergyChart from './EnergyChart'
import { t } from '../i18n'

// One nutrient across the food databases (from a breakdown's 🔍): the foods ranked by the share of their energy the
// nutrient's low end reaches (explore.js), the picked one's energy by macro on top (mean values), and which databases to
// list below. A food's database is its "database" attribute, "user" without one. Concoctions are batches, not foods:
// left out. Fits the window: the list takes what the chart and the bottom (databases | other filters) leave. The
// search box scrolls the list to the best-ranked match, centred; Enter picks it.

export default function Explore({ nutrient }) {
  const meta = ROWS.find((r) => r.key === nutrient) ?? NUTRIENTS.find((n) => n.key === nutrient)
  const ctx = useLiveQuery(loadContext)
  // Foods any user has logged (consumptions of them; not as a recipe's component).
  const logged = useLiveQuery(async () => new Set((await db.logs.toArray()).map((l) => l.itemId)), [])
  const [off, setOff] = useState(() => new Set()) // databases switched off
  const [loggedOnly, setLoggedOnly] = useState(false)
  const [pickedId, setPickedId] = useState(null)
  const [query, setQuery] = useState('')
  const rowRefs = useRef(new Map())

  const foods = useMemo(() => (ctx && meta ? exploreFoods(ctx, nutrient, meta) : []), [ctx, nutrient, meta])
  const dbs = useMemo(() => exploreDbs(foods), [foods])
  const shown = foods.filter((f) => !off.has(f.db) && (!loggedOnly || logged?.has(f.item.id)))
  const q = fold(query.trim())
  const match = q ? shown.find((f) => searchText(f.item).includes(q)) : null
  useEffect(() => {
    rowRefs.current.get(match?.item.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [match])

  if (!meta) return <Screen className="explore" title={t('Explore')}><p className="muted">{t('Unknown nutrient.')}</p></Screen>
  if (!ctx) return <Screen className="explore" title={meta.label} subtitle={t('Explore')} />

  const picked = shown.find((f) => f.item.id === pickedId) ?? shown[0]
  const toggle = (d) => setOff((s) => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n })

  return (
    <Screen className="explore" title={meta.label} subtitle={t('Explore')}>
      {picked && (
        <section className="ex-pie">
          <p className="ex-picked">
            <button className="link" onClick={() => go(`/foods/${picked.item.id}?tab=info&nutrient=${nutrient}`)}>{itemLabel(picked.item)}</button>
            <span className="muted"> · {t('per')} {fmt(picked.per[0], 2)} {picked.per[1]}</span>
          </p>
          <EnergyChart nutrients={picked.nutrients} />
        </section>
      )}
      <input type="search" className="ex-search" value={query} placeholder={t('Find in the list')} aria-label={t('Find in the list')}
        onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && match && setPickedId(match.item.id)} />
      {q && !match && <p className="muted small ex-nomatch">{t('Not in the list.')}</p>}
      <ul className="list ex-list">
        {shown.map((f) => (
          <li key={f.item.id} ref={(el) => (el ? rowRefs.current.set(f.item.id, el) : rowRefs.current.delete(f.item.id))}
            className={[f === picked && 'on', f === match && 'found'].filter(Boolean).join(' ')} onClick={() => setPickedId(f.item.id)}>
            <div className="list-main">
              <span>{itemLabel(f.item)}</span>
              <span className="bd-value">{fmt(f.n.value, 1)}<small> {pmText(f.n)} {meta.unit}</small></span>
            </div>
            <span className="muted small">{f.text} · {t('per')} {fmt(f.per[0], 2)} {f.per[1]}</span>
          </li>
        ))}
        {!shown.length && <li className="muted">{t('No food with {nutrient} here.', { nutrient: meta.label.toLowerCase() })}</li>}
      </ul>
      <div className="ex-bottom">
        <section>
          <h3>{t('Databases')}</h3>
          <ul className="ex-switches">
            {dbs.map((d) => (
              <li key={d}><label><input type="checkbox" role="switch" className="switch" checked={!off.has(d)} onChange={() => toggle(d)} /> {d === USER_DB ? t('user') : d}</label></li>
            ))}
          </ul>
        </section>
        <section>
          <h3>{t('Foods')}</h3>
          <ul className="ex-switches">
            <li><label><input type="checkbox" role="switch" className="switch" checked={loggedOnly} onChange={(e) => setLoggedOnly(e.target.checked)} /> {t('Logged only')}</label></li>
          </ul>
        </section>
      </div>
    </Screen>
  )
}
