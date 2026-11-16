import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import { MovieDataProvider } from './data/MovieDataContext'
import ActivityLog from './pages/ActivityLog'
import AddMovie from './pages/AddMovie'
import Categories from './pages/Categories'
import Dashboard from './pages/Dashboard'
import EditMovie from './pages/EditMovie'
import MovieCatalog from './pages/MovieCatalog'
import MovieDetails from './pages/MovieDetails'
import PlayerPage from './pages/PlayerPage'
import Settings from './pages/Settings'
import UserManagement from './pages/UserManagement'
import './App.css'

function App() {
  return (
    <MovieDataProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/movie-catalog" element={<MovieCatalog />} />
            <Route path="/movie-details" element={<MovieDetails />} />
            <Route path="/movie-details/:id" element={<MovieDetails />} />
            <Route path="/add-movie" element={<AddMovie />} />
            <Route path="/edit-movie" element={<EditMovie />} />
            <Route path="/edit-movie/:id" element={<EditMovie />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/player" element={<PlayerPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MovieDataProvider>
  )
}

export default App
