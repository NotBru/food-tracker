import { useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  backupLink, changeSecret, conflictLabelShown, fetchBackup, forget, getConflicts, getState, onState, parseSecret,
  resolveConflict, restore, showConflictLabel, start, status, sync,
} from '../backup'
import { differingFields } from '../sync'
import { loadContext } from '../calc'
import { itemLabel } from '../db'
import { formatDateTime } from '../time'
import { Field, Screen, go, replace } from '../components'
import { plural, t } from '../i18n'

/** Black on white whatever the theme, with a quiet zone: what camera apps read best. */
function Qr({ text }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`
    return { d, size: n + 8 }
  }, [text])
  return (
    <svg viewBox={`0 0 ${path.size} ${path.size}`} width="240" height="240" role="img" aria-label={t('QR code of the backup link')}
      style={{ background: '#fff', borderRadius: 12, alignSelf: 'center' }} shapeRendering="crispEdges">
      <path d={path.d} fill="#000" />
    </svg>
  )
}

function useBackupState() {
  const [s, set] = useState(getState)
  useEffect(() => onState(set), [])
  return s
}

/** What the sync icon's colour means, in words (its hover text, and the Backup screen's status line). */
export function statusText(s) {
  const last = s?.at ? ` ${t('Last synced {when}.', { when: formatDateTime(s.at) })}` : ''
  switch (status(s)) {
    case 'off': return t('Backup is off.')
    case 'conflict': return plural(s.conflicts, 'Merge conflict: {n} entry changed differently on two devices.', 'Merge conflict: {n} entries changed differently on two devices.')
    case 'syncing': return `${t('Syncing…')}${last}`
    case 'error': return `${t('Sync failed: {error}', { error: t(s.error) })}${last}`
    case 'unreachable': return `${t("Can't reach the backup server; trying again every 5 s.")}${last}`
    case 'waiting': return s.at ? `${t('Changes here are waiting to sync.')}${last}` : t('Not synced yet.')
    default: return `${t('Synced.')}${last}`
  }
}

// A cloud, and inside it what the colour says: ✓ synced, … syncing, waiting or out of reach, ! failed, ⇄ conflict;
// struck through when off.
const GLYPHS = {
  synced: 'M9 14.5l2 2 4-4',
  waiting: 'M8.5 15h.01M12 15h.01M15.5 15h.01',
  syncing: 'M8.5 15h.01M12 15h.01M15.5 15h.01',
  unreachable: 'M8.5 15h.01M12 15h.01M15.5 15h.01',
  error: 'M12 11v3M12 17h.01',
  conflict: 'M9 12.5h6l-1.8-1.8M15 16H9l1.8 1.8',
  off: 'M4 4l16 16',
}

/** The homescreen's sync icon: tap -> the Backup screen; hover says what it means. */
export function SyncStatus() {
  const s = useBackupState()
  const [label, setLabel] = useState(conflictLabelShown)
  useEffect(() => onState(() => setLabel(conflictLabelShown())), [])
  const st = status(s)
  const text = `${statusText(s)} ${{ off: t('Tap to set it up.'), conflict: t('Tap to pick which to keep.') }[st] ?? t('Tap to open Backup.')}`
  return (
    <button className={`user-btn sync-btn sync-${st}`} onClick={() => go('/backup')} title={text} aria-label={text}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M6.5 19a4.5 4.5 0 0 1-.6-8.96 6.5 6.5 0 0 1 12.4-1A5 5 0 0 1 17.5 19Z" />
        <path d={GLYPHS[st]} />
      </svg>
      {st === 'conflict' && label && <span>{t('Merge conflict')}</span>}
    </button>
  )
}

const TABLES_EN = { users: 'User', items: 'Food', logs: 'Consumption', targets: 'Target', weights: 'Body measurements', config: 'Settings' }
/** A table's name, in the app's language. */
export const TABLE_NAMES = new Proxy(TABLES_EN, { get: (o, k) => (k in o ? t(o[k]) : undefined) })

export function rowLabel(table, row, ctx) {
  if (table === 'users') return row.name
  if (table === 'items') return itemLabel(row)
  if (table === 'logs') return `${itemLabel(ctx?.items.get(row.itemId))}, ${row.amountText ?? row.amount} ${row.unit} · ${formatDateTime(row.datetime)}`
  if (table === 'targets') return t('from {when}', { when: formatDateTime(row.validFrom) })
  if (table === 'weights') return formatDateTime(row.datetime)
  return ''
}

/** A field's value in a conflict, cut at 80 characters. */
export const shownValue = (v) => {
  const text = typeof v === 'string' ? v : JSON.stringify(v)
  return text.length > 80 ? `${text.slice(0, 79)}…` : text
}

/** The rows changed differently here and on another device, each with both versions and a button for each. */
function Conflicts({ count }) {
  const list = useLiveQuery(getConflicts, [count])
  const ctx = useLiveQuery(loadContext)
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState(conflictLabelShown)
  if (!list?.length) return null
  async function pick(i, side) {
    setBusy(true)
    try {
      await resolveConflict(i, side)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="field">
      <span className="conflict-title">{t('Merge conflicts')}</span>
      <small className="muted">
        {t('Changed differently on this device and another one since they last synced. Pick which to keep; syncing waits until all are picked.')}
      </small>
      <ul className="conflicts">
        {list.map((c, i) => (
          <li key={`${c.t}:${c.key}`}>
            <strong>{TABLE_NAMES[c.t]}</strong> {rowLabel(c.t, c.local ?? c.cloud, ctx)}
            {c.local && c.cloud ? (
              <ul className="small">
                {differingFields(c.local, c.cloud).map((f) => (
                  <li key={f}><span className="muted">{f}:</span> {t('here')} {shownValue(c.local[f])} · {t('other device')} {shownValue(c.cloud[f])}</li>
                ))}
              </ul>
            ) : (
              <p className="small muted">{c.local ? t('Deleted on the other device, changed here.') : t('Deleted here, changed on the other device.')}</p>
            )}
            <div className="row">
              <button className="secondary" disabled={busy} onClick={() => pick(i, 'local')}>{t("Keep this device's")}</button>
              <button className="secondary" disabled={busy} onClick={() => pick(i, 'cloud')}>{t("Keep the other device's")}</button>
            </div>
          </li>
        ))}
      </ul>
      <ul className="switch-list">
        <li>
          <label>
            <span>
              <strong>{t('“Merge conflict” beside the sync icon')}</strong>
              <small className="muted">{t('Off, a merge conflict shows only as the sync icon turning violet (on the homescreen); tap it to come here.')}</small>
            </span>
            <input type="checkbox" role="switch" className="switch" checked={label}
              onChange={(e) => { showConflictLabel(e.target.checked); setLabel(e.target.checked) }} />
          </label>
        </li>
      </ul>
    </div>
  )
}

export default function Backup({ secret: linked }) {
  const state = useBackupState()
  const [busy, setBusy] = useState(false)
  const [invite, setInvite] = useState('')
  const [pasted, setPasted] = useState(linked ?? '')
  const [shown, setShown] = useState(false)

  // A scanned link carries the secret in the address: keep it in the form only, not in the history.
  useEffect(() => {
    if (linked) replace('/backup')
  }, [linked])

  async function act(f) {
    setBusy(true)
    try {
      await f()
    } catch (e) {
      if (e.status !== 409) alert(t(e.message)) // backup.js's and backup-crypto.js's messages are in es.js
    } finally {
      setBusy(false)
    }
  }

  const doStart = () => act(async () => {
    await start(invite)
    setShown(true)
  })

  async function doRestore(secret) {
    const fetched = await fetchBackup(secret)
    if (!confirm(t("Restoring REPLACES all data on this device with the backup from {when}; changes here that haven't synced are lost. Continue?", { when: formatDateTime(fetched.updated) }))) return
    await restore(secret, fetched)
    setPasted('')
    alert(t('Restored.'))
  }

  const restorePasted = () => act(async () => {
    const secret = parseSecret(pasted)
    if (!secret) throw new Error(t("That isn't a backup secret or link."))
    if (state && secret !== state.secret &&
      !confirm(t('This device is backed up under another secret. It will switch to this one (the old backup stays on the server). Continue?'))) return
    await doRestore(secret)
  })

  const restoreSection = (
    <div className="field">
      <span>{state ? t('Restore a backup from another secret') : t('Restore a backup from another device')}</span>
      <small className="muted">
        {t("On the other device, open Backup and show its secret. Scan the QR with this phone's camera, or paste the secret or link here.")}
      </small>
      <div className="row">
        <input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={t('Secret or link')} style={{ flex: 1 }}
          autoComplete="off" spellCheck={false} />
        <button className="secondary" disabled={busy || !pasted.trim()} onClick={restorePasted}>{t('Restore')}</button>
      </div>
    </div>
  )

  if (!state) {
    return (
      <Screen title={t('Backup')}>
        <div className="form">
          <p className="muted small">
            {t("The data is encrypted on this device before it's sent, so the server can't read it. The secret that unlocks it stays on your devices only: lose them all without a copy of the secret and the backup is lost too.")}
          </p>
          <div className="field">
            <span>{t('Back up this device (an invite code lets you start)')}</span>
            <div className="row">
              <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder={t('Invite code')} style={{ flex: 1 }}
                autoComplete="off" spellCheck={false} />
              <button disabled={busy || !invite.trim()} onClick={doStart}>{t('Start')}</button>
            </div>
          </div>
          {restoreSection}
        </div>
      </Screen>
    )
  }

  const link = backupLink(state.secret)
  return (
    <Screen title={t('Backup')}>
      <div className="form">
        <p className="small">
          <span className={status(state) === 'synced' ? '' : 'warn'}>{statusText(state)}</span>{' '}
          <span className="muted">
            {t('It syncs by itself with the other devices on this secret while the app is open: a few seconds after a change, every 15 minutes, and when you come back to the app.')}
          </span>
        </p>
        {state.inbox && (
          <p className="small muted">{plural(state.inbox.entries, 'Took in {n} consumption from the inbox {when}.', 'Took in {n} consumptions from the inbox {when}.', { when: formatDateTime(state.inbox.at) })}</p>
        )}
        <Conflicts count={state.conflicts} />
        <div className="row">
          <button disabled={busy || !!state.conflicts} onClick={() => act(sync)}>{t('Sync now')}</button>
          <button className="secondary" disabled={busy} onClick={() => act(() => doRestore(state.secret))}>{t('Restore')}</button>
        </div>

        <div className="field">
          <span>{t('Secret')}</span>
          <small className="muted">
            {t('Anyone with it can read and replace this backup. Keep a copy somewhere safe, and use it to restore on another device.')}
          </small>
          {shown ? (
            <>
              <Qr text={link} />
              <code style={{ wordBreak: 'break-all', color: 'var(--text)' }}>{state.secret}</code>
              <div className="row">
                <button className="secondary" onClick={() => navigator.clipboard.writeText(state.secret).then(() => alert(t('Copied.')), () => alert(t("Couldn't copy; select the text instead.")))}>{t('Copy')}</button>
                <button className="secondary" onClick={() => setShown(false)}>{t('Hide')}</button>
              </div>
            </>
          ) : (
            <div className="row"><button className="secondary" onClick={() => setShown(true)}>{t('Show secret')}</button></div>
          )}
        </div>

        <div className="field">
          <span>{t('Change the secret (if it got out)')}</span>
          <small className="muted">
            {t("Moves the backup to a new secret, with this device's data. The old one stops working on every device; show the new one to your other devices.")}
          </small>
          <div className="row">
            <button className="secondary" disabled={busy} onClick={() => {
              if (confirm(t('Change the secret? The old one stops working on every device that has it.'))) act(async () => {
                await changeSecret()
                setShown(true)
              })
            }}>{t('Change the secret')}</button>
          </div>
        </div>

        {restoreSection}

        <div className="field">
          <span>{t('Stop backing up this device')}</span>
          <small className="muted">{t('Forgets the secret here; the backup stays on the server.')}</small>
          <div className="row">
            <button className="secondary" disabled={busy} onClick={() => {
              if (confirm(t("Forget the secret on this device? Without a copy of it, the backup can't be restored."))) act(forget)
            }}>{t('Forget the secret')}</button>
          </div>
        </div>
      </div>
    </Screen>
  )
}
