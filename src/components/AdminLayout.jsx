import React, { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useMovieData } from '../data/MovieDataContext'
import '../styles/admin.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/movie-catalog', label: 'Movie Catalog', icon: '🎞️' },
  { to: '/add-movie', label: 'Add New Movie', icon: '➕' },
  { to: '/categories', label: 'Categories', icon: '🏷️' },
  { to: '/user-management', label: 'User Management', icon: '👥' },
  { to: '/activity-log', label: 'Activity Log', icon: '🕘' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
  { to: '/player', label: 'M3U Player', icon: '📽️' },
]

const AdminLayout = () => {
  const { settings } = useMovieData()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.title = `${settings.siteName} · Admin`
  }, [settings.siteName])

  const current =
    NAV_ITEMS.find(
      (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
    ) || null

  const currentLabel = current?.label
    || (location.pathname.startsWith('/movie-details') ? 'Movie Details' : null)
    || (location.pathname.startsWith('/edit-movie') ? 'Edit Movie' : null)
    || 'Admin'

  return (
    <div className="admin-shell">
      <aside id="admin-navigation" className={`admin-sidebar${menuOpen ? ' open' : ''}`}>
        <Link to="/dashboard" className="brand">
          <span className="brand-mark" aria-hidden="true">
            🎬
          </span>
          <span className="brand-text">
            <strong>{settings.siteName}</strong>
            <small>Admin console</small>
          </span>
        </Link>

        <nav className="admin-nav" aria-label="Admin sections">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <p className="sidebar-foot">Catalog data is saved in this browser.</p>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="admin-content">
        <header className="admin-topbar">
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="admin-navigation"
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            ☰
          </button>
          <span className="topbar-title">{currentLabel}</span>
          <Link to="/add-movie" className="btn btn-primary btn-sm topbar-action">
            + Add movie
          </Link>
        </header>

        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
