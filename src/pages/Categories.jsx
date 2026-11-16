import React, { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { useMovieData } from '../data/MovieDataContext'

const Categories = () => {
  const { categories, movies, addCategory, renameCategory } = useMovieData()
  const [newName, setNewName] = useState('')
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(categories.map((category) => [category.id, category.name])),
  )
  const [feedback, setFeedback] = useState('')

  const countFor = (categoryId) => movies.filter((movie) => movie.categoryId === categoryId).length

  const handleAdd = (event) => {
    event.preventDefault()
    const name = newName.trim()

    if (!name) {
      setFeedback('Enter a category name first.')
      return
    }
    if (!addCategory(name)) {
      setFeedback(`“${name}” already exists.`)
      return
    }

    setNewName('')
    setFeedback(`Added the “${name}” category.`)
  }

  const handleRename = (category) => {
    const name = (drafts[category.id] || '').trim()

    if (!name) {
      setFeedback('A category name cannot be empty.')
      return
    }
    if (name === category.name) return
    if (!renameCategory(category.id, name)) {
      setFeedback(`“${name}” already exists.`)
      return
    }

    setFeedback(`Renamed “${category.name}” to “${name}”.`)
  }

  return (
    <div className="page">
      <PageHeader
        title="Categories"
        subtitle="Genres used to group titles across the catalog."
      />

      {feedback && (
        <p className="inline-feedback" role="status">
          {feedback}
        </p>
      )}

      <form className="panel add-category-form" onSubmit={handleAdd}>
        <label className="field">
          <span>New category</span>
          <div className="inline-form">
            <input
              type="text"
              value={newName}
              placeholder="e.g. Thriller"
              onChange={(event) => {
                setNewName(event.target.value)
                setFeedback('')
              }}
            />
            <button type="submit" className="btn btn-primary">
              Add category
            </button>
          </div>
        </label>
      </form>

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Movies</th>
                <th scope="col" className="align-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 && (
                <tr>
                  <td colSpan="3" className="muted">
                    No categories yet — add the first one above.
                  </td>
                </tr>
              )}
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <input
                      type="text"
                      aria-label={`Name for ${category.name}`}
                      value={drafts[category.id] ?? category.name}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [category.id]: event.target.value }))
                      }
                    />
                  </td>
                  <td>
                    {countFor(category.id)} {countFor(category.id) === 1 ? 'title' : 'titles'}
                  </td>
                  <td className="align-right">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleRename(category)}
                      disabled={(drafts[category.id] ?? category.name) === category.name}
                    >
                      Rename
                    </button>
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

export default Categories
