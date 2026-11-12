import { useEffect, useState } from 'react'
import { DEFAULT_CONFIG, getConfig } from '../db'
import { REFERENCE_DBS, configForm, pct, saveConfigForm } from '../forms'
import { Field, Screen, Select, enterSaves, go } from '../components'
import { t, translated } from '../i18n'

const DASHBOARD_STYLES = translated([
  { value: 'gauges', label: 'Gauges' },
  { value: 'bars', label: 'Bars' },
])

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
    <Screen title={t('Config')}>
      <div className="form" onKeyDown={enterSaves(save)}>
        <section className="config-block">
          <h2>{t('General')}</h2>
          <div className="field">
            <span>{t('Encrypted backup to the server')}</span>
            <div className="row"><button className="secondary" onClick={() => go('/backup')}>{t('Backup')}</button></div>
          </div>
          <Field label={t('Day starts at (meals before this count for the previous day)')}>
            <input type="time" value={form.dayStart} onChange={(e) => setForm({ ...form, dayStart: e.target.value })} />
          </Field>
          <Field label={t('Error intervals hold (% of the probability)')}>
            <input inputMode="decimal" value={form.coverage} placeholder={pct(DEFAULT_CONFIG.coverage)}
              onChange={(e) => setForm({ ...form, coverage: e.target.value })} />
          </Field>
          <ul className="switch-list">
            <Switch form={form} setForm={setForm} k="showVersion" title={t('App version')}
              about={t('When this version of the app was built (YYYYMMDDHHmm, local time), beside the backup icon on the homescreen.')} />
          </ul>
        </section>
        <section className="config-block">
          <h2>{t('Dashboard')}</h2>
          <Field label={t('Style')}>
            <Select value={form.dashboard} options={DASHBOARD_STYLES} onChange={(v) => setForm({ ...form, dashboard: v })} />
          </Field>
          <div className="field">
            <span>{t('7-day calorie correction: each bound moves at most (kcal)')}</span>
            <div className="row">
              <Field label={t('Min')}>
                <input inputMode="decimal" value={form.capMin} placeholder={String(DEFAULT_CONFIG.adjCap.min)}
                  onChange={(e) => setForm({ ...form, capMin: e.target.value })} />
              </Field>
              <Field label={t('Max')}>
                <input inputMode="decimal" value={form.capMax} placeholder={String(DEFAULT_CONFIG.adjCap.max)}
                  onChange={(e) => setForm({ ...form, capMax: e.target.value })} />
              </Field>
            </div>
          </div>
          <ul className="switch-list">
            <Switch form={form} setForm={setForm} k="pie" title={t('Energy chart')}
              about={t("Calories, protein, fat and carbs in one chart, as the dashboard's first tile.")} />
            <Switch form={form} setForm={setForm} k="pieSquare" title={t('Energy chart: square')}
              about={t("Calories up the side, the macros' shares across. Off: round, a pie.")} />
            <Switch form={form} setForm={setForm} k="onlyTargets" title={t('Only nutrients with a target')}
              about={t('Off: calories, protein, fat and carbs are always shown, with or without a target.')} />
            <Switch form={form} setForm={setForm} k="adjGhost" title={t('Ghost of the uncapped calorie bar')}
              about={t('Where the bar would be with no correction caps, drawn faintly over the capped one.')} />
          </ul>
        </section>
        <section className="config-block">
          <h2>{t('Food database')}</h2>
          <div className="field">
            <span>{t('Reference databases (their generic foods are listed with yours)')}</span>
            <ul className="switch-list">
              {REFERENCE_DBS.map(([key, name, about]) => <Switch key={key} form={form} setForm={setForm} k={key} title={name} about={t(about)} />)}
            </ul>
          </div>
          <ul className="switch-list">
            <Switch form={form} setForm={setForm} k="searchKcal" title={t('Calories in food searches')}
              about={t("Each food's kcal per 100 g (or 100 ml) beside its name.")} />
          </ul>
        </section>
        <div className="row actions"><button onClick={save}>{t('Save')}</button></div>
      </div>
    </Screen>
  )
}
