import React, { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { useMovieData } from '../data/MovieDataContext'
import { initials } from '../utils/format'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
]

const UserManagement = () => {
  const { users, updateUser, removeUser } = useMovieData()
  const [draftEmails, setDraftEmails] = useState(() =>
    Object.fromEntries(users.map((user) => [user.id, user.email])),
  )
  const [feedback, setFeedback] = useState('')

  const saveEmail = (user) => {
    const email = (draftEmails[user.id] || '').trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFeedback('Enter a valid email address.')
      return
    }
    if (users.some((entry) => entry.id !== user.id && entry.email.toLowerCase() === email.toLowerCase())) {
      setFeedback('Another account already uses that email.')
      return
    }

    updateUser(user.id, { email })
    setFeedback(`Saved the email for ${user.name}.`)
  }

  const handleRemove = (user) => {
    if (window.confirm(`Remove access for ${user.name}? This cannot be undone.`)) {
      removeUser(user.id)
      setFeedback(`${user.name} no longer has access.`)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="User Management"
        subtitle={`${users.length} ${users.length === 1 ? 'account' : 'accounts'} can access the console.`}
      />

      {feedback && (
        <p className="inline-feedback" role="status">
          {feedback}
        </p>
      )}

      <section className="panel table-panel">
        <div className="table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Access</th>
                <th scope="col" className="align-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <span className="avatar">{initials(user.name)}</span>
                      <span>
                        <strong>{user.name}</strong>
                        <small className="muted">
                          {user.status === 'active' ? 'Active' : 'Disabled'}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="email-cell">
                      <input
                        type="email"
                        aria-label={`Email for ${user.name}`}
                        value={draftEmails[user.id] ?? ''}
                        onChange={(event) =>
                          setDraftEmails((prev) => ({ ...prev, [user.id]: event.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => saveEmail(user)}
                        disabled={(draftEmails[user.id] ?? '') === user.email}
                      >
                        Save
                      </button>
                    </div>
                  </td>
                  <td>
                    <select
                      aria-label={`Role for ${user.name}`}
                      value={user.role}
                      onChange={(event) => updateUser(user.id, { role: event.target.value })}
                    >
                      {ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`status-chip ${user.status}`}>
                      {user.status === 'active' ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="align-right">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          updateUser(user.id, {
                            status: user.status === 'active' ? 'disabled' : 'active',
                          })
                        }
                      >
                        {user.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemove(user)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default UserManagement
