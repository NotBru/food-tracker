// Encrypted backup to the server (backup/server.mjs), synced between the devices that share its secret; keys,
// encryption and requests in backup-crypto.js.
//
// One random secret per backup, kept on the device (localStorage, outside the database, so imports and restores
// don't touch it) and moved to other devices as a QR link or text. The server only ever sees the public key and
// ciphertext.
//
// Sync: the database keeps the backup as this device last synced it (the base, table `sync`), with the server's
// version of it. This device's changes are its data minus the base. If the server's version is still the base's,
// they're uploaded; if not, the backup's changes since the base are merged in first (sync.js). Uploads are
// compare-and-swap on the version: another device's upload in between means merging again.
//
// Beside the backup, each key has an inbox: batches of entries pushed from elsewhere (Claude's log-food skill), merged
// into this device's data (db.js mergeTables) and then cleared. Merging the same batch twice changes nothing.
import { db, exportAll, FORMAT, importAll, onDataChange, quietly, readImport, revive, TABLES } from './db'
import { decrypt, encrypt, keysOf, newSecret, request as signedRequest, SECRET_RE } from './backup-crypto'
import { changes, merge } from './sync'

const STORE = 'backup'
const request = (method, path, opts) => signedRequest('', method, path, opts)

// --- State on this device ---------------------------------------------------
// { secret, at (last sync that reached the backup), syncing, pending (changes here not in the backup yet),
//   conflicts (how many rows wait for the user), error, inbox: {at, entries} (last merged) }

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
const patchState = (p) => getState() && setState({ ...getState(), ...p })
export function onState(f) {
  listeners.add(f)
  return () => listeners.delete(f)
}
export async function forget() {
  await db.sync.clear()
  setState(null)
}

/** off | conflict | error | waiting | synced: what the homescreen's sync icon shows. */
export function status(s) {
  if (!s) return 'off'
  if (s.conflicts) return 'conflict'
  if (s.syncing) return 'syncing'
  if (s.error) return 'error'
  if (s.pending || !s.at) return 'waiting'
  return 'synced'
}

// The "Merge conflict" label beside the icon; once hidden, only the colour tells.
const LABEL = 'backup-conflict-label'
export const conflictLabelShown = () => localStorage.getItem(LABEL) !== 'hidden'
export function showConflictLabel(on) {
  if (on) localStorage.removeItem(LABEL)
  else localStorage.setItem(LABEL, 'hidden')
  for (const f of listeners) f(getState())
}

// --- Secret -------------------------------------------------------------------

/** The link a phone's camera opens straight into the restore screen. The hash never reaches the server. */
export const backupLink = (secret) => `${location.origin}${location.pathname}#/backup?secret=${secret}`

/** A pasted or scanned secret, bare or inside the link; null if it isn't one. */
export function parseSecret(text) {
  const s = text.trim().match(/(?:secret=)?([A-Za-z0-9_-]{43})$/)?.[1]
  return s && SECRET_RE.test(s) ? s : null
}

// --- The backup and its base --------------------------------------------------

/** The backup on the server: { text, version, updated }, or null if nothing was backed up under the key yet. */
async function download(keys) {
  try {
    const res = await request('GET', `/backup/${keys.id}`, { keys })
    const text = await decrypt(keys.aesKey, new Uint8Array(await res.arrayBuffer()))
    return { text, version: res.headers.get('X-Version'), updated: res.headers.get('X-Updated') }
  } catch (e) {
    if (e.status === 404 && e.json?.error?.startsWith('Nothing')) return null
    throw e
  }
}

const formatOf = (text) => JSON.parse(text).version ?? 1
// An export's tables in export form (JSON: NaN as null), brought up to this app's format.
const exported = (tables) => JSON.parse(JSON.stringify(tables, (_, v) => (typeof v === 'number' && Number.isNaN(v) ? null : v)))
const tablesOf = (text) => (formatOf(text) === FORMAT ? JSON.parse(text).tables : exported(readImport(text)))
const localTables = async () => JSON.parse(await exportAll()).tables

const getBase = () => db.sync.get('base')
const setBase = (version, text) => db.sync.put({ key: 'base', version, text })

/** How many rows here differ from the base (all of them before the first sync). */
async function pendingChanges() {
  const base = await getBase()
  return base ? changes(tablesOf(base.text), await localTables()) : Infinity
}

// --- Sync -----------------------------------------------------------------------

/** Starts backing up this device under a new secret; the invite code lets the server take the new key. */
export async function start(invite) {
  const secret = newSecret()
  const keys = await keysOf(secret)
  const body = new TextEncoder().encode(JSON.stringify({ invite: invite.trim(), key: keys.id }))
  await request('POST', '/backup/keys', { keys, body })
  await db.sync.clear()
  setState({ secret })
  await sync()
}

/**
 * The backup's changes since the base, into this device's data, in one transaction (so nothing edited meanwhile is
 * lost); the backup becomes the base. Rows changed on both sides stay this device's and are returned as conflicts.
 */
function mergeIn(base, cloud) {
  const [b, c] = [tablesOf(base.text), tablesOf(cloud.text)]
  return quietly(() => db.transaction('rw', [...TABLES, 'sync'].map((t) => db[t]), async () => {
    const { writes, conflicts } = merge(b, await localTables(), c)
    for (const w of writes) await (w.row ? db[w.t].put(revive(w.row)) : db[w.t].delete(w.key))
    await setBase(cloud.version, cloud.text)
    if (conflicts.length) await db.sync.put({ key: 'conflicts', list: conflicts })
    return conflicts.length
  }))
}

/** One round: merge in what changed there, upload what changed here. False if another device uploaded meanwhile. */
async function syncRound(keys) {
  const cloud = await download(keys)
  let base = await getBase()
  if (cloud && formatOf(cloud.text) > FORMAT) throw new Error('The backup was made by a newer version of the app: reload the app to update it.')
  if (cloud && base && cloud.version !== base.version) {
    if (formatOf(cloud.text) < FORMAT) {
      throw new Error('Another device backed up with an older version of the app: reload the app there to update it.')
    }
    if (await mergeIn(base, cloud)) return true // the user picks; then it syncs again
    base = cloud
  } else if (cloud && !base) {
    // First sync on this device: what's here and what's there, put together like an import's Merge.
    await quietly(() => importAll(cloud.text, { merge: true }))
    base = { version: cloud.version }
  } else if (!cloud) base = { version: '' } // nothing there (new, or lost on the server): this device's data goes up
  const text = await exportAll()
  if (base.text && !changes(tablesOf(base.text), JSON.parse(text).tables)) return true
  try {
    const res = await request('PUT', `/backup/${keys.id}`, { keys, body: await encrypt(keys.aesKey, text), prev: base.version })
    // What changed here since `text` was taken stays a change, against the new base.
    await setBase((await res.json()).version, text)
    return true
  } catch (e) {
    if (e.status === 409) return false
    throw e
  }
}

let running = null
let again = false
let marked = false // `pending` set since the last sync
/** Takes in the inbox, then syncs; not while conflicts wait for the user. One at a time; asked meanwhile, once more. */
export function sync() {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    const s = getState()
    if (!s || s.conflicts) return
    patchState({ syncing: true })
    try {
      await quietly(pullInbox)
      const keys = await keysOf(s.secret)
      for (let round = 1; !(await syncRound(keys)); round++) {
        if (round === 5) throw new Error('Other devices keep changing the backup. Try again in a moment.')
      }
      patchState({ at: new Date().toISOString(), error: null })
    } catch (e) {
      // (Not if the secret changed meanwhile: the old one's errors are over.)
      if (getState()?.secret === s.secret) patchState({ error: e.message })
      throw e
    } finally {
      marked = false
      const conflicts = (await db.sync.get('conflicts'))?.list.length ?? 0
      const pending = (await pendingChanges()) > 0
      patchState({ syncing: false, pending, conflicts })
      // Changed while it ran: once more.
      if (pending && !conflicts && !getState()?.error) again = true
    }
  })().finally(() => {
    running = null
    if (again) {
      again = false
      syncSoon(0)
    }
  })
  return running
}

let timer = null
/** Syncs once nothing has changed for `ms`. */
export function syncSoon(ms = 3000) {
  clearTimeout(timer)
  timer = setTimeout(() => sync().catch(() => {}), ms)
}

/**
 * Moves the backup to a new secret: this device's data, encrypted under it, once synced. The old secret stops working
 * everywhere (devices still on it are told so).
 */
export async function changeSecret() {
  // The inbox is encrypted under the old secret and dropped with it: take it in first, with the backup's changes.
  await sync()
  const s = getState()
  if (s.conflicts) throw new Error('Pick a side for each merge conflict first.')
  const base = await getBase()
  const keys = await keysOf(s.secret)
  const secret = newSecret()
  const newKeys = await keysOf(secret)
  const text = await exportAll()
  const res = await request('POST', `/backup/${keys.id}/${newKeys.id}`, {
    keys, newKeys, body: await encrypt(newKeys.aesKey, text), prev: base.version,
  }).catch((e) => {
    throw e.status === 409 ? new Error('Another device backed up just now: try again.') : e
  })
  await setBase((await res.json()).version, text)
  setState({ ...s, secret, at: new Date().toISOString(), error: null })
}

/** Fetches the backup under a secret: { text, version, updated }. */
export async function fetchBackup(secret) {
  const backup = await download(await keysOf(secret))
  if (!backup) throw new Error('Nothing has been backed up with this secret yet.')
  return backup
}

/**
 * Replaces this device's data with the backup (changes here that weren't synced are lost), and syncs this device
 * under that secret from now on.
 */
export async function restore(secret, fetched) {
  const { text, version } = fetched ?? (await fetchBackup(secret))
  await quietly(() => importAll(text))
  await db.sync.clear()
  await setBase(version, text)
  setState({ ...(getState()?.secret === secret ? getState() : {}), secret, at: new Date().toISOString(), conflicts: 0, error: null })
  patchState({ pending: (await pendingChanges()) > 0 })
}

// --- Merge conflicts ------------------------------------------------------------

/** The rows changed differently on both sides: [{t, key, local, cloud}] (null: deleted on that side). */
export async function getConflicts() {
  return (await db.sync.get('conflicts'))?.list ?? []
}

/** Keeps this device's version of conflict `i` (side 'local'), or takes the backup's ('cloud'). */
export async function resolveConflict(i, side) {
  const left = await quietly(() => db.transaction('rw', [...TABLES, 'sync'].map((t) => db[t]), async () => {
    const list = await getConflicts()
    const [c] = list.splice(i, 1)
    if (side === 'cloud') await (c.cloud ? db[c.t].put(revive(c.cloud)) : db[c.t].delete(c.key))
    await (list.length ? db.sync.put({ key: 'conflicts', list }) : db.sync.delete('conflicts'))
    return list.length
  }))
  patchState({ conflicts: left })
  if (!left) syncSoon(0)
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

/** Syncs now and then: as the app opens, a few seconds after a change, every 15 minutes, and when it's hidden. */
export function startAutoSync() {
  // A sync cut short (the app closed mid-way) isn't syncing any more.
  patchState({ syncing: false })
  onDataChange(() => {
    if (!marked) patchState({ pending: (marked = true) })
    syncSoon()
  })
  syncSoon(0)
  setInterval(() => syncSoon(0), 15 * 60 * 1000)
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? sync().catch(() => {}) : syncSoon(1000)))
}
