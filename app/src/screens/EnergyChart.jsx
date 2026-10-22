import { useState } from 'react'
import { calories, fmt, pmText } from '../nutrients'
import { addScaled, zero } from '../stats'

// Energy of an amount of food, computed from the grams of each macro (Atwater 9/4/4, 7 for alcohol), not the
// energy registered for it: a donut with the total in the middle, fat and carbohydrates split into their kinds, and
// a legend table. Used by a consumption's info screen and a food's Info tab.

const KCAL_PER_G = { fat: 9, proteins: 4, carbohydrates: 4, alcohol: 7 }

// Kinds of a macro, as far as the food lists them. A kind with kinds of its own is split again (omega-3 is part of
// the polyunsaturated fat, added sugars part of the sugars); `rest` names what the listed kinds leave over.
// Carbohydrates are taken as excluding fibre (EU labels, CIQUAL), like the 4 kcal/g estimate everywhere else.
const MACROS = [
  { key: 'fat', label: 'Fat', color: 'var(--fat)', rest: 'Unspecified fat', kinds: [
    { key: 'saturatedFat', label: 'Saturated' },
    { key: 'monounsaturatedFat', label: 'Monounsaturated' },
    { key: 'polyunsaturatedFat', label: 'Polyunsaturated', rest: 'Other polyunsaturated', kinds: [{ key: 'omega3', label: 'Omega-3' }] },
    { key: 'transFat', label: 'Trans' },
  ] },
  { key: 'proteins', label: 'Proteins', color: 'var(--prot)' },
  { key: 'carbohydrates', label: 'Carbohydrates', color: 'var(--carb)', rest: 'Starch & other', kinds: [
    { key: 'sugars', label: 'Sugars', rest: 'Other sugars', kinds: [{ key: 'addedSugars', label: 'Added sugars' }] },
  ] },
  { key: 'alcohol', label: 'Alcohol', color: 'var(--muted)', optional: true },
]

/** Grams of `key`, or null when no food in the consumption lists it. */
function grams(n, key) {
  const v = n[key]
  return v && Number.isFinite(v.value) && !(v.missing && v.value === 0) ? Math.max(0, v.value) : null
}

/**
 * `g` grams of `node` -> leaves [{label, g}]. The listed kinds take their share and the rest goes to `rest`; kinds
 * adding up to more than their total (rounded labels) are scaled down to fit. Nothing listed: the node is one leaf.
 */
function split(n, node, g) {
  const parts = (node.kinds ?? []).map((k) => [k, grams(n, k.key)]).filter(([, v]) => v > 0)
  if (!parts.length) return [{ label: node.label, g }]
  const sum = parts.reduce((s, [, v]) => s + v, 0)
  const scale = sum > g ? g / sum : 1
  const out = parts.flatMap(([k, v]) => split(n, k, v * scale))
  const rest = g - sum * scale
  if (rest > 1e-9) out.push({ label: node.rest, g: rest })
  return out
}

/** Energy from grams, per macro and per kind: {macros: [{…macro, g, n, kcal, kcalN, slices}], total, totalN}; the
 * `…N` are distributions (stats.js) of the grams and the kcal. */
function energySplit(n) {
  const macros = MACROS.map((m) => {
    const g = grams(n, m.key) ?? 0
    const f = KCAL_PER_G[m.key]
    const leaves = split(n, m, g)
    const slices = leaves.map((l, i) => ({
      ...l, kcal: l.g * f,
      // Shades of the macro's colour, from full to about half-way to the background.
      color: leaves.length > 1 ? `color-mix(in srgb, ${m.color} ${100 - (i * 55) / (leaves.length - 1)}%, var(--bg))` : m.color,
    }))
    const gN = grams(n, m.key) != null ? n[m.key] : zero()
    return { ...m, g, n: gN, kcal: g * f, kcalN: addScaled(zero(), gN, f), slices }
  }).filter((m) => !m.optional || m.g > 0)
  return {
    macros,
    total: macros.reduce((s, m) => s + m.kcal, 0),
    totalN: macros.reduce((t, m) => addScaled(t, m.kcalN), zero()),
  }
}

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
      <svg viewBox="0 0 200 200" className="donut" role="img" aria-label={`${fmt(total, 0)} kcal from macros`}>
        <circle cx="100" cy="100" r={R} className="donut-track" />
        {slices.map((s, i) => {
          const len = (s.kcal / total) * C
          const start = at
          at += len
          return (
            <circle key={i} cx="100" cy="100" r={R} className={`donut-slice${active === i ? ' on' : ''}`} style={{ stroke: s.color }}
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
            <td><span className="swatch" style={{ background: m.color }} />{m.label}</td>
            <td className="num">{fmt(m.g)} {pmText(m.n)} <span className="muted">g</span></td>
            <td className="num">{fmt(m.kcal, 0)} {pmText(m.kcalN, 0)} <span className="muted">kcal</span></td>
            <td className="num">{pct(m.kcal)}</td>
          </tr>,
          // A macro with no kinds listed is one slice; its own row says it all.
          ...(m.slices.length > 1 ? m.slices.map((s) => (
            <tr key={`${m.key}:${s.label}`} className="kind">
              <td><span className="swatch" style={{ background: s.color }} />{s.label}</td>
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
        From the grams: 9 kcal/g fat, 4 proteins and carbohydrates{energy.macros.some((m) => m.key === 'alcohol') && ', 7 alcohol'}.
        {!registered.estimated && <> Registered energy: {fmt(registered.value, 0)} {pmText(registered, 0)} kcal.</>}
      </p>
    </>
  )
}
