const STORAGE_KEY = 'movieflix:event-log'
const MAX_EVENTS = 500

const createEvent = (name, details = {}) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  name,
  details,
  timestamp: new Date().toISOString(),
})

const readEvents = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const events = stored ? JSON.parse(stored) : []
    return Array.isArray(events) ? events : []
  } catch {
    return []
  }
}

export const recordEvent = (name, details = {}) => {
  const event = createEvent(name, details)

  try {
    const events = [...readEvents(), event].slice(-MAX_EVENTS)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    // Event recording must never interrupt the user action that produced it.
  }

  return event
}

export const getRecordedEvents = () => readEvents()

export const clearRecordedEvents = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}
