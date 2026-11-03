import { useEffect, useState } from 'react'
import { DEFAULT_CONFIG, getConfig } from '../db'
import { REFERENCE_DBS, configForm, pct, saveConfigForm } from '../forms'
import { Field, Screen, enterSaves, go } from '../components'

export default function Config() {
  const [form, setForm] = useState(null)
  useEffect(() => {
    getConfig().then((c) => setForm(configForm(c)))
  }, [])
  if (!form) return null

  async function save() {
    const problem = await saveConfigForm(form)
    if (problem) return alert(problem.alert)
    history.back()
  }

  return (
    <Screen title="Config">
      <div className="form" onKeyDown={enterSaves(save)}>
        <div className="field">
          <span>Encrypted backup to the server</span>
          <div className="row"><button className="secondary" onClick={() => go('/backup')}>Backup</button></div>
        </div>
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
        <ul className="switch-list">
          <li>
            <label>
              <span><strong>Ghost of the uncapped calorie bar</strong><small className="muted">Where the bar would be with no correction caps, drawn faintly over the capped one.</small></span>
              <input type="checkbox" role="switch" className="switch" checked={form.adjGhost}
                onChange={(e) => setForm({ ...form, adjGhost: e.target.checked })} />
            </label>
          </li>
          <li>
            <label>
              <span><strong>App version</strong><small className="muted">When this version of the app was built (YYYYMMDDHHmm, local time), beside the backup icon on the homescreen.</small></span>
              <input type="checkbox" role="switch" className="switch" checked={form.showVersion}
                onChange={(e) => setForm({ ...form, showVersion: e.target.checked })} />
            </label>
          </li>
        </ul>
        <div className="field">
          <span>Reference databases (their generic foods are listed with yours)</span>
          <ul className="switch-list">
            {REFERENCE_DBS.map(([key, name, about]) => (
              <li key={key}>
                <label>
                  <span><strong>{name}</strong><small className="muted">{about}</small></span>
                  <input type="checkbox" role="switch" className="switch" checked={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="row actions"><button onClick={save}>Save</button></div>
      </div>
    </Screen>
  )
}
