import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useMovieData } from '../data/MovieDataContext'
import { formatDate, formatRating } from '../utils/format'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'release', label: 'Release date' },
]

const MovieCatalog = () => {
  const { movies, categories, categoryName, removeMovie, settings } = useMovieData()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState(searchParams.get('category') || 'all')
  const [sortBy, setSortBy] = useState('newest')
  const [view, setView] = useState(settings.defaultCatalogView === 'table' ? 'table' : 'grid')
  const [page, setPage] = useState(1)

  const perPage = Number(settings.itemsPerPage) || 8

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    const result = movies.filter((movie) => {
      const matchesTerm =
        !term ||
        movie.title.toLowerCase().includes(term) ||
        (movie.description || '').toLowerCase().includes(term)
      const matchesCategory = categoryId === 'all' || movie.categoryId === categoryId
      return matchesTerm && matchesCategory
    })

    return result.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'rating') return (Number(b.rating) || 0) - (Number(a.rating) || 0)
      if (sortBy === 'release') return String(b.releaseDate).localeCompare(String(a.releaseDate))
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    })
  }, [movies, search, categoryId, sortBy])

  useEffect(() => {
    setPage(1)
  }, [search, categoryId, sortBy, perPage])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const currentPage = Math.min(page, pageCount)
  const visibleMovies = filtered.slice((currentPage - 1) * perPage, currentPage * perPage)

  const handleDelete = (movie) => {
    if (window.confirm(`Delete “${movie.title}”? This also removes it from the catalog.`)) {
      removeMovie(movie.id)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Movie Catalog"
        subtitle={`${movies.length} ${movies.length === 1 ? 'title' : 'titles'} in the collection.`}
        actions={
          <Link to="/add-movie" className="btn btn-primary btn-sm">
            + Add movie
          </Link>
        }
      />

      <section className="panel toolbar-panel">
        <div className="toolbar">
          <label className="search-field">
            <span className="visually-hidden">Search movies</span>
            <input
              type="search"
              value={search}
              placeholder="Search by title or description…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="select-field">
            <span className="visually-hidden">Filter by category</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="select-field">
            <span className="visually-hidden">Sort movies</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="view-toggle" role="group" aria-label="Catalog layout">
            <button
              type="button"
              className={view === 'grid' ? 'active' : ''}
              onClick={() => setView('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              className={view === 'table' ? 'active' : ''}
              onClick={() => setView('table')}
            >
              Table
            </button>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <section className="panel empty-state">
          <span aria-hidden="true">🔍</span>
          <h2>No movies match those filters</h2>
          <p className="muted">Try a different search term or category.</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSearch('')
              setCategoryId('all')
            }}
          >
            Clear filters
          </button>
        </section>
      ) : view === 'grid' ? (
        <div className="movie-grid">
          {visibleMovies.map((movie) => (
            <article key={movie.id} className="movie-card">
              <Link to={`/movie-details/${movie.id}`} className="movie-poster">
                {movie.poster ? (
                  <img src={movie.poster} alt={`${movie.title} poster`} />
                ) : (
                  <span className="poster-placeholder" aria-hidden="true">
                    🎬
                  </span>
                )}
                {settings.showRatings && (
                  <span className="poster-rating">{formatRating(movie.rating)}</span>
                )}
              </Link>
              <div className="movie-card-body">
                <Link to={`/movie-details/${movie.id}`} className="movie-title">
                  {movie.title}
                </Link>
                <p className="movie-meta">
                  {categoryName(movie.categoryId)} · {formatDate(movie.releaseDate)}
                </p>
                <div className="card-actions">
                  <Link to={`/movie-details/${movie.id}`} className="btn btn-ghost btn-sm">
                    View
                  </Link>
                  <Link to={`/edit-movie/${movie.id}`} className="btn btn-ghost btn-sm">
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(movie)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel table-panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Category</th>
                  <th scope="col">Released</th>
                  {settings.showRatings && <th scope="col">Rating</th>}
                  <th scope="col" className="align-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleMovies.map((movie) => (
                  <tr key={movie.id}>
                    <td>
                      <Link to={`/movie-details/${movie.id}`} className="row-title">
                        <span className="row-thumb">
                          {movie.poster ? <img src={movie.poster} alt="" /> : '🎬'}
                        </span>
                        {movie.title}
                      </Link>
                    </td>
                    <td>{categoryName(movie.categoryId)}</td>
                    <td>{formatDate(movie.releaseDate)}</td>
                    {settings.showRatings && <td>{formatRating(movie.rating)}</td>}
                    <td className="align-right">
                      <div className="row-actions">
                        <Link to={`/edit-movie/${movie.id}`} className="btn btn-ghost btn-sm">
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(movie)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {filtered.length > perPage && (
        <div className="pagination">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            ← Previous
          </button>
          <span className="muted">
            Page {currentPage} of {pageCount}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

export default MovieCatalog
