import React from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useMovieData } from '../data/MovieDataContext'
import { activityIcon } from '../utils/activity'
import { formatDate, formatDateTime, formatRating } from '../utils/format'

const Dashboard = () => {
  const { movies, categories, users, activity, categoryName, settings } = useMovieData()

  const totalMovies = movies.length
  const averageRating = totalMovies
    ? movies.reduce((sum, movie) => sum + (Number(movie.rating) || 0), 0) / totalMovies
    : 0
  const activeUsers = users.filter((user) => user.status === 'active').length

  const breakdown = categories
    .map((category) => ({
      ...category,
      count: movies.filter((movie) => movie.categoryId === category.id).length,
    }))
    .sort((a, b) => b.count - a.count)
  const maxCount = Math.max(1, ...breakdown.map((category) => category.count))

  const recentMovies = [...movies]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 4)
  const recentActivity = activity.slice(0, 5)

  const stats = [
    { label: 'Total movies', value: totalMovies, hint: 'In the collection', icon: '🎞️' },
    { label: 'Categories', value: categories.length, hint: 'Genres in use', icon: '🏷️' },
    { label: 'Active users', value: activeUsers, hint: `of ${users.length} accounts`, icon: '👥' },
    {
      label: 'Average rating',
      value: totalMovies ? formatRating(averageRating) : '—',
      hint: 'Out of 10',
      icon: '⭐',
    },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle="A quick read on the catalog and who is managing it."
        actions={
          <>
            <Link to="/movie-catalog" className="btn btn-ghost btn-sm">
              View catalog
            </Link>
            <Link to="/add-movie" className="btn btn-primary btn-sm">
              + Add movie
            </Link>
          </>
        }
      />

      <section className="stat-grid" aria-label="Summary statistics">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <span className="stat-icon" aria-hidden="true">
              {stat.icon}
            </span>
            <span className="stat-label">{stat.label}</span>
            <strong className="stat-value">{stat.value}</strong>
            <span className="stat-hint">{stat.hint}</span>
          </article>
        ))}
      </section>

      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-head">
            <h2>Movies by category</h2>
            <Link to="/categories" className="text-link">
              Manage
            </Link>
          </div>
          {breakdown.length === 0 ? (
            <p className="muted">No categories yet.</p>
          ) : (
            <ul className="breakdown-list">
              {breakdown.map((category) => (
                <li key={category.id}>
                  <div className="breakdown-row">
                    <Link to={`/movie-catalog?category=${category.id}`} className="breakdown-name">
                      {category.name}
                    </Link>
                    <span className="breakdown-count">
                      {category.count} {category.count === 1 ? 'title' : 'titles'}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${Math.round((category.count / maxCount) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Recently added</h2>
            <Link to="/movie-catalog" className="text-link">
              All movies
            </Link>
          </div>
          {recentMovies.length === 0 ? (
            <p className="muted">Nothing in the catalog yet.</p>
          ) : (
            <ul className="compact-list">
              {recentMovies.map((movie) => (
                <li key={movie.id}>
                  <Link to={`/movie-details/${movie.id}`} className="compact-item">
                    <span className="compact-thumb">
                      {movie.poster ? (
                        <img src={movie.poster} alt="" />
                      ) : (
                        <span aria-hidden="true">🎬</span>
                      )}
                    </span>
                    <span className="compact-body">
                      <strong>{movie.title}</strong>
                      <small>
                        {categoryName(movie.categoryId)} · {formatDate(movie.releaseDate)}
                      </small>
                    </span>
                    <span className="rating-badge">{formatRating(movie.rating)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {settings.showDashboardActivity && (
      <section className="panel">
        <div className="panel-head">
          <h2>Latest activity</h2>
          <Link to="/activity-log" className="text-link">
            Full history
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="muted">No changes recorded yet.</p>
        ) : (
          <ul className="activity-list">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="activity-item">
                <span className="activity-icon" aria-hidden="true">
                  {activityIcon(entry.type)}
                </span>
                <span className="activity-body">
                  <span>{entry.message}</span>
                  <small>{formatDateTime(entry.timestamp)}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
    </div>
  )
}

export default Dashboard
