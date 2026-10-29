// Backup server: stores one encrypted blob per public key, for invited people only.
//
// The app encrypts its export with a secret that never leaves the user's devices, and signs every request with an
// Ed25519 key derived from the same secret (app/src/backup.js). The public key is the account: registering one takes an
// invite code, made here by hand. Each key gets one blob, replaced on every upload (compare-and-swap on its version,
// a hash of the blob). A GET naming the version it has gets 204 when that's still it.
//
//   node server.mjs                 serve on $PORT (8080), data in $DATA_DIR (/data)
//   node server.mjs invite <name>   make a single-use invite code for <name>
//   node server.mjs list            unused codes, and keys with their name, size and last upload
//   node server.mjs remove <key>    delete a key and its blob (a prefix of the key is enough)
//
// A key can be swapped for a new one (a new secret, if the old one leaked): POST /backup/<old>/<new> with the backup
// encrypted under the new secret, signed by both keys. The old key is left as a tombstone, so devices still on it are
// told why it stopped working.
//
// Each key also has an inbox, at most one blob too: batches of entries pushed from elsewhere (Claude's log-food skill),
// which the app merges in and then clears. GET, PUT and DELETE /backup/<key>/inbox, compare-and-swap on its version.
// A key change drops it (it's encrypted under the old secret; the app takes it in first).
//
// Data: invites/<code> (unused, holds the name), used/<code>, keys/<key>.json, blobs/<key>, blobs/<key>.inbox. One file
// per thing, written by rename, so the CLI and the server never race on a shared file.
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const DATA = process.env.DATA_DIR ?? '/data'
const PORT = Number(process.env.PORT ?? 8080)
// A year of logs is a few hundred KB once gzipped; this leaves room without making the slot worth abusing.
const MAX_BYTES = Number(process.env.MAX_BYTES ?? 4 * 1024 * 1024)
// Signed requests are only accepted this close to the server's clock (uploads are also protected by their version).
const SKEW_MS = 60 * 60 * 1000
const PREFIX = 'food-tracker-backup/1'

const KEY_RE = /^[A-Za-z0-9_-]{43}$/ // raw Ed25519 public key, base64url
const CODE_RE = /^[A-Za-z0-9_-]{22}$/ // 16 random bytes, base64url

const dir = (d) => path.join(DATA, d)
for (const d of ['invites', 'used', 'keys', 'blobs']) fs.mkdirSync(dir(d), { recursive: true })

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest()
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
function writeAtomic(file, data) {
  fs.writeFileSync(`${file}.tmp`, data)
  fs.renameSync(`${file}.tmp`, file)
}
const metaFile = (key) => path.join(dir('keys'), `${key}.json`)
const blobFile = (key) => path.join(dir('blobs'), key)
const inboxFile = (key) => path.join(dir('blobs'), `${key}.inbox`)

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    Object.assign(this, { status, extra })
  }
}

/** What the client signs: everything that says what the request does. */
const signedText = (method, url, time, prev, body) =>
  [PREFIX, method, url, time, prev, sha256(body).toString('hex')].join('\n')

function verify(req, key, body, header = 'x-signature') {
  const time = req.headers['x-time'] ?? ''
  const prev = req.headers['x-prev'] ?? ''
  const sig = Buffer.from(req.headers[header] ?? '', 'base64url')
  if (!(Math.abs(Date.now() - Number(time)) < SKEW_MS)) throw new HttpError(401, "This device's clock is too far off.")
  const publicKey = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: key }, format: 'jwk' })
  if (!crypto.verify(null, Buffer.from(signedText(req.method, req.url, time, prev, body)), publicKey, sig)) {
    throw new HttpError(401, 'Bad signature.')
  }
  return prev
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      // The rest is read and dropped, so the client still gets the 413.
      if (size > MAX_BYTES) reject(new HttpError(413, `The backup is over the ${Math.round(MAX_BYTES / 1024 / 1024)} MB limit.`))
      else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function register(req, body) {
  let invite, key
  try {
    ({ invite, key } = JSON.parse(body))
  } catch {
    throw new HttpError(400, 'Bad request.')
  }
  if (!KEY_RE.test(key ?? '')) throw new HttpError(400, 'Bad key.')
  verify(req, key, body)
  if (fs.existsSync(metaFile(key))) return [200, { ok: true }]
  const code = String(invite ?? '').trim()
  if (!CODE_RE.test(code)) throw new HttpError(403, 'Unknown or already used invite code.')
  // The rename is what uses the code up: two registrations with one code can't both win it.
  try {
    fs.renameSync(path.join(dir('invites'), code), path.join(dir('used'), code))
  } catch (e) {
    if (e.code === 'ENOENT') throw new HttpError(403, 'Unknown or already used invite code.')
    throw e
  }
  const name = fs.readFileSync(path.join(dir('used'), code), 'utf8').trim()
  writeAtomic(metaFile(key), JSON.stringify({ name, created: new Date().toISOString(), version: '' }))
  return [201, { ok: true }]
}

function meta(key) {
  if (!KEY_RE.test(key) || !fs.existsSync(metaFile(key))) throw new HttpError(404, 'Unknown backup key.')
  const m = readJson(metaFile(key))
  if (m.rotated) throw new HttpError(410, 'This secret was replaced by a new one on another device. Restore with the new one.')
  return m
}

// Read, check and write happen in one synchronous run, so two uploads to one key can't interleave.
function upload(req, key, body) {
  const m = meta(key)
  const prev = verify(req, key, body)
  if (prev !== m.version) throw new HttpError(409, 'The backup was changed from another device.', { version: m.version })
  const version = sha256(body).subarray(0, 16).toString('base64url')
  writeAtomic(blobFile(key), body)
  writeAtomic(metaFile(key), JSON.stringify({ ...m, version, size: body.length, updated: new Date().toISOString() }))
  return [200, { version }]
}

// The old key signs the move (it owns the backup), the new one signs too (it's really the new secret's), and the
// compare-and-swap is on the old key's version, as an upload.
function rotate(req, key, next, body) {
  const m = meta(key)
  const prev = verify(req, key, body)
  if (!KEY_RE.test(next)) throw new HttpError(400, 'Bad key.')
  verify(req, next, body, 'x-new-signature')
  if (prev !== m.version) throw new HttpError(409, 'The backup was changed from another device.', { version: m.version })
  if (fs.existsSync(metaFile(next))) throw new HttpError(409, 'That key is taken.')
  const version = sha256(body).subarray(0, 16).toString('base64url')
  const now = new Date().toISOString()
  writeAtomic(blobFile(next), body)
  writeAtomic(metaFile(next), JSON.stringify({ name: m.name, created: m.created, version, size: body.length, updated: now }))
  writeAtomic(metaFile(key), JSON.stringify({ name: m.name, rotated: now }))
  fs.rmSync(blobFile(key), { force: true })
  fs.rmSync(inboxFile(key), { force: true })
  return [200, { version }]
}

// A GET whose X-Prev is the current version (a hash of the blob) gets 204 without the blob: devices check often.
function download(req, res, key, body) {
  const m = meta(key)
  const prev = verify(req, key, body)
  if (!m.version) throw new HttpError(404, 'Nothing has been backed up with this secret yet.')
  const unchanged = prev && prev === m.version
  res.writeHead(unchanged ? 204 : 200, {
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Version': m.version,
    'X-Updated': m.updated,
  })
  res.end(unchanged ? undefined : fs.readFileSync(blobFile(key)))
}

// The inbox: like the backup (one blob, compare-and-swap on `inboxVersion`), plus DELETE once it's been taken in.
function inbox(req, res, key, body) {
  const m = meta(key)
  const prev = verify(req, key, body)
  const current = m.inboxVersion ?? ''
  if (req.method === 'GET') {
    if (!current) throw new HttpError(404, 'The inbox is empty.')
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Version': current })
    res.end(fs.readFileSync(inboxFile(key)))
    return
  }
  if (prev !== current) throw new HttpError(409, 'The inbox changed meanwhile.', { version: current })
  if (req.method === 'PUT') {
    const version = sha256(body).subarray(0, 16).toString('base64url')
    writeAtomic(inboxFile(key), body)
    writeAtomic(metaFile(key), JSON.stringify({ ...m, inboxVersion: version, inboxSize: body.length }))
    return [200, { version }]
  }
  if (req.method === 'DELETE') {
    fs.rmSync(inboxFile(key), { force: true })
    const { inboxVersion, inboxSize, ...rest } = m
    writeAtomic(metaFile(key), JSON.stringify(rest))
    return [200, { ok: true }]
  }
  throw new HttpError(405, 'Method not allowed.')
}

async function handle(req, res) {
  const parts = req.url.split('?')[0].split('/')
  if (parts[1] !== 'backup' || parts.length < 3 || parts.length > 4) throw new HttpError(404, 'Not found.')
  const [, , key, next] = parts
  // Unknown keys are turned away before their body is read.
  if (req.method === 'PUT' || req.method === 'DELETE' || next) meta(key)
  const body = await readBody(req)
  if (next === 'inbox') return inbox(req, res, key, body)
  if (req.method === 'POST' && next) return rotate(req, key, next, body)
  if (next) throw new HttpError(405, 'Method not allowed.')
  if (req.method === 'POST' && key === 'keys') return register(req, body)
  if (req.method === 'PUT') return upload(req, key, body)
  if (req.method === 'GET') return download(req, res, key, body)
  throw new HttpError(405, 'Method not allowed.')
}

function serve() {
  http.createServer(async (req, res) => {
    let status, json
    try {
      const out = await handle(req, res)
      if (!out) return
      ;[status, json] = out
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e)
      status = e.status ?? 500
      json = { error: e instanceof HttpError ? e.message : 'Server error.', ...e.extra }
    }
    if (res.headersSent) return
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(json))
  }).listen(PORT, () => console.log(`Backup server on :${PORT}, data in ${DATA}`))
}

const [cmd, arg] = process.argv.slice(2)
if (!cmd) serve()
else if (cmd === 'invite' && arg) {
  const code = crypto.randomBytes(16).toString('base64url')
  fs.writeFileSync(path.join(dir('invites'), code), `${arg}\n`)
  console.log(code)
} else if (cmd === 'list') {
  for (const code of fs.readdirSync(dir('invites'))) {
    console.log(`code ${code}  ${fs.readFileSync(path.join(dir('invites'), code), 'utf8').trim()}  (unused)`)
  }
  for (const f of fs.readdirSync(dir('keys')).filter((f) => f.endsWith('.json'))) {
    const m = readJson(path.join(dir('keys'), f))
    if (m.rotated) {
      console.log(`old  ${f.slice(0, -5)}  ${m.name}  replaced ${m.rotated}`)
      continue
    }
    const size = m.size == null ? 'empty' : `${Math.ceil(m.size / 1024)} KB`
    const inbox = m.inboxVersion ? '  inbox waiting' : ''
    console.log(`key  ${f.slice(0, -5)}  ${m.name}  ${size}  last upload ${m.updated ?? 'never'}${inbox}`)
  }
} else if (cmd === 'remove' && arg) {
  const keys = fs.readdirSync(dir('keys')).filter((f) => f.endsWith('.json') && f.startsWith(arg))
  if (keys.length !== 1) {
    console.error(keys.length ? 'That prefix matches several keys.' : 'No such key.')
    process.exit(1)
  }
  const key = keys[0].slice(0, -5)
  fs.rmSync(metaFile(key))
  fs.rmSync(blobFile(key), { force: true })
  fs.rmSync(inboxFile(key), { force: true })
  console.log(`Removed ${key}`)
} else {
  console.error('Usage: node server.mjs [invite <name> | list | remove <key>]')
  process.exit(1)
}
