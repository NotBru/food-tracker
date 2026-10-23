import { useEffect, useState } from 'react'
import { DEFAULT_CONFIG, getConfig, saveConfig } from '../db'
import { Field, Screen } from '../components'

// Coverage is stored as a share (0.9) and typed as a percentage (90).
const pct = (p) => String(+(p * 100).toPrecision(4))

export default function Config() {
  const [form, setForm] = useState(null)
  useEffect(() => {
    getConfig().then((c) => setForm({
      dayStart: c.dayStart, dashboard: c.dashboard, coverage: pct(c.coverage), ciqual: c.ciqual,
      capMin: String(c.adjCap.min), capMax: String(c.adjCap.max), adjGhost: c.adjGhost,
    }))
  }, [])
  if (!form) return null

  async function save() {
    const p = Number(form.coverage.trim().replace(',', '.')) / 100
    if (!(p > 0 && p < 1)) return alert('The interval must hold more than 0% and less than 100%.')
    // A blank cap is the default; 0 turns the correction off for that bound.
    const kcal = (text, def) => (text.trim() === '' ? def : Number(text.trim().replace(',', '.')))
    const adjCap = { min: kcal(form.capMin, DEFAULT_CONFIG.adjCap.min), max: kcal(form.capMax, DEFAULT_CONFIG.adjCap.max) }
    if (!(adjCap.min >= 0 && adjCap.max >= 0)) return alert('The 7-day correction caps must be 0 kcal or more.')
    await saveConfig({
      dayStart: form.dayStart || DEFAULT_CONFIG.dayStart, dashboard: form.dashboard, coverage: p, ciqual: form.ciqual,
      adjCap, adjGhost: form.adjGhost,
    })
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
        <div className="field">
          <span>7-day calorie correction: each bound moves at most (kcal)</span>
          <div className="row">
            <Field label="Min">
              <input inputMode="decimal" value={form.capMin} placeholder={String(DEFAULT_CONFIG.adjCap.min)}
                onChange={(e) => setForm({ ...form, capMin: e.target.value })} />
            </Field>
            <Field label="Max">
              <input inputMode="decimal" value={form.capMax} placeholder={String(DEFAULT_CONFIG.adjCap.max)}
                onChange={(e) => setForm({ ...form, capMax: e.target.value })} />
            </Field>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.adjGhost} onChange={(e) => setForm({ ...form, adjGhost: e.target.checked })} />
          <span>Ghost of the uncapped calorie bar (no correction caps) over the capped one</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={form.ciqual} onChange={(e) => setForm({ ...form, ciqual: e.target.checked })} />
          <span>CIQUAL's generic foods in the food database</span>
        </label>
        <div className="row actions"><button onClick={save}>Save</button></div>
      </div>
    </Screen>
  )
}
