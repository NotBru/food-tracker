// The backup's keys, encryption and signed requests (backup/server.mjs), with no imports and only web APIs, so the
// app (backup.js) and Node (.claude/skills/log-food/scripts/food.mjs) share it.
//
// From one random secret come, by HKDF, an AES-GCM key that encrypts the gzipped data, and an Ed25519 key whose public
// half is the backup's name on the server and signs every request.

const PREFIX = 'food-tracker-backup/1'
const MAGIC = new TextEncoder().encode('FTB1')
// Ed25519 private keys only import as PKCS#8: this header, then the 32-byte seed.
const PKCS8_ED25519 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20])

export const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
export const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
export const sha256 = (data) => crypto.subtle.digest('SHA-256', typeof data === 'string' ? new TextEncoder().encode(data) : data)

export const newSecret = () => b64u(crypto.getRandomValues(new Uint8Array(32)))
export const SECRET_RE = /^[A-Za-z0-9_-]{43}$/

const keyCache = new Map()
/** { id, signKey, aesKey } for a secret. */
export function keysOf(secret) {
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

/**
 * A signed request to the backup server; `base` is '' in the app (same origin). Throws an Error with `status` and the
 * server's `json` unless the answer is 2xx. `newKeys` also signs (a key change).
 */
export async function request(base, method, path, { keys, newKeys, body = new Uint8Array(), prev = '' }) {
  const time = String(Date.now())
  const text = new TextEncoder().encode([PREFIX, method, path, time, prev, hex(await sha256(body))].join('\n'))
  const sign = async (k) => b64u(await crypto.subtle.sign('Ed25519', k.signKey, text))
  const headers = { 'X-Time': time, 'X-Prev': prev, 'X-Signature': await sign(keys) }
  if (newKeys) headers['X-New-Signature'] = await sign(newKeys)
  let res
  try {
    res = await fetch(base + path, { method, body: method === 'GET' || method === 'DELETE' ? undefined : body, cache: 'no-store', headers })
  } catch {
    throw new Error("Couldn't reach the backup server. Are you online?")
  }
  if (res.ok) return res // 204 included: a GET of an unchanged backup (server.mjs)
  const json = await res.json().catch(() => ({}))
  throw Object.assign(new Error(json.error ?? `The backup server answered ${res.status}.`), { status: res.status, json })
}

async function gzip(data, compress) {
  const stream = new Blob([data]).stream().pipeThrough(compress ? new CompressionStream('gzip') : new DecompressionStream('gzip'))
  return new Response(stream)[compress ? 'arrayBuffer' : 'text']()
}

/** `FTB1` + IV + AES-GCM(gzip(text)). */
export async function encrypt(aesKey, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: MAGIC }, aesKey, await gzip(text, true))
  return new Uint8Array([...MAGIC, ...iv, ...new Uint8Array(ct)])
}

export async function decrypt(aesKey, bytes) {
  if (MAGIC.some((b, i) => bytes[i] !== b)) throw new Error("That isn't a backup this app made.")
  let plain
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(4, 16), additionalData: MAGIC }, aesKey, bytes.slice(16))
  } catch {
    throw new Error("The backup couldn't be decrypted with this secret.")
  }
  return gzip(plain, false)
}
