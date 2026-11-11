import { useEffect, useState } from 'react'
import { DEFAULT_CONFIG, getConfig } from '../db'
import { REFERENCE_DBS, configForm, pct, saveConfigForm } from '../forms'
import { Field, Screen, Select, enterSaves, go } from '../components'

const DASHBOARD_STYLES = [
  { value: 'gauges', label: 'Gauges' },
  { value: 'bars', label: 'Bars' },
]

/** A switch row of a `.switch-list`, for the form's boolean `k`. */
function Switch({ form, setForm, k, title, about }) {
  return (
    <li>
      <label>
        <span><strong>{title}</strong><small className="muted">{about}</small></span>
        <input type="checkbox" role="switch" className="switch" checked={!!form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} />
      </label>
    </li>
  )
}

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
        <section className="config-block">
          <h2>General</h2>
          <div className="field">
            <span>Encrypted backup to the server</span>
            <div className="row"><button className="secondary" onClick={() => go('/backup')}>Backup</button></div>
          </div>
          <Field label="Day starts at (meals before this count for the previous day)">
            <input type="time" value={form.dayStart} onChange={(e) => setForm({ ...form, dayStart: e.target.value })} />
          </Field>
          <Field label="Error intervals hold (% of the probability)">
            <input inputMode="decimal" value={form.coverage} placeholder={pct(DEFAULT_CONFIG.coverage)}
              onChange={(e) => setForm({ ...form, coverage: e.target.value })} />
          </Field>
          <ul className="switch-list">
            <Switch form={form} setForm={setForm} k="showVersion" title="App version"
              about="When this version of the app was built (YYYYMMDDHHmm, local time), beside the backup icon on the homescreen." />
          </ul>
        </section>
        <section className="config-block">
          <h2>Dashboard</h2>
          <Field label="Style">
            <Select value={form.dashboard} options={DASHBOARD_STYLES} onChange={(v) => setForm({ ...form, dashboard: v })} />
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
            <Switch form={form} setForm={setForm} k="pie" title="Energy chart"
              about="Calories, protein, fat and carbs in one chart, as the dashboard's first tile." />
            <Switch form={form} setForm={setForm} k="pieSquare" title="Energy chart: square"
              about="Calories up the side, the macros' shares across. Off: round, a pie." />
            <Switch form={form} setForm={setForm} k="onlyTargets" title="Only nutrients with a target"
              about="Off: calories, protein, fat and carbs are always shown, with or without a target." />
            <Switch form={form} setForm={setForm} k="adjGhost" title="Ghost of the uncapped calorie bar"
              about="Where the bar would be with no correction caps, drawn faintly over the capped one." />
          </ul>
        </section>
        <section className="config-block">
          <h2>Food database</h2>
          <div className="field">
            <span>Reference databases (their generic foods are listed with yours)</span>
            <ul className="switch-list">
              {REFERENCE_DBS.map(([key, name, about]) => <Switch key={key} form={form} setForm={setForm} k={key} title={name} about={about} />)}
            </ul>
          </div>
          <ul className="switch-list">
            <Switch form={form} setForm={setForm} k="searchKcal" title="Calories in food searches"
              about="Each food's kcal per 100 g (or 100 ml) beside its name." />
          </ul>
        </section>
        <div className="row actions"><button onClick={save}>Save</button></div>
      </div>
    </Screen>
  )
}
