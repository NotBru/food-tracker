import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Dexie from 'dexie'
import { db, dropUnusedFiles, getCurrentUser, makeId, noteExpiry, NOTE_DAYS } from '../db'
import { deleteFiles } from '../backup'
import { formatDateTime } from '../time'
import { Screen, replace, useComputer } from '../components'

// Temp notes: text and pictures (camera or gallery), stamped with when they were made, gone a week later (db.js
// expireNotes). Mostly for Claude's log-food skill, which reads them from the backup. `done: true` once taken care of
// (logged, or nothing to log): set here or by the skill once it has logged a note, so it skips it next time.

// Pictures are shrunk to this many pixels on their long side, as JPEG: plenty to read a plate or a label, and a few
// hundred KB instead of a phone camera's several MB.
const MAX_SIDE = 1600
const QUALITY = 0.85

/** A picked image as a JPEG Blob at most MAX_SIDE on its long side, upright. */
async function shrink(file) {
  let bmp
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`Couldn't read “${file.name}” as a picture.`)
  }
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) })
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't save the picture."))), 'image/jpeg', QUALITY))
}

/** An object URL for a Blob, revoked when it changes or the component goes. */
function useObjectUrl(blob) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) return setUrl(null)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

/** A picture: its Blob if given (not saved yet), else the stored file `id` (a placeholder until it's synced here). */
function Picture({ id, blob, name, onClick }) {
  const stored = useLiveQuery(() => (blob ? null : db.files.get(id)), [id, blob])
  const url = useObjectUrl(blob ?? stored?.blob)
  if (!url) return <span className="note-pic missing" title={`${name ? `${name}: n` : 'N'}ot on this device yet: it comes with the next sync`}>…</span>
  return <img className="note-pic" src={url} alt={name ?? ''} title={name} onClick={onClick} />
}

/**
 * A note's pictures full screen, from `at`: ← and → (or a swipe) go through them, a tap closes. `pics`: [{id} or
 * {blob}, with name].
 */
function Viewer({ pics, at, onClose }) {
  const [i, setI] = useState(at)
  const go = (d) => setI((j) => Math.min(pics.length - 1, Math.max(0, j + d)))
  useEffect(() => {
    // Capture, and no default: with the editor below, the arrows mustn't also move its text cursor.
    const onKey = (e) => {
      const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key]
      if (!d) return
      e.preventDefault()
      e.stopPropagation()
      go(d)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [pics.length])
  // A mostly sideways swipe of 40 px or more; the tap a swipe may end in doesn't close.
  const touch = useRef(null)
  const swiped = useRef(false)
  const onTouchStart = (e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    swiped.current = true
    setTimeout(() => (swiped.current = false), 400)
    go(dx < 0 ? 1 : -1)
  }
  const onClick = () => !swiped.current && onClose()
  return (
    <div className="modal viewer" onClick={onClick} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <Picture {...pics[i]} />
      {pics.length > 1 && <span className="viewer-count">{i + 1} / {pics.length}</span>}
    </div>
  )
}

const daysLeft = (note) => Math.max(0, Math.ceil((noteExpiry(note) - Date.now()) / 864e5))

export default function Notes({ add }) {
  const data = useLiveQuery(async () => {
    const user = await getCurrentUser()
    const notes = await db.notes.where('[userId+datetime]').between([user.id, Dexie.minKey], [user.id, Dexie.maxKey]).reverse().toArray()
    return { user, notes }
  })
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const newNote = () => setEditing({ userId: data.user.id, text: '', pictures: [], pictureNames: {} })
  // Opened with ?new (the homescreen's +): straight into a new note, once; the flag leaves the URL.
  const added = useRef(false)
  useEffect(() => {
    if (!add || !data || added.current) return
    added.current = true
    newNote()
    replace('/notes')
  }, [add, data])

  if (!data) return null
  return (
    <Screen title="Temp notes" subtitle={data.user.name}>
      <p className="muted small">Deleted {NOTE_DAYS} days after they're made.</p>
      <ul className="list">
        <li className="add" onClick={newNote}>+ add note</li>
        {data.notes.map((n) => (
          <li key={n.id} className={n.done ? 'note-done' : undefined} onClick={() => setEditing(n)}>
            <div className="list-main">
              <span className="muted nowrap">{formatDateTime(n.datetime)}{n.done && <span className="done-mark"> · ✓ done</span>}</span>
              <span className="muted small nowrap">{daysLeft(n) ? `${daysLeft(n)} day${daysLeft(n) === 1 ? '' : 's'} left` : 'goes today'}</span>
            </div>
            {n.text && <p className="note-text">{n.text}</p>}
            {n.pictures?.length > 0 && (
              <div className="note-pics">
                {n.pictures.map((id, i) => (
                  <Picture key={id} id={id} name={n.pictureNames?.[id]} onClick={(e) => {
                    e.stopPropagation()
                    setViewing({ pics: n.pictures.map((id) => ({ id, name: n.pictureNames?.[id] })), at: i })
                  }} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing && <NoteEditor note={editing} onView={setViewing} onClose={() => setEditing(null)} />}
      {viewing && <Viewer {...viewing} onClose={() => setViewing(null)} />}
    </Screen>
  )
}

/** A note's text and pictures. A new one is stamped with the time it's saved; an edited one keeps its time. */
function NoteEditor({ note, onView, onClose }) {
  const [text, setText] = useState(note.text ?? '')
  const [done, setDone] = useState(!!note.done)
  // A phone's keyboard would cover the Camera and Gallery buttons, often what a note starts with.
  const computer = useComputer()
  // [{id, name}] stored, or [{key, blob, name}] picked here and not saved yet. `name`: the picked file's name.
  const [pics, setPics] = useState((note.pictures ?? []).map((id) => ({ id, key: id, name: note.pictureNames?.[id] })))
  const [busy, setBusy] = useState(false)
  const camera = useRef(null)
  const gallery = useRef(null)

  async function pick(e) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      const picked = []
      for (const f of files) picked.push({ key: makeId(), blob: await shrink(f), name: f.name || undefined })
      setPics((p) => [...p, ...picked])
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!text.trim() && !pics.length) return alert('Write something or add a picture.')
    const fresh = pics.filter((p) => p.blob).map((p) => ({ id: p.key, blob: p.blob, uploaded: false }))
    const rec = {
      ...(note.id && { id: note.id }),
      userId: note.userId,
      datetime: note.datetime ?? new Date().toISOString(),
      text: text.trim(),
      pictures: pics.map((p) => p.id ?? p.key),
      pictureNames: Object.fromEntries(pics.filter((p) => p.name).map((p) => [p.id ?? p.key, p.name])),
      ...(done && { done: true }),
    }
    // Pictures first, in the same transaction: no note ever names a picture that isn't here.
    await db.transaction('rw', db.notes, db.files, async () => {
      await db.files.bulkPut(fresh)
      await db.notes.put(rec)
    })
    const removed = (note.pictures ?? []).filter((id) => !rec.pictures.includes(id))
    if (removed.length) await dropUnusedFiles().then(() => deleteFiles(removed))
    onClose()
  }

  async function remove() {
    if (!confirm('Delete this note?')) return
    await db.notes.delete(note.id)
    await dropUnusedFiles()
    deleteFiles(note.pictures ?? [])
    onClose()
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{note.id ? `Note of ${formatDateTime(note.datetime)}` : 'New note'}</h2>
        <textarea className="note-input" autoFocus={!note.id && computer} rows={4} value={text} placeholder="What it's about…" onChange={(e) => setText(e.target.value)} />
        {pics.length > 0 && (
          <div className="note-pics">
            {pics.map((p, i) => (
              <span key={p.key} className="note-pic-wrap">
                <Picture id={p.id} blob={p.blob} name={p.name} onClick={() => onView({ pics: pics.map((q) => (q.blob ? { blob: q.blob, name: q.name } : { id: q.id, name: q.name })), at: i })} />
                <button className="icon small" onClick={() => setPics(pics.filter((x) => x !== p))} aria-label="Remove picture">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="row">
          <button className="secondary" disabled={busy} onClick={() => camera.current.click()}>📷 Camera</button>
          <button className="secondary" disabled={busy} onClick={() => gallery.current.click()}>🖼️ Gallery</button>
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
        <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={pick} />
        <ul className="switch-list">
          <li>
            <label>
              <span><strong>Done</strong><small className="muted">Taken care of: logged, or nothing to log. The log-food skill skips it, and marks the notes it logs.</small></span>
              <input type="checkbox" role="switch" className="switch" checked={done} onChange={(e) => setDone(e.target.checked)} />
            </label>
          </li>
        </ul>
        <div className="row actions">
          {note.id && <button className="danger" onClick={remove}>Delete</button>}
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button disabled={busy} onClick={save}>{busy ? '…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
