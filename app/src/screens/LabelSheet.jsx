import { useMemo, useState } from 'react'
import { unitsFor } from '../calc'
import { Select, saveFile } from '../components'
import { drawLabel, labelChoices, labelFile, labelFor } from '../label'
import { t } from '../i18n'

// The food Info tab's 🖨: a nutrition label as an image (label.js), for the amount picked here. Its choices and
// what each shows: label.js labelChoices, labelFor (the Android app's sheet uses them too).

export default function LabelSheet({ ctx, item, log, per, onClose }) {
  const units = unitsFor(ctx, item.id)
  const { eaten, presets, start } = labelChoices(item, log, per)
  const [pick, setPick] = useState(start) // { key, text, unit }; key 'custom' once typed in
  const set = (patch) => setPick((p) => ({ ...p, ...patch, key: 'custom' }))

  const label = useMemo(() => labelFor(ctx, item, eaten, pick), [ctx, item, eaten, pick])
  const canvas = useMemo(() => label && drawLabel(label), [label])
  const src = useMemo(() => canvas?.toDataURL('image/png'), [canvas])

  async function save() {
    await saveFile(await labelFile(canvas, item.name || 'label', label.per))
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet label-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{t('Nutrition label')}</h2>
        <div className="row label-presets">
          {presets.map((p) => (
            <button key={p.key} className={pick.key === p.key ? '' : 'secondary'} onClick={() => setPick(p)}>{p.label}</button>
          ))}
        </div>
        <div className="row info-per">
          <span className="muted">{t('per')}</span>
          <input inputMode="decimal" value={pick.text} onChange={(e) => set({ text: e.target.value })} aria-label={t('Amount')} />
          <Select value={pick.unit} options={units.map((u) => ({ value: u, label: u }))} onChange={(u) => set({ unit: u })} aria-label={t('Unit')} />
        </div>
        {src ? <img className="label-preview" src={src} alt={t('Nutrition label')} /> : <p className="muted small">{t('Type an amount.')}</p>}
        <div className="row actions">
          <button className="secondary" onClick={onClose}>{t('Cancel')}</button>
          <button disabled={!canvas} onClick={save}>{t('Save image')}</button>
        </div>
      </div>
    </div>
  )
}
