import { useEffect, useState } from 'react'
import { getConfig, saveConfig } from '../db'
import { Field, Screen } from '../components'

export default function Config() {
  const [form, setForm] = useState(null)
  useEffect(() => {
    getConfig().then((c) => setForm({ dayStart: c.dayStart, dashboard: c.dashboard }))
  }, [])
  if (!form) return null

  async function save() {
    await saveConfig({ dayStart: form.dayStart || '05:00', dashboard: form.dashboard })
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
        <div className="row actions"><button onClick={save}>Save</button></div>
      </div>
    </Screen>
  )
}
