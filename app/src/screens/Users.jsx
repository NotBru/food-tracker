import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getCurrentUser, setCurrentUser } from '../db'
import { deleteUserText, removeUser, saveUser } from '../forms'
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
    const problem = await saveUser(user, name, users)
    if (problem) return alert(problem.alert)
    onClose()
  }

  async function remove() {
    const problem = await removeUser(user.id)
    if (problem) return alert(problem.alert)
    onClose()
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
            {deleteUserText(user, count)}
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
