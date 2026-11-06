import { useMemo, useState } from 'react'
import { baseAmount, consumptionNutrients, nutrientsFor, unitFactorSpan, unitsFor } from '../calc'
import { itemLabel, madeText } from '../db'
import { Select, saveFile } from '../components'
import { fmt, isCountUnit, normalizeNumber } from '../nutrients'
import { formatDateTime } from '../time'
import { drawLabel, labelFile } from '../label'

// The food Info tab's 🖨: a nutrition label as an image (label.js), for the amount picked here. It starts at what
// was eaten when the food was opened from a consumption (`log`), else at the Info tab's "per" amount; the other
// choices are a tap away. The eaten amount counts as the consumption does (its ±Δ and entry error), so the label
// matches its info screen; any other amount is taken as exact, as in the Info tab.

const amountLabel = (amount, delta, unit) => `${fmt(amount, 2)}${delta > 0 ? ` ±${fmt(delta, 2)}` : ''} ${unit}`

/** "≈ 75 ±5 g" for an amount in a counted unit (slice, u…), when the food converts it to grams (or ml). */
function measureNote(item, amount, unit) {
  if (!isCountUnit(unit)) return ''
  for (const to of ['g', 'ml']) {
    const [f, lo, hi] = unitFactorSpan(unit, to, item.units)
    if (Number.isFinite(f)) {
      const d = Math.max(hi - f, f - lo) * amount
      return `≈ ${amountLabel(f * amount, d, to)}`
    }
  }
  return ''
}

export default function LabelSheet({ ctx, item, log, per, onClose }) {
  const units = unitsFor(ctx, item.id)
  const [baseAmt, baseUnit] = baseAmount(item)
  const eaten = log && log.itemId === item.id ? log : null
  const presets = [
    eaten && { key: 'eaten', text: String(eaten.amount), unit: eaten.unit, label: `Eaten: ${amountLabel(eaten.amount, eaten.amountDelta, eaten.unit)}` },
    { key: 'base', text: String(baseAmt), unit: baseUnit, label: `Food's amount: ${fmt(baseAmt, 2)} ${baseUnit}` },
  ].filter(Boolean)
  const start = eaten ? presets[0] : { key: 'per', text: per.text, unit: per.unit }
  const [pick, setPick] = useState(start) // { key, text, unit }; key 'custom' once typed in
  const set = (patch) => setPick((p) => ({ ...p, ...patch, key: 'custom' }))

  const amount = Number(normalizeNumber(pick.text))
  const label = useMemo(() => {
    if (pick.key === 'eaten') {
      const note = [`eaten ${formatDateTime(eaten.datetime)}`, measureNote(item, eaten.amount, eaten.unit)].filter(Boolean).join(' · ')
      const res = consumptionNutrients(ctx, eaten)
      return { per: amountLabel(eaten.amount, eaten.amountDelta, eaten.unit), perNote: note, ...res }
    }
    if (!(amount > 0)) return null
    return { per: `${fmt(amount, 2)} ${pick.unit}`, perNote: measureNote(item, amount, pick.unit), ...nutrientsFor(ctx, item.id, amount, pick.unit, 0) }
  }, [ctx, item, eaten, pick, amount])
  const canvas = useMemo(() => label && drawLabel({ title: itemLabel(item), made: madeText(item), ...label }), [label, item])
  const src = useMemo(() => canvas?.toDataURL('image/png'), [canvas])

  async function save() {
    await saveFile(await labelFile(canvas, item.name || 'label', label.per))
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet label-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Nutrition label</h2>
        <div className="row label-presets">
          {presets.map((p) => (
            <button key={p.key} className={pick.key === p.key ? '' : 'secondary'} onClick={() => setPick(p)}>{p.label}</button>
          ))}
        </div>
        <div className="row info-per">
          <span className="muted">per</span>
          <input inputMode="decimal" value={pick.text} onChange={(e) => set({ text: e.target.value })} aria-label="Amount" />
          <Select value={pick.unit} options={units.map((u) => ({ value: u, label: u }))} onChange={(u) => set({ unit: u })} aria-label="Unit" />
        </div>
        {src ? <img className="label-preview" src={src} alt="Nutrition label" /> : <p className="muted small">Type an amount.</p>}
        <div className="row actions">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button disabled={!canvas} onClick={save}>Save image</button>
        </div>
      </div>
    </div>
  )
}
