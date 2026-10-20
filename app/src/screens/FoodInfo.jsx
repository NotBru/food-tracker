import { useState } from 'react'
import { baseAmount, nutrientsFor, resolve, span, unitFactorSpan, unitsFor } from '../calc'
import { itemLabel } from '../db'
import { MadeTag } from '../components'
import { MACROS, NUTRIENTS, calories, fmt, normalizeNumber } from '../nutrients'
import { ROWS } from './Home'

// Info tab of a food: every amount with its error, and the nutrients for any amount, computed with the same
// interval maths as consumptions (calc.js), so what's shown here is exactly what a consumption would get.
// Opened from a nutrient's breakdown (`nutrient`), the components are ranked by how much of it each brings, shown
// at their left.

// Energy and the macros first, then the rest in the usual order.
const FIRST = ['energy', ...MACROS]
const ORDERED = [
  ...FIRST.map((k) => NUTRIENTS.find((n) => n.key === k)),
  ...NUTRIENTS.filter((n) => !FIRST.includes(n.key)),
]

/** "50 ±1 g · 49–51 (±2%)" for a nominal value and its [low, high]. */
function Amount({ value, lo, hi, unit, delta }) {
  const d = delta ?? Math.max(hi - value, value - lo)
  return (
    <>
      <b>{fmt(value, 2)}</b>{d > 0 ? <> ±{fmt(d, 2)}</> : ' (exact)'} {unit}
      {d > 0 && <span className="muted"> · {fmt(lo, 2)}–{fmt(hi, 2)} (±{fmt((d / value) * 100, 1)}%)</span>}
    </>
  )
}

export default function FoodInfo({ ctx, item, nutrient }) {
  const [baseAmt, baseUnit, baseDelta] = baseAmount(item)
  const units = unitsFor(ctx, item.id)
  const [perText, setPerText] = useState(String(baseAmt))
  const [perUnit, setPerUnit] = useState(units[0] ?? baseUnit)
  const per = Number(normalizeNumber(perText))
  const res = per > 0 ? nutrientsFor(ctx, item.id, per, perUnit, 0) : null
  const rows = res
    ? ORDERED.map((n) => [n, n.key === 'energy' ? calories(res.nutrients) : res.nutrients[n.key]])
      .filter(([n, v]) => v && Number.isFinite(v.value) && (v.value !== 0 || v.delta > 0 || n.key === 'energy'))
    : []
  // The nutrient the components are ranked by (Calories/Protein/… as on the dashboard); unknown keys are ignored.
  const lead = ROWS.find((r) => r.key === nutrient) ?? NUTRIENTS.find((n) => n.key === nutrient)
  const components = (item.components ?? []).map((c, i) => {
    const sub = nutrientsFor(ctx, c.itemId, c.amount, c.unit, c.amountDelta)
    const v = lead && (lead.key === 'energy' ? calories(sub.nutrients) : sub.nutrients[lead.key])
    return { c, i, sub, v: sub.ok && v && Number.isFinite(v.value) ? v : null }
  })
  // Largest first; ones that can't be computed last. Stable, so ties keep the recipe's order.
  if (lead) components.sort((a, b) => (b.v?.value ?? -Infinity) - (a.v?.value ?? -Infinity))

  return (
    <div className="food-info">
      <h3>Amounts</h3>
      <ul className="info-list">
        <li>
          <span>Nutrients are per</span>
          <span><Amount value={baseAmt} lo={span(baseAmt, baseDelta)[1]} hi={span(baseAmt, baseDelta)[2]} unit={baseUnit} delta={baseDelta} /></span>
        </li>
        {(item.units ?? []).map((u, i) => {
          // This conversion alone: (to ± Δ) / (from ± Δ), worst case.
          const [f, lo, hi] = unitFactorSpan(u.fromUnit, u.toUnit, [u])
          return (
            <li key={`u${i}`}>
              {/* As typed, unless that's already "1 <unit>" (then the derived line below says the same). */}
              {!(u.fromAmount === 1 && !(u.fromDelta > 0)) && (
                <span>{fmt(u.fromAmount, 2)}{u.fromDelta > 0 && ` ±${fmt(u.fromDelta, 2)}`} {u.fromUnit} = {fmt(u.toAmount, 2)}{u.toDelta > 0 && ` ±${fmt(u.toDelta, 2)}`} {u.toUnit}</span>
              )}
              <span>1 {u.fromUnit} = <Amount value={f} lo={lo} hi={hi} unit={u.toUnit} /></span>
            </li>
          )
        })}
        {lead && components.length > 0 && <li className="info-note muted small">Components by {lead.label.toLowerCase()}, largest first</li>}
        {components.map(({ c, i, sub, v }) => {
          const kcal = calories(sub.nutrients)
          const [, lo, hi] = span(c.amount, c.amountDelta)
          const child = resolve(ctx, c.itemId)
          return (
            <li key={`c${i}`} className={lead ? 'has-lead' : undefined}>
              {lead && (
                <b className="info-lead">
                  {v ? <>{v.estimated ? '~' : ''}{fmt(v.value)}<small>±{fmt(v.delta)} {lead.unit}</small></> : <>–<small>{lead.unit}</small></>}
                </b>
              )}
              <span>{child ? <>{itemLabel(child)} <MadeTag item={child} /></> : '(missing item)'}</span>
              <span>
                <Amount value={c.amount} lo={lo} hi={hi} unit={c.unit} delta={c.amountDelta || 0} />
                <span className="muted"> → {sub.ok ? <>{fmt(kcal.value, 0)} ±{fmt(kcal.delta)} kcal</> : "can't compute"}</span>
              </span>
            </li>
          )
        })}
      </ul>

      <h3>Nutrients</h3>
      <div className="row info-per">
        <span className="muted">per</span>
        <input inputMode="decimal" value={perText} onChange={(e) => setPerText(e.target.value)} aria-label="Amount" />
        <select value={perUnit} onChange={(e) => setPerUnit(e.target.value)} aria-label="Unit">
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <p className="muted small">
        Taken as exact; the ranges include the error of every amount above and of each value
        {item.components?.length ? ' (summed over the components)' : ''}, worst case.
      </p>
      {res && !res.ok && <p className="warn small">Some of it can't be computed (missing food or unit conversion).</p>}
      <table className="info-table">
        <tbody>
          {rows.map(([n, v]) => (
            <tr key={n.key}>
              <td>{n.label}{v.missing && <span className="warn"> *</span>}</td>
              <td className="num"><b>{v.estimated ? '~' : ''}{fmt(v.value)}</b> ±{fmt(v.delta)} <span className="muted">{n.unit}</span></td>
              <td className="num muted">{fmt(Math.max(0, v.value - v.delta))}–{fmt(v.value + v.delta)}</td>
              <td className="num muted">{v.value > 0 ? `±${fmt((v.delta / v.value) * 100, 1)}%` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.some(([, v]) => v.missing) && <p className="muted small"><span className="warn">*</span> some components don't have this value.</p>}
    </div>
  )
}
