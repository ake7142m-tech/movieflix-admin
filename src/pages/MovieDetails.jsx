import React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useMovieData } from '../data/MovieDataContext'
import { formatDate, formatDateTime, formatRating, initials } from '../utils/format'

const MovieDetails = () => {
  const { id } = useParams()
  const { movies, getMovie, categoryName, removeMovie, settings } = useMovieData()
  const navigate = useNavigate()
  const movie = id ? getMovie(id) : null

  if (!id) {
    return (
      <div className="page">
        <PageHeader
          title="Movie Details"
          subtitle="Choose a movie from the catalog to see its full details."
        />
        <section className="panel">
          {movies.length === 0 ? (
            <p className="muted">The catalog is empty.</p>
          ) : (
            <ul className="picker-list">
              {[...movies]
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((entry) => (
                  <li key={entry.id}>
                    <Link to={`/movie-details/${entry.id}`} className="picker-item">
                      <span className="avatar avatar-sm">{initials(entry.title)}</span>
                      <span className="picker-body">
                        <strong>{entry.title}</strong>
                        <small>
                          {categoryName(entry.categoryId)} · {formatDate(entry.releaseDate)}
                        </small>
                      </span>
                      <span className="text-link">Open →</span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="page">
        <PageHeader title="Movie not found" />
        <section className="panel empty-state">
          <span aria-hidden="true">🎬</span>
          <p className="muted">That movie is no longer in the catalog.</p>
          <Link to="/movie-catalog" className="btn btn-primary btn-sm">
            Back to catalog
          </Link>
        </section>
      </div>
    )
  }

  const handleDelete = () => {
    if (window.confirm(`Delete “${movie.title}”? This also removes it from the catalog.`)) {
      removeMovie(movie.id)
      navigate('/movie-catalog')
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Movie Details"
        actions={
          <>
            <Link to="/movie-catalog" className="btn btn-ghost btn-sm">
              ← Catalog
            </Link>
            <Link to={`/edit-movie/${movie.id}`} className="btn btn-primary btn-sm">
              Edit movie
            </Link>
          </>
        }
      />

      <article className="panel details-card">
        <div className="details-poster">
          {movie.poster ? (
            <img src={movie.poster} alt={`${movie.title} poster`} />
          ) : (
            <span className="poster-placeholder" aria-hidden="true">
              🎬
            </span>
          )}
        </div>

        <div className="details-body">
          <div className="details-heading">
            <h2>{movie.title}</h2>
            {settings.showRatings && (
              <span className="rating-pill">⭐ {formatRating(movie.rating)} / 10</span>
            )}
          </div>

          <dl className="details-meta">
            <div>
              <dt>Release date</dt>
              <dd>{formatDate(movie.releaseDate)}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{categoryName(movie.categoryId)}</dd>
            </div>
            <div>
              <dt>Rating</dt>
              <dd>{settings.showRatings ? `${formatRating(movie.rating)} / 10` : 'Hidden'}</dd>
            </div>
          </dl>

          <section className="details-description">
            <h3>Description</h3>
            <p>{movie.description || 'No description has been added for this title yet.'}</p>
          </section>

          <footer className="details-footer">
            <span className="muted">
              Added {formatDateTime(movie.createdAt)} · Updated {formatDateTime(movie.updatedAt)}
            </span>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete}>
              Delete movie
            </button>
          </footer>
        </div>
      </article>
    </div>
  )
}

export default MovieDetails
