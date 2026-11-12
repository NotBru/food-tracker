import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getConfig, itemLabel } from '../db'
import { consumptionNutrients, loadContext, resolve, span } from '../calc'
import { amountText, fmt } from '../nutrients'
import { DEFAULT_ENTRY_ERROR } from '../errors'
import { formatDateTime } from '../time'
import { MadeTag, MacroLine, PrinterIcon, Screen, go } from '../components'
import { Amount, NutrientTable } from './FoodInfo'
import { ConsumptionEditor, useRestored } from './Consumptions'
import EnergyChart from './EnergyChart'
import LabelSheet from './LabelSheet'
import { t } from '../i18n'

// Info screen of one consumption (opened from the Consumptions list or a breakdown): everything for exactly the
// amount eaten (amount ± Δ, as everywhere else), with its energy by macro on top (EnergyChart.jsx).
// 🖨 opens the food's nutrition label (LabelSheet.jsx) at the amount eaten; ✎ opens the usual editor sheet over it.

/** `nutrient` (opened from a breakdown) is passed on to the food's Info tab, which ranks its components by it. */
export default function ConsumptionInfo({ id, nutrient }) {
  // Back from "+ register food": the editor as it was, until it's closed.
  const restored = useRestored()
  const [editing, setEditing] = useState(() => (restored ? 'restored' : false))
  const [printing, setPrinting] = useState(false)
  const data = useLiveQuery(async () => {
    const [log, ctx, config] = await Promise.all([db.logs.get(id), loadContext(), getConfig()])
    return { id, log, ctx, dayStart: config.dayStart }
  }, [id])
  if (!data || data.id !== id) return null
  const { log, ctx } = data
  if (!log) return <Screen title={t('Consumption')}><p className="muted">{t('Consumption not found (deleted?).')}</p></Screen>

  const item = resolve(ctx, log.itemId)
  const res = consumptionNutrients(ctx, log)
  const [, lo, hi] = span(log.amount, log.amountDelta)

  return (
    <Screen title={item ? itemLabel(item) : t('(deleted item)')} subtitle={formatDateTime(log.datetime)}
      right={
        <span className="topbar-actions">
          {item && <button className="icon" onClick={() => setPrinting(true)} aria-label={t('Nutrition label')}><PrinterIcon /></button>}
          <button className="icon" onClick={() => setEditing(true)} aria-label={t('Edit')}>✎</button>
        </span>
      }>
      <ul className="info-list">
        <li>
          <span>{t('Amount eaten')}</span>
          <span><Amount value={log.amount} lo={lo} hi={hi} unit={log.unit} delta={log.amountDelta || 0} /></span>
          {log.amountText && log.amountText !== String(log.amount) && <span className="muted small">{t('typed as {text}', { text: amountText(log.amount, log.amountText) })}</span>}
        </li>
        {item && !item.components?.length && (
          <li>
            <span>{t('Entry error')}</span>
            <span>{fmt((Number.isFinite(log.entryError) ? log.entryError : DEFAULT_ENTRY_ERROR) * 100, 2)}%</span>
          </li>
        )}
        {item && (
          <li className="info-link" onClick={() => go(`/foods/${item.id}?tab=info${nutrient ? `&nutrient=${nutrient}` : ''}&log=${encodeURIComponent(log.id)}`)}>
            <span>{t('Food')}</span>
            <span>{itemLabel(item)} <MadeTag item={item} /> <span className="muted">· {t('info')} ›</span></span>
          </li>
        )}
        <li><MacroLine nutrients={res.nutrients} ok={res.ok} deltas /></li>
      </ul>

      {!res.ok && <p className="warn small">{t("Some of it can't be computed (missing food or unit conversion).")}</p>}

      <h3>{t('Energy by macro')}</h3>
      <EnergyChart nutrients={res.nutrients} />

      <h3>{t('Nutrients')}</h3>
      <NutrientTable nutrients={res.nutrients} />

      {printing && <LabelSheet ctx={ctx} item={item} log={log} per={{ text: String(log.amount), unit: log.unit }} onClose={() => setPrinting(false)} />}
      {editing && (
        <ConsumptionEditor ctx={ctx} dayStart={data.dayStart} consumption={log} restored={editing === 'restored' ? restored : null}
          onClose={() => setEditing(false)} onDeleted={() => history.back()} />
      )}
    </Screen>
  )
}
