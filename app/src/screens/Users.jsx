import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteUser, getCurrentUser, setCurrentUser } from '../db'
import { Field, Screen } from '../components'

// Users, opened from the button on top of the homescreen. Tapping a user switches to them; ✎ edits the name.
// Each user has their own consumptions and targets; foods and config are shared.

export default function Users() {
  const data = useLiveQuery(async () => {
    const users = await db.users.orderBy('name').toArray()
    const current = await getCurrentUser()
    const counts = Object.fromEntries(await Promise.all(users.map(async (u) => [u.id, await db.logs.where('userId').equals(u.id).count()])))
    return { users, current, counts }
  })
  const [editing, setEditing] = useState(null)
  if (!data) return null
  const { users, current, counts } = data

  return (
    <Screen title="Users">
      <ul className="list">
        <li className="add" onClick={() => setEditing({ name: '' })}>+ add user</li>
        {users.map((u) => (
          <li key={u.id} className="user-row" onClick={() => setCurrentUser(u.id)}>
            <div className="list-main">
              <span>{u.name}</span>
              {u.id === current?.id && <span className="tag ok">current</span>}
              <button className="icon small" onClick={(e) => { e.stopPropagation(); setEditing(u) }} aria-label={`Edit ${u.name}`}>✎</button>
            </div>
            <span className="muted">{counts[u.id]} consumption{counts[u.id] === 1 ? '' : 's'}</span>
          </li>
        ))}
      </ul>
      {editing && <UserEditor user={editing} users={users} count={counts[editing.id] ?? 0} onClose={() => setEditing(null)} />}
    </Screen>
  )
}

function UserEditor({ user, users, count, onClose }) {
  const [name, setName] = useState(user.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function save() {
    const n = name.trim()
    if (!n) return alert('Name is required.')
    if (users.some((u) => u.id !== user.id && u.name.toLowerCase() === n.toLowerCase())) return alert(`There is already a user “${n}”.`)
    if (user.id) await db.users.update(user.id, { name: n })
    else await setCurrentUser(await db.users.add({ name: n })) // a new user is usually added to be used
    onClose()
  }

  async function remove() {
    try {
      await deleteUser(user.id)
      onClose()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{user.id ? 'Edit user' : 'New user'}</h2>
        <form className="form" onSubmit={(e) => { e.preventDefault(); save() }}>
          <Field label="Name">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </form>
        {confirmDelete && (
          <p className="warn">
            Deleting {user.name} also deletes their {count} consumption{count === 1 ? '' : 's'} and their targets. Foods stay.
          </p>
        )}
        <div className="row actions">
          {user.id && users.length > 1 && (
            confirmDelete
              ? <button className="danger" onClick={remove}>Delete for good</button>
              : <button className="danger" onClick={() => setConfirmDelete(true)}>Delete</button>
          )}
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
