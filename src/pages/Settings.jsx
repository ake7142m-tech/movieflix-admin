import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useMovieData } from '../data/MovieDataContext'

const Settings = () => {
  const { settings, updateSettings } = useMovieData()
  const [draft, setDraft] = useState(settings)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!saved) return undefined
    const timer = window.setTimeout(() => setSaved(false), 3000)
    return () => window.clearTimeout(timer)
  }, [saved])

  const update = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    updateSettings({
      siteName: draft.siteName.trim() || 'Movieflix Admin',
      defaultCatalogView: draft.defaultCatalogView,
      itemsPerPage: Number(draft.itemsPerPage) || 8,
      showRatings: Boolean(draft.showRatings),
      showDashboardActivity: Boolean(draft.showDashboardActivity),
    })
    setSaved(true)
  }

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        subtitle="Manage how the admin console behaves and displays the catalog."
      />

      <form className="settings-form" onSubmit={handleSubmit}>
        <section className="panel">
          <div className="panel-head">
            <h2>Application</h2>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Site name</span>
              <input
                type="text"
                value={draft.siteName}
                onChange={(event) => update('siteName', event.target.value)}
              />
              <small className="muted">Shown in the sidebar and browser tab.</small>
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Display</h2>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Default catalog layout</span>
              <select
                value={draft.defaultCatalogView}
                onChange={(event) => update('defaultCatalogView', event.target.value)}
              >
                <option value="grid">Grid</option>
                <option value="table">Table</option>
              </select>
            </label>

            <label className="field">
              <span>Movies per page</span>
              <select
                value={draft.itemsPerPage}
                onChange={(event) => update('itemsPerPage', Number(event.target.value))}
              >
                {[6, 8, 12, 24].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field-wide checkbox-field">
              <input
                type="checkbox"
                checked={Boolean(draft.showRatings)}
                onChange={(event) => update('showRatings', event.target.checked)}
              />
              <span>
                Show ratings across the catalog and dashboard
                <small className="muted">Turn off to hide scores from public-facing screens.</small>
              </span>
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Preferences</h2>
          </div>
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={Boolean(draft.showDashboardActivity)}
              onChange={(event) => update('showDashboardActivity', event.target.checked)}
            />
            <span>
              Show latest activity on the dashboard
              <small className="muted">
                Keeps a short history of recent changes on the dashboard overview.
              </small>
            </span>
          </label>
        </section>

        <div className="settings-actions">
          <Link to="/activity-log" className="btn btn-ghost">
            View activity log
          </Link>
          <div className="settings-save">
            {saved && <span className="save-notice">Settings saved.</span>}
            <button type="submit" className="btn btn-primary">
              Save settings
            </button>
          </div>
        </div>
        <p className="muted settings-note">
          Application data and preferences are stored locally in this browser.
        </p>
      </form>
    </div>
  )
}

export default Settings
