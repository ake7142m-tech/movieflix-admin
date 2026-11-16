import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { seedData } from './seed'

const STORAGE_KEY = 'movieflix:admin-data'
const MAX_ACTIVITY = 300

const MovieDataContext = createContext(null)

const createId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const nowIso = () => new Date().toISOString()

const createActivity = (type, message) => ({
  id: createId('act'),
  type,
  message,
  timestamp: nowIso(),
})

const withActivity = (data, activity) => ({
  ...data,
  activity: [activity, ...data.activity].slice(0, MAX_ACTIVITY),
})

const loadData = () => {
  if (typeof window === 'undefined') return seedData

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return seedData

    const parsed = JSON.parse(stored)
    return {
      movies: Array.isArray(parsed.movies) ? parsed.movies : seedData.movies,
      categories: Array.isArray(parsed.categories) ? parsed.categories : seedData.categories,
      users: Array.isArray(parsed.users) ? parsed.users : seedData.users,
      activity: Array.isArray(parsed.activity) ? parsed.activity : seedData.activity,
      settings: { ...seedData.settings, ...(parsed.settings || {}) },
    }
  } catch {
    // A corrupt or blocked storage must not stop the admin app from rendering.
    return seedData
  }
}

export const MovieDataProvider = ({ children }) => {
  const [data, setData] = useState(loadData)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Storage can be full or unavailable; the in-memory data still works.
    }
  }, [data])

  const addMovie = useCallback((values) => {
    const timestamp = nowIso()
    const movie = { ...values, id: createId('movie'), createdAt: timestamp, updatedAt: timestamp }

    setData((prev) =>
      withActivity(
        { ...prev, movies: [movie, ...prev.movies] },
        createActivity('movie.added', `Added “${movie.title}” to the catalog`),
      ),
    )

    return movie
  }, [])

  const updateMovie = useCallback((id, values) => {
    const timestamp = nowIso()

    setData((prev) => {
      const existing = prev.movies.find((movie) => movie.id === id)
      if (!existing) return prev

      const updated = { ...existing, ...values, id, updatedAt: timestamp }
      return withActivity(
        { ...prev, movies: prev.movies.map((movie) => (movie.id === id ? updated : movie)) },
        createActivity('movie.updated', `Updated “${updated.title}”`),
      )
    })
  }, [])

  const removeMovie = useCallback((id) => {
    setData((prev) => {
      const existing = prev.movies.find((movie) => movie.id === id)
      if (!existing) return prev

      return withActivity(
        { ...prev, movies: prev.movies.filter((movie) => movie.id !== id) },
        createActivity('movie.deleted', `Deleted “${existing.title}” from the catalog`),
      )
    })
  }, [])

  const addCategory = useCallback(
    (rawName) => {
      const name = rawName.trim()
      if (!name) return false
      if (data.categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
        return false
      }

      const category = { id: createId('cat'), name }
      setData((prev) =>
        withActivity(
          { ...prev, categories: [...prev.categories, category] },
          createActivity('category.added', `Added the “${name}” category`),
        ),
      )
      return true
    },
    [data.categories],
  )

  const renameCategory = useCallback(
    (id, rawName) => {
      const name = rawName.trim()
      if (!name) return false

      const existing = data.categories.find((category) => category.id === id)
      if (!existing) return false
      if (
        data.categories.some(
          (category) => category.id !== id && category.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        return false
      }

      setData((prev) =>
        withActivity(
          {
            ...prev,
            categories: prev.categories.map((category) =>
              category.id === id ? { ...category, name } : category,
            ),
          },
          createActivity('category.renamed', `Renamed “${existing.name}” to “${name}”`),
        ),
      )
      return true
    },
    [data.categories],
  )

  const updateUser = useCallback((id, patch) => {
    setData((prev) => {
      const existing = prev.users.find((user) => user.id === id)
      if (!existing) return prev

      const fields = Object.keys(patch)
      const label = fields.length === 1 ? fields[0] : fields.join(', ')
      return withActivity(
        {
          ...prev,
          users: prev.users.map((user) => (user.id === id ? { ...user, ...patch } : user)),
        },
        createActivity('user.updated', `Updated ${existing.name}’s ${label}`),
      )
    })
  }, [])

  const removeUser = useCallback((id) => {
    setData((prev) => {
      const existing = prev.users.find((user) => user.id === id)
      if (!existing) return prev

      return withActivity(
        { ...prev, users: prev.users.filter((user) => user.id !== id) },
        createActivity('user.removed', `Removed ${existing.name}’s access`),
      )
    })
  }, [])

  const updateSettings = useCallback((patch) => {
    setData((prev) =>
      withActivity(
        { ...prev, settings: { ...prev.settings, ...patch } },
        createActivity('settings.updated', 'Updated application settings'),
      ),
    )
  }, [])

  const getMovie = (id) => data.movies.find((movie) => movie.id === id) || null
  const getCategory = (id) => data.categories.find((category) => category.id === id) || null
  const categoryName = (id) => getCategory(id)?.name || 'Uncategorized'

  const value = {
    ...data,
    addMovie,
    updateMovie,
    removeMovie,
    addCategory,
    renameCategory,
    updateUser,
    removeUser,
    updateSettings,
    getMovie,
    getCategory,
    categoryName,
  }

  return <MovieDataContext.Provider value={value}>{children}</MovieDataContext.Provider>
}

export const useMovieData = () => {
  const context = useContext(MovieDataContext)
  if (!context) throw new Error('useMovieData must be used within a MovieDataProvider')
  return context
}
