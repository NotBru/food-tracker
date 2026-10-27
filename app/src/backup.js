// Encrypted backup to the server (backup/server.mjs).
//
// One random secret per backup, kept on the device (localStorage, outside the database, so imports and restores
// don't touch it) and moved to other devices as a QR link or text. From it come, by HKDF, an AES-GCM key that
// encrypts the gzipped export, and an Ed25519 key whose public half is the backup's name on the server and signs
// every request. The server only ever sees the public key and ciphertext.
import { exportAll, importAll } from './db'

const PREFIX = 'food-tracker-backup/1'
const MAGIC = new TextEncoder().encode('FTB1')
const STORE = 'backup'
// Ed25519 private keys only import as PKCS#8: this header, then the 32-byte seed.
const PKCS8_ED25519 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20])

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = (data) => crypto.subtle.digest('SHA-256', typeof data === 'string' ? new TextEncoder().encode(data) : data)

// --- State on this device ---------------------------------------------------
// { secret, version (what the server had when this device last wrote or read it), hash (of the data last sent),
//   at (last backup or restore), conflict (another device wrote since), error }

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

export const newSecret = () => b64u(crypto.getRandomValues(new Uint8Array(32)))
const SECRET_RE = /^[A-Za-z0-9_-]{43}$/

/** The link a phone's camera opens straight into the restore screen. The hash never reaches the server. */
export const backupLink = (secret) => `${location.origin}${location.pathname}#/backup?secret=${secret}`

/** A pasted or scanned secret, bare or inside the link; null if it isn't one. */
export function parseSecret(text) {
  const s = text.trim().match(/(?:secret=)?([A-Za-z0-9_-]{43})$/)?.[1]
  return s && SECRET_RE.test(s) ? s : null
}

const keyCache = new Map()
function keysOf(secret) {
  if (!keyCache.has(secret)) keyCache.set(secret, deriveKeys(secret))
  return keyCache.get(secret)
}
async function deriveKeys(secret) {
  const base = await crypto.subtle.importKey('raw', unb64u(secret), 'HKDF', false, ['deriveBits'])
  const bits = (info) => crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info: new TextEncoder().encode(`${PREFIX} ${info}`) }, base, 256)
  const seed = new Uint8Array(await bits('ed25519'))
  const pkcs8 = new Uint8Array([...PKCS8_ED25519, ...seed])
  let signKey
  try {
    signKey = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, true, ['sign'])
  } catch {
    throw new Error("This browser can't make Ed25519 signatures, which the backup needs. Try updating it.")
  }
  const { x: id } = await crypto.subtle.exportKey('jwk', signKey)
  const aesKey = await crypto.subtle.importKey('raw', await bits('aes-gcm'), 'AES-GCM', false, ['encrypt', 'decrypt'])
  return { id, signKey, aesKey }
}

// --- Requests -----------------------------------------------------------------

async function request(method, path, { keys, newKeys, body = new Uint8Array(), prev = '' }) {
  const time = String(Date.now())
  const text = new TextEncoder().encode([PREFIX, method, path, time, prev, hex(await sha256(body))].join('\n'))
  const sign = async (k) => b64u(await crypto.subtle.sign('Ed25519', k.signKey, text))
  const headers = { 'X-Time': time, 'X-Prev': prev, 'X-Signature': await sign(keys) }
  // A key change is signed by the new key as well.
  if (newKeys) headers['X-New-Signature'] = await sign(newKeys)
  let res
  try {
    res = await fetch(path, { method, body: method === 'GET' ? undefined : body, cache: 'no-store', headers })
  } catch {
    throw new Error("Couldn't reach the backup server. Are you online?")
  }
  if (res.ok) return res
  const json = await res.json().catch(() => ({}))
  throw Object.assign(new Error(json.error ?? `The backup server answered ${res.status}.`), { status: res.status, json })
}

// --- Backup and restore -------------------------------------------------------

async function gzip(text, compress) {
  const stream = new Blob([text]).stream().pipeThrough(compress ? new CompressionStream('gzip') : new DecompressionStream('gzip'))
  return new Response(stream)[compress ? 'arrayBuffer' : 'text']()
}

async function encrypt(aesKey, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: MAGIC }, aesKey, await gzip(text, true))
  return new Uint8Array([...MAGIC, ...iv, ...new Uint8Array(ct)])
}

async function decrypt(aesKey, bytes) {
  if (MAGIC.some((b, i) => bytes[i] !== b)) throw new Error("That isn't a backup this app made.")
  let plain
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(4, 16), additionalData: MAGIC }, aesKey, bytes.slice(16))
  } catch {
    throw new Error("The backup couldn't be decrypted with this secret.")
  }
  return gzip(plain, false)
}

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
    // exportedAt changes on every export; only the tables (which come after it) say whether the data changed.
    const hash = hex(await sha256(text.slice(text.indexOf('"tables"'))))
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
  setState({ secret, version, hash: hex(await sha256(text.slice(text.indexOf('"tables"')))), at: new Date().toISOString() })
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
  const now = await exportAll()
  setState({ secret, version, hash: hex(await sha256(now.slice(now.indexOf('"tables"')))), at: new Date().toISOString() })
}

/** Backs up now and then: soon after the app opens, every 15 minutes, and when it's put in the background. */
export function startAutoBackup() {
  const run = () => {
    const s = getState()
    if (s && !s.conflict) backUp().catch(() => {})
  }
  setTimeout(run, 5000)
  setInterval(run, 15 * 60 * 1000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && run())
}
