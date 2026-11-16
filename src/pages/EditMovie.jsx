import React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import MovieForm from '../components/MovieForm'
import { useMovieData } from '../data/MovieDataContext'
import { formatDate, initials } from '../utils/format'

const EditMovie = () => {
  const { id } = useParams()
  const { movies, updateMovie, getMovie, categoryName } = useMovieData()
  const navigate = useNavigate()

  if (!id) {
    return (
      <div className="page">
        <PageHeader
          title="Edit Movie"
          subtitle="Pick a title from the catalog to update its details."
          actions={
            <Link to="/add-movie" className="btn btn-primary btn-sm">
              + Add movie instead
            </Link>
          }
        />
        <section className="panel">
          {movies.length === 0 ? (
            <p className="muted">The catalog is empty, so there is nothing to edit yet.</p>
          ) : (
            <ul className="picker-list">
              {[...movies]
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((movie) => (
                  <li key={movie.id}>
                    <Link to={`/edit-movie/${movie.id}`} className="picker-item">
                      <span className="avatar avatar-sm">{initials(movie.title)}</span>
                      <span className="picker-body">
                        <strong>{movie.title}</strong>
                        <small>
                          {categoryName(movie.categoryId)} · {formatDate(movie.releaseDate)}
                        </small>
                      </span>
                      <span className="text-link">Edit →</span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    )
  }

  const movie = getMovie(id)

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

  const handleSubmit = (values) => {
    updateMovie(movie.id, values)
    navigate(`/movie-details/${movie.id}`)
  }

  return (
    <div className="page">
      <PageHeader
        title="Edit Movie"
        subtitle={movie.title}
        actions={
          <Link to={`/movie-details/${movie.id}`} className="btn btn-ghost btn-sm">
            View details
          </Link>
        }
      />
      <MovieForm
        initialValues={movie}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        cancelTo={`/movie-details/${movie.id}`}
      />
    </div>
  )
}

export default EditMovie
