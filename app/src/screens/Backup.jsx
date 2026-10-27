import { useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { backUp, backupLink, fetchBackup, forget, getState, onState, parseSecret, restore, start } from '../backup'
import { formatDateTime } from '../time'
import { Field, Screen, replace } from '../components'

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
    <svg viewBox={`0 0 ${path.size} ${path.size}`} width="240" height="240" role="img" aria-label="QR code of the backup link"
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
      if (e.status !== 409) alert(e.message)
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
    if (!confirm(`Restoring REPLACES all data on this device with the backup from ${formatDateTime(fetched.updated)}. Continue?`)) return
    await restore(secret, fetched)
    setPasted('')
    alert('Restored.')
  }

  const restorePasted = () => act(async () => {
    const secret = parseSecret(pasted)
    if (!secret) throw new Error("That isn't a backup secret or link.")
    if (state && secret !== state.secret &&
      !confirm("This device is backed up under another secret. It will switch to this one (the old backup stays on the server). Continue?")) return
    await doRestore(secret)
  })

  const restoreSection = (
    <div className="field">
      <span>{state ? 'Restore a backup from another secret' : 'Restore a backup from another device'}</span>
      <small className="muted">
        On the other device, open Backup and show its secret. Scan the QR with this phone's camera, or paste the
        secret or link here.
      </small>
      <div className="row">
        <input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Secret or link" style={{ flex: 1 }}
          autoComplete="off" spellCheck={false} />
        <button className="secondary" disabled={busy || !pasted.trim()} onClick={restorePasted}>Restore</button>
      </div>
    </div>
  )

  if (!state) {
    return (
      <Screen title="Backup">
        <div className="form">
          <p className="muted small">
            The data is encrypted on this device before it's sent, so the server can't read it. The secret that unlocks
            it stays on your devices only: lose them all without a copy of the secret and the backup is lost too.
          </p>
          <div className="field">
            <span>Back up this device (a friend code lets you start)</span>
            <div className="row">
              <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Friend code" style={{ flex: 1 }}
                autoComplete="off" spellCheck={false} />
              <button disabled={busy || !invite.trim()} onClick={doStart}>Start</button>
            </div>
          </div>
          {restoreSection}
        </div>
      </Screen>
    )
  }

  const link = backupLink(state.secret)
  return (
    <Screen title="Backup">
      <div className="form">
        <p className="small">
          {state.at ? `Last backed up or restored ${formatDateTime(state.at)}.` : 'Not backed up yet.'}{' '}
          <span className="muted">It backs up by itself while the app is open, when something changed.</span>
        </p>
        {state.error && <p className="small warn">Last try failed: {state.error}</p>}
        {state.conflict && (
          <p className="small warn">
            Another device backed up under this secret since this one last did. Back up now to overwrite its backup with
            this device's data, or restore to take its data here.
          </p>
        )}
        <div className="row">
          <button disabled={busy} onClick={() => act(() => backUp({ force: true, overwrite: state.conflict }))}>Back up now</button>
          <button className="secondary" disabled={busy} onClick={() => act(() => doRestore(state.secret))}>Restore</button>
        </div>

        <div className="field">
          <span>Secret</span>
          <small className="muted">
            Anyone with it can read and replace this backup. Keep a copy somewhere safe, and use it to restore on another
            device.
          </small>
          {shown ? (
            <>
              <Qr text={link} />
              <code style={{ wordBreak: 'break-all', color: 'var(--text)' }}>{state.secret}</code>
              <div className="row">
                <button className="secondary" onClick={() => navigator.clipboard.writeText(state.secret).then(() => alert('Copied.'), () => alert("Couldn't copy; select the text instead."))}>Copy</button>
                <button className="secondary" onClick={() => setShown(false)}>Hide</button>
              </div>
            </>
          ) : (
            <div className="row"><button className="secondary" onClick={() => setShown(true)}>Show secret</button></div>
          )}
        </div>

        {restoreSection}

        <div className="field">
          <span>Stop backing up this device</span>
          <small className="muted">Forgets the secret here; the backup stays on the server.</small>
          <div className="row">
            <button className="secondary" disabled={busy} onClick={() => {
              if (confirm("Forget the secret on this device? Without a copy of it, the backup can't be restored.")) forget()
            }}>Forget the secret</button>
          </div>
        </div>
      </div>
    </Screen>
  )
}
