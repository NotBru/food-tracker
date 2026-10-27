// Encrypted backup to the server (backup/server.mjs); keys, encryption and requests in backup-crypto.js.
//
// One random secret per backup, kept on the device (localStorage, outside the database, so imports and restores
// don't touch it) and moved to other devices as a QR link or text. The server only ever sees the public key and
// ciphertext.
//
// Beside the backup, each key has an inbox: batches of entries pushed from elsewhere (Claude's log-food skill), merged
// into this device's data (db.js mergeTables) and then cleared. Merging the same batch twice changes nothing.
import { exportAll, importAll } from './db'
import { decrypt, encrypt, hex, keysOf, newSecret, request as signedRequest, SECRET_RE, sha256 } from './backup-crypto'

const STORE = 'backup'
const request = (method, path, opts) => signedRequest('', method, path, opts)
// exportedAt changes on every export; only the tables (which come after it) say whether the data changed.
const dataHash = async (text) => hex(await sha256(text.slice(text.indexOf('"tables"'))))

// --- State on this device ---------------------------------------------------
// { secret, version (what the server had when this device last wrote or read it), hash (of the data last sent),
//   at (last backup or restore), conflict (another device wrote since), error, inbox: {at, entries} (last merged) }

const listeners = new Set()
export function getState() {
  try {
    return JSON.parse(localStorage.getItem(STORE)) ?? null
  } catch {
    return null
  }
}
function setState(s) {
  if (s) localStorage.setItem(STORE, JSON.stringify(s))
  else localStorage.removeItem(STORE)
  for (const f of listeners) f(s)
}
const patchState = (p) => setState({ ...getState(), ...p })
export function onState(f) {
  listeners.add(f)
  return () => listeners.delete(f)
}
export const forget = () => setState(null)

// --- Secret -------------------------------------------------------------------

/** The link a phone's camera opens straight into the restore screen. The hash never reaches the server. */
export const backupLink = (secret) => `${location.origin}${location.pathname}#/backup?secret=${secret}`

/** A pasted or scanned secret, bare or inside the link; null if it isn't one. */
export function parseSecret(text) {
  const s = text.trim().match(/(?:secret=)?([A-Za-z0-9_-]{43})$/)?.[1]
  return s && SECRET_RE.test(s) ? s : null
}

// --- Backup and restore -------------------------------------------------------

/** Starts backing up this device under a new secret; the invite code lets the server take the new key. */
export async function start(invite) {
  const secret = newSecret()
  const keys = await keysOf(secret)
  const body = new TextEncoder().encode(JSON.stringify({ invite: invite.trim(), key: keys.id }))
  await request('POST', '/backup/keys', { keys, body })
  setState({ secret, version: '' })
  await backUp()
}

let running = null
/** Uploads this device's data if it changed since the last upload (or always, with force). One at a time. */
export function backUp({ force = false, overwrite = false } = {}) {
  running ??= (async () => {
    const s = getState()
    if (!s) return
    const keys = await keysOf(s.secret)
    const text = await exportAll()
    const hash = await dataHash(text)
    if (!force && !overwrite && hash === s.hash && !s.error) return
    try {
      let prev = s.version
      if (overwrite) prev = await currentVersion(keys)
      const res = await request('PUT', `/backup/${keys.id}`, { keys, body: await encrypt(keys.aesKey, text), prev })
      const { version } = await res.json()
      patchState({ version, hash, at: new Date().toISOString(), conflict: false, error: null })
    } catch (e) {
      patchState(e.status === 409 ? { conflict: true, error: null } : { error: e.message })
      throw e
    }
  })().finally(() => (running = null))
  return running
}

/**
 * Moves the backup to a new secret: this device's data, encrypted under it. The old secret stops working everywhere
 * (devices still on it are told so). Refused while another device's backup is pending (conflict).
 */
export async function changeSecret() {
  // The inbox is encrypted under the old secret and dropped with it: take it in first.
  await pullInbox()
  const s = getState()
  const keys = await keysOf(s.secret)
  const secret = newSecret()
  const newKeys = await keysOf(secret)
  const text = await exportAll()
  const res = await request('POST', `/backup/${keys.id}/${newKeys.id}`, {
    keys, newKeys, body: await encrypt(newKeys.aesKey, text), prev: s.version,
  }).catch((e) => {
    if (e.status === 409) patchState({ conflict: true })
    throw e.status === 409 ? new Error('Another device backed up since this one did: back up now or restore first.') : e
  })
  const { version } = await res.json()
  setState({ secret, version, hash: await dataHash(text), at: new Date().toISOString() })
}

async function currentVersion(keys) {
  try {
    return (await request('GET', `/backup/${keys.id}`, { keys })).headers.get('X-Version') ?? ''
  } catch (e) {
    if (e.status === 404 && e.json?.error?.startsWith('Nothing')) return ''
    throw e
  }
}

/** Fetches the backup under a secret: { text, updated }. */
export async function fetchBackup(secret) {
  const keys = await keysOf(secret)
  const res = await request('GET', `/backup/${keys.id}`, { keys })
  const text = await decrypt(keys.aesKey, new Uint8Array(await res.arrayBuffer()))
  return { text, version: res.headers.get('X-Version'), updated: res.headers.get('X-Updated') }
}

/** Replaces this device's data with the backup, and backs this device up under that secret from now on. */
export async function restore(secret, fetched) {
  const { text, version } = fetched ?? (await fetchBackup(secret))
  await importAll(text)
  setState({ secret, version, hash: await dataHash(await exportAll()), at: new Date().toISOString() })
}

// --- Inbox --------------------------------------------------------------------

/**
 * Merges the inbox's batches into this device's data, then clears it, if nothing was added meanwhile (else the next
 * run merges again, which skips what's already here). Returns how many consumptions came in.
 */
export async function pullInbox() {
  const s = getState()
  if (!s) return 0
  const keys = await keysOf(s.secret)
  let res
  try {
    res = await request('GET', `/backup/${keys.id}/inbox`, { keys })
  } catch (e) {
    if (e.status === 404) return 0
    throw e
  }
  const version = res.headers.get('X-Version')
  const inbox = JSON.parse(await decrypt(keys.aesKey, new Uint8Array(await res.arrayBuffer())))
  if (inbox.app !== 'food-tracker-inbox') throw new Error("The inbox holds something this app didn't make.")
  let entries = 0
  for (const batch of inbox.batches) {
    await importAll(JSON.stringify(batch.data), { merge: true })
    entries += batch.data.tables.logs?.length ?? 0
  }
  await request('DELETE', `/backup/${keys.id}/inbox`, { keys, prev: version }).catch((e) => {
    if (e.status !== 409) throw e
  })
  patchState({ inbox: { at: new Date().toISOString(), entries } })
  return entries
}

/** Takes in the inbox and backs up now and then: soon after the app opens, every 15 minutes, and when it's hidden. */
export function startAutoBackup() {
  const run = async () => {
    const s = getState()
    if (!s) return
    await pullInbox().catch((e) => patchState({ error: e.message }))
    if (!s.conflict) await backUp().catch(() => {})
  }
  setTimeout(run, 5000)
  setInterval(run, 15 * 60 * 1000)
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? run() : setTimeout(run, 1000)))
}
