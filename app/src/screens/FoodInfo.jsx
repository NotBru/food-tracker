import { useState } from 'react'
import { baseAmount, nutrientsFor, resolve, span, unitFactorSpan, unitsFor } from '../calc'
import { itemLabel } from '../db'
import { MadeTag, Select } from '../components'
import { MACROS, NUTRIENTS, calories, fmt, normalizeNumber, pmText, rangeText } from '../nutrients'
import { getCoverage, sdOf } from '../stats'
import { DEFAULT_ENTRY_ERROR, categoryName } from '../errors'
import { ROWS } from './Home'
import EnergyChart from './EnergyChart'

// Info tab of a food: the nutrients for any amount (picked on top), computed with the same error maths as
// consumptions (calc.js), so what's shown here is exactly what a consumption would get: its energy by macro
// (EnergyChart.jsx, as on a consumption's info screen), every nutrient, then every amount with its error.
// Opened from a nutrient's breakdown (`nutrient`), the components are ranked by how much of it each brings, shown
// at their left.

// Energy and the macros first, then the rest in the usual order.
const FIRST = ['energy', ...MACROS]
const ORDERED = [
  ...FIRST.map((k) => NUTRIENTS.find((n) => n.key === k)),
  ...NUTRIENTS.filter((n) => !FIRST.includes(n.key)),
]

/** "50 ±1 g · 49–51 (±2%)" for a nominal value and its [low, high]. */
export function Amount({ value, lo, hi, unit, delta }) {
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
      <div className="row info-per">
        <span className="muted">per</span>
        <input inputMode="decimal" value={perText} onChange={(e) => setPerText(e.target.value)} aria-label="Amount" />
        <Select value={perUnit} options={units.map((u) => ({ value: u, label: u }))} onChange={setPerUnit} aria-label="Unit" />
      </div>
      {res && res.ok && (
        <>
          <h3>Energy by macro</h3>
          <EnergyChart nutrients={res.nutrients} />
        </>
      )}
      <h3>Nutrients</h3>
      <p className="muted small">
        Taken as exact; each range holds {fmt(getCoverage() * 100)}% of the probability. It includes how much a sample of
        {item.components?.length ? ' each component' : ' this food'} varies (by category), how far the entry may be from
        what's eaten ({fmt(DEFAULT_ENTRY_ERROR * 100)}%, set per consumption), the digits of its values and the error of every amount (under Amounts).
      </p>
      {res && !res.ok && <p className="warn small">Some of it can't be computed (missing food or unit conversion).</p>}
      {res && <NutrientTable nutrients={res.nutrients} />}
      <h3 className="info-amounts">Amounts</h3>
      <ul className="info-list">
        {!item.components?.length && (
          <li>
            <span>Category</span>
            <span>{categoryName(item.category)}</span>
          </li>
        )}
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
                  {v ? <>{v.estimated ? '~' : ''}{fmt(v.value)}<small>{pmText(v)} {lead.unit}</small></> : <>–<small>{lead.unit}</small></>}
                </b>
              )}
              <span>{child ? <>{itemLabel(child)} <MadeTag item={child} /></> : '(missing item)'}</span>
              <span>
                <Amount value={c.amount} lo={lo} hi={hi} unit={c.unit} delta={c.amountDelta || 0} />
                <span className="muted"> → {sub.ok ? <>{fmt(kcal.value, 0)} {pmText(kcal, 0)} kcal</> : "can't compute"}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Every known nutrient of `nutrients` (from nutrientsFor): value with its interval, range and relative deviation
 * (CV). Also used by the consumption info screen. */
export function NutrientTable({ nutrients }) {
  const rows = ORDERED.map((n) => [n, n.key === 'energy' ? calories(nutrients) : nutrients[n.key]])
    .filter(([n, v]) => v && Number.isFinite(v.value) && (v.value !== 0 || sdOf(v) > 0 || n.key === 'energy'))
  return (
    <>
      <table className="info-table">
        <tbody>
          {rows.map(([n, v]) => (
            <tr key={n.key}>
              <td>{n.label}{v.missing && <span className="warn"> *</span>}</td>
              <td className="num"><b>{v.estimated ? '~' : ''}{fmt(v.value)}</b> {pmText(v)} <span className="muted">{n.unit}</span></td>
              <td className="num muted">{rangeText(v, 1)}</td>
              <td className="num muted">{v.value > 0 ? `CV ${fmt((sdOf(v) / v.value) * 100, 1)}%` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.some(([, v]) => v.missing) && <p className="muted small"><span className="warn">*</span> some components don't have this value.</p>}
    </>
  )
}
