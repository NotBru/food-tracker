import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getConfig, itemLabel } from '../db'
import { consumptionNutrients, loadContext, resolve, span } from '../calc'
import { amountText } from '../nutrients'
import { formatDateTime } from '../time'
import { MadeTag, MacroLine, Screen, go } from '../components'
import { Amount, NutrientTable } from './FoodInfo'
import { ConsumptionEditor } from './Consumptions'
import EnergyChart from './EnergyChart'

// Info screen of one consumption (opened from the Consumptions list or a breakdown): everything for exactly the
// amount eaten (amount ± Δ, as everywhere else), with its energy by macro on top (EnergyChart.jsx).
// ✎ opens the usual editor sheet over it.

/** `nutrient` (opened from a breakdown) is passed on to the food's Info tab, which ranks its components by it. */
export default function ConsumptionInfo({ id, nutrient }) {
  const [editing, setEditing] = useState(false)
  const data = useLiveQuery(async () => {
    const [log, ctx, config] = await Promise.all([db.logs.get(Number(id)), loadContext(), getConfig()])
    return { id, log, ctx, dayStart: config.dayStart }
  }, [id])
  if (!data || data.id !== id) return null
  const { log, ctx } = data
  if (!log) return <Screen title="Consumption"><p className="muted">Consumption not found (deleted?).</p></Screen>

  const item = resolve(ctx, log.itemId)
  const res = consumptionNutrients(ctx, log)
  const [, lo, hi] = span(log.amount, log.amountDelta)

  return (
    <Screen title={item ? itemLabel(item) : '(deleted item)'} subtitle={formatDateTime(log.datetime)}
      right={<button className="icon" onClick={() => setEditing(true)} aria-label="Edit">✎</button>}>
      <ul className="info-list">
        <li>
          <span>Amount eaten</span>
          <span><Amount value={log.amount} lo={lo} hi={hi} unit={log.unit} delta={log.amountDelta || 0} /></span>
          {log.amountText && log.amountText !== String(log.amount) && <span className="muted small">typed as {amountText(log.amount, log.amountText)}</span>}
        </li>
        {item && (
          <li className="info-link" onClick={() => go(`/foods/${item.id}?tab=info${nutrient ? `&nutrient=${nutrient}` : ''}`)}>
            <span>Food</span>
            <span>{itemLabel(item)} <MadeTag item={item} /> <span className="muted">· info ›</span></span>
          </li>
        )}
        <li><MacroLine nutrients={res.nutrients} ok={res.ok} deltas /></li>
      </ul>

      {!res.ok && <p className="warn small">Some of it can't be computed (missing food or unit conversion).</p>}

      <h3>Energy by macro</h3>
      <EnergyChart nutrients={res.nutrients} />

      <h3>Nutrients</h3>
      <NutrientTable nutrients={res.nutrients} />

      {editing && (
        <ConsumptionEditor ctx={ctx} dayStart={data.dayStart} consumption={log}
          onClose={() => setEditing(false)} onDeleted={() => history.back()} />
      )}
    </Screen>
  )
}
