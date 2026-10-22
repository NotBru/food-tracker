import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { baseAmount, loadContext, nutrientsFor } from '../calc'
import { itemLabel } from '../db'
import { NUTRIENTS, calories, fmt, pmText } from '../nutrients'
import { bounds } from '../stats'
import { Screen, go } from '../components'
import { ROWS } from './Home'
import EnergyChart, { macroKcal } from './EnergyChart'

// One nutrient across the food databases (from a breakdown's 🔍): the foods ranked by the share of their energy the
// nutrient's low end reaches (`rank`), the picked one's energy by macro on top (mean values), and which databases to
// list below. A food's database is its "database" attribute, "user" without one. Concoctions are batches, not foods:
// left out. Fits the window: the list takes what the chart and the databases leave.

export const USER_DB = 'user'
export const databaseOf = (item) => item.attributes?.find(([k]) => k?.toLowerCase() === 'database')?.[1] || USER_DB

/** The nutrient (energy from macros when it isn't listed, as everywhere) of `amount unit` of `item`, or null. */
function amountOf(ctx, item, key, amount, unit) {
  const res = nutrientsFor(ctx, item.id, amount, unit)
  if (!res.ok) return null
  const n = key === 'energy' ? calories(res.nutrients) : res.nutrients[key]
  return n && Number.isFinite(n.value) ? { n, nutrients: res.nutrients } : null
}

// kcal per gram of the nutrients that carry energy (EnergyChart's Atwater factors; fibre at the EU's 2).
const KCAL_PER_G = {
  fat: 9, saturatedFat: 9, monounsaturatedFat: 9, polyunsaturatedFat: 9, omega3: 9, transFat: 9,
  proteins: 4, carbohydrates: 4, sugars: 4, addedSugars: 4, fibers: 2, alcohol: 7,
}

/**
 * The nutrient's low end (interval shown) against the food's energy from its macros (means, as in the chart): as a share of it for a nutrient with
 * energy, per 100 kcal for one without, per its amount for energy itself. [rank, text]; no energy: [-Infinity].
 */
function rank(key, n, energy, per, unit) {
  const lo = bounds(n)[0]
  if (key === 'energy') return [lo, `≥ ${fmt(lo, 0)} kcal per ${fmt(per[0], 2)} ${per[1]}`]
  if (!(energy > 0)) return [-Infinity, 'no energy']
  const f = KCAL_PER_G[key]
  if (f) return [(lo * f) / energy, `≥ ${fmt((lo * f * 100) / energy, 0)}% of energy`]
  return [lo / energy, `≥ ${fmt((lo * 100) / energy, 2)} ${unit} per 100 kcal`]
}

export default function Explore({ nutrient }) {
  const meta = ROWS.find((r) => r.key === nutrient) ?? NUTRIENTS.find((n) => n.key === nutrient)
  const ctx = useLiveQuery(loadContext)
  const [off, setOff] = useState(() => new Set()) // databases unticked
  const [pickedId, setPickedId] = useState(null)

  const foods = useMemo(() => {
    if (!ctx || !meta) return []
    const rows = []
    for (const item of [...ctx.list, ...ctx.ciqual]) {
      if (item.madeAt) continue
      let per = [100, 'g']
      let r = amountOf(ctx, item, nutrient, ...per)
      if (!r) {
        per = baseAmount(item).slice(0, 2)
        r = amountOf(ctx, item, nutrient, ...per)
      }
      if (!r) continue
      const [score, text] = rank(nutrient, r.n, macroKcal(r.nutrients), per, meta.unit)
      rows.push({ item, db: databaseOf(item), per, score, text, ...r })
    }
    return rows.sort((a, b) => b.score - a.score)
  }, [ctx, nutrient, meta])

  const dbs = useMemo(() => [USER_DB, ...[...new Set(foods.map((f) => f.db))].filter((d) => d !== USER_DB).sort()], [foods])

  if (!meta) return <Screen className="explore" title="Explore"><p className="muted">Unknown nutrient.</p></Screen>
  if (!ctx) return <Screen className="explore" title={meta.label} subtitle="Explore" />

  const shown = foods.filter((f) => !off.has(f.db))
  const picked = shown.find((f) => f.item.id === pickedId) ?? shown[0]
  const toggle = (d) => setOff((s) => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n })

  return (
    <Screen className="explore" title={meta.label} subtitle="Explore">
      {picked && (
        <section className="ex-pie">
          <p className="ex-picked">
            <button className="link" onClick={() => go(`/foods/${picked.item.id}?tab=info&nutrient=${nutrient}`)}>{itemLabel(picked.item)}</button>
            <span className="muted"> · per {fmt(picked.per[0], 2)} {picked.per[1]}</span>
          </p>
          <EnergyChart nutrients={picked.nutrients} />
        </section>
      )}
      <ul className="list ex-list">
        {shown.map((f) => (
          <li key={f.item.id} className={f === picked ? 'on' : ''} onClick={() => setPickedId(f.item.id)}>
            <div className="list-main">
              <span>{itemLabel(f.item)}</span>
              <span className="bd-value">{fmt(f.n.value, 1)}<small> {pmText(f.n)} {meta.unit}</small></span>
            </div>
            <span className="muted small">{f.text} · per {fmt(f.per[0], 2)} {f.per[1]}</span>
          </li>
        ))}
        {!shown.length && <li className="muted">No food with {meta.label.toLowerCase()} in these databases.</li>}
      </ul>
      <h3 className="ex-dbs-title">Databases</h3>
      <ul className="ex-dbs">
        {dbs.map((d) => (
          <li key={d}>
            <label><input type="checkbox" checked={!off.has(d)} onChange={() => toggle(d)} /> {d}</label>
          </li>
        ))}
      </ul>
    </Screen>
  )
}
