import React, { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { useMovieData } from '../data/MovieDataContext'
import { ACTIVITY_FILTERS, activityIcon, matchActivityFilter } from '../utils/activity'
import { formatDateTime } from '../utils/format'

const ActivityLog = () => {
  const { activity } = useMovieData()
  const [filter, setFilter] = useState('all')

  const entries = useMemo(
    () =>
      activity
        .filter((entry) => matchActivityFilter(entry.type, filter))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [activity, filter],
  )

  return (
    <div className="page">
      <PageHeader
        title="Activity Log"
        subtitle="A chronological history of changes made to the catalog."
      />

      <div className="filter-chips" role="group" aria-label="Filter activity">
        {ACTIVITY_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`chip${filter === option.value ? ' active' : ''}`}
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>{entries.length} recorded {entries.length === 1 ? 'change' : 'changes'}</h2>
        </div>

        {entries.length === 0 ? (
          <p className="muted">No activity matches this filter yet.</p>
        ) : (
          <ol className="activity-list activity-timeline">
            {entries.map((entry) => (
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
          </ol>
        )}
      </section>
    </div>
  )
}

export default ActivityLog
