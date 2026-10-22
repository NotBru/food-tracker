import { useEffect, useState } from 'react'
import { DEFAULT_CONFIG, getConfig, saveConfig } from '../db'
import { Field, Screen } from '../components'

// Coverage is stored as a share (0.9) and typed as a percentage (90).
const pct = (p) => String(+(p * 100).toPrecision(4))

export default function Config() {
  const [form, setForm] = useState(null)
  useEffect(() => {
    getConfig().then((c) => setForm({ dayStart: c.dayStart, dashboard: c.dashboard, coverage: pct(c.coverage), ciqual: c.ciqual }))
  }, [])
  if (!form) return null

  async function save() {
    const p = Number(form.coverage.trim().replace(',', '.')) / 100
    if (!(p > 0 && p < 1)) return alert('The interval must hold more than 0% and less than 100%.')
    await saveConfig({ dayStart: form.dayStart || DEFAULT_CONFIG.dayStart, dashboard: form.dashboard, coverage: p, ciqual: form.ciqual })
    history.back()
  }

  return (
    <Screen title="Config">
      <div className="form">
        <Field label="Day starts at (meals before this count for the previous day)">
          <input type="time" value={form.dayStart} onChange={(e) => setForm({ ...form, dayStart: e.target.value })} />
        </Field>
        <div className="field">
          <span>Dashboard style</span>
          <div className="segmented" role="radiogroup" aria-label="Dashboard style">
            {[['gauges', 'Gauges'], ['bars', 'Bars']].map(([v, label]) => (
              <button key={v} role="radio" aria-checked={form.dashboard === v} className={form.dashboard === v ? 'on' : ''}
                onClick={() => setForm({ ...form, dashboard: v })}>{label}</button>
            ))}
          </div>
        </div>
        <Field label="Error intervals hold (% of the probability)">
          <input inputMode="decimal" value={form.coverage} placeholder={pct(DEFAULT_CONFIG.coverage)}
            onChange={(e) => setForm({ ...form, coverage: e.target.value })} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={form.ciqual} onChange={(e) => setForm({ ...form, ciqual: e.target.checked })} />
          <span>CIQUAL's generic foods in the food database</span>
        </label>
        <div className="row actions"><button onClick={save}>Save</button></div>
      </div>
    </Screen>
  )
}
