// Temp notes' logic (screens/Notes.jsx, and the Android app's native screen through native/core.js): pictures shrunk
// to keep, saving and deleting a note.
import { db, dropUnusedFiles, noteExpiry } from './db'
import { deleteFiles } from './backup'
import { t } from './i18n'

// Pictures are shrunk to this many pixels on their long side, as JPEG: plenty to read a plate or a label, and a few
// hundred KB instead of a phone camera's several MB.
const MAX_SIDE = 1600
const QUALITY = 0.85

/** A picked image as a JPEG Blob at most MAX_SIDE on its long side, upright. */
export async function shrink(file) {
  let bmp
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(file.name ? t("Couldn't read “{name}” as a picture.", { name: file.name }) : t("Couldn't read it as a picture."))
  }
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) })
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't save the picture."))), 'image/jpeg', QUALITY))
}

const daysLeft = (note) => Math.max(0, Math.ceil((noteExpiry(note) - Date.now()) / 864e5))

/** "3 days left", or "goes today". */
export const leftText = (note) => (daysLeft(note) ? `${daysLeft(note)} day${daysLeft(note) === 1 ? '' : 's'} left` : 'goes today')

/**
 * Saves `note` (a stored one, or a new one: {userId}) with `text`, `done` and `pics`: [{id, name}] stored, or
 * [{key, blob, name}] picked and not saved yet. A new note is stamped with the time it's saved.
 */
export async function saveNote(note, text, done, pics) {
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
  // Off the server behind it: saving never waits for the network.
  const removed = (note.pictures ?? []).filter((id) => !rec.pictures.includes(id))
  if (removed.length) {
    await dropUnusedFiles()
    deleteFiles(removed)
  }
}

export async function deleteNote(note) {
  await db.notes.delete(note.id)
  await dropUnusedFiles()
  deleteFiles(note.pictures ?? [])
}
