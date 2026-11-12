import { useState } from 'react'
import { calories, fmt, pmText } from '../nutrients'
import { energySplit } from '../energy'
import { t } from '../i18n'

// Energy of an amount of food, computed from the grams of each macro (Atwater 9/4/4, 7 for alcohol), not the
// energy registered for it: a donut with the total in the middle, fat and carbohydrates split into their kinds, and
// a legend table. Used by a consumption's info screen and a food's Info tab.

/** A tone's colour at `shade` (energy.js), mixed with the background. */
const colorOf = ({ tone, shade }) => (shade < 1 ? `color-mix(in srgb, var(--${tone}) ${shade * 100}%, var(--bg))` : `var(--${tone})`)

/** Energy from the macros' mean grams: the donut's total. */
export const macroKcal = (n) => energySplit(n).total

const R = 80
const C = 2 * Math.PI * R
const GAP = 2 // px of background between slices

/** Donut of the slices; the centre shows the total, or the slice hovered/tapped. */
function Donut({ split: { macros, total, totalN } }) {
  const [active, setActive] = useState(null)
  const slices = macros.flatMap((m) => m.slices.filter((s) => s.kcal > 0).map((s) => ({ ...s, macro: m.label })))
  const many = slices.length > 1
  let at = 0
  const shown = active != null ? slices[active] : null
  const pct = (x) => (total > 0 ? fmt((x / total) * 100, 0) : 0)
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 200 200" className="donut" role="img" aria-label={t('{kcal} kcal from macros', { kcal: fmt(total, 0) })}>
        <circle cx="100" cy="100" r={R} className="donut-track" />
        {slices.map((s, i) => {
          const len = (s.kcal / total) * C
          const start = at
          at += len
          return (
            <circle key={i} cx="100" cy="100" r={R} className={`donut-slice${active === i ? ' on' : ''}`} style={{ stroke: colorOf(s) }}
              strokeDasharray={`${Math.max(0.5, len - (many ? GAP : 0))} ${C}`} strokeDashoffset={-start}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
              onClick={() => setActive((a) => (a === i ? null : i))}>
              <title>{s.label}: {fmt(s.kcal, 0)} kcal ({pct(s.kcal)}%)</title>
            </circle>
          )
        })}
      </svg>
      <div className="donut-center">
        {shown ? (
          <>
            <b>{fmt(shown.kcal, 0)}</b>
            <span>kcal · {pct(shown.kcal)}%</span>
            <small>{shown.label}</small>
          </>
        ) : (
          <>
            <b>{fmt(total, 0)}</b>
            <span>{pmText(totalN, 0)} kcal</span>
          </>
        )}
      </div>
    </div>
  )
}

function EnergyLegend({ split: { macros, total } }) {
  const pct = (x) => (total > 0 ? `${fmt((x / total) * 100, 0)}%` : '')
  return (
    <table className="info-table energy-legend">
      <tbody>
        {macros.map((m) => [
          <tr key={m.key} className="macro">
            <td><span className="swatch" style={{ background: colorOf({ tone: m.tone, shade: 1 }) }} />{m.label}</td>
            <td className="num">{fmt(m.g)} {pmText(m.n)} <span className="muted">g</span></td>
            <td className="num">{fmt(m.kcal, 0)} {pmText(m.kcalN, 0)} <span className="muted">kcal</span></td>
            <td className="num">{pct(m.kcal)}</td>
          </tr>,
          // A macro with no kinds listed is one slice; its own row says it all.
          ...(m.slices.length > 1 ? m.slices.map((s) => (
            <tr key={`${m.key}:${s.label}`} className="kind">
              <td><span className="swatch" style={{ background: colorOf(s) }} />{s.label}</td>
              <td className="num muted">{fmt(s.g)} g</td>
              <td className="num muted">{fmt(s.kcal, 0)} kcal</td>
              <td className="num muted">{pct(s.kcal)}</td>
            </tr>
          )) : []),
        ])}
      </tbody>
    </table>
  )
}

/** Donut, legend and a note on how it's computed, for `nutrients` (from nutrientsFor). */
export default function EnergyChart({ nutrients }) {
  const energy = energySplit(nutrients)
  const registered = calories(nutrients)
  return (
    <>
      <Donut split={energy} />
      <EnergyLegend split={energy} />
      <p className="muted small energy-note">
        {energy.macros.some((m) => m.key === 'alcohol') ? t('From the grams: 9 kcal/g fat, 4 proteins and carbohydrates, 7 alcohol.') : t('From the grams: 9 kcal/g fat, 4 proteins and carbohydrates.')}
        {!registered.estimated && <> {t('Registered energy: {kcal} kcal.', { kcal: `${fmt(registered.value, 0)} ${pmText(registered, 0)}` })}</>}
      </p>
    </>
  )
}
