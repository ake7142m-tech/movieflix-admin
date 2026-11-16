export const ACTIVITY_ICONS = {
  'movie.added': '➕',
  'movie.updated': '✏️',
  'movie.deleted': '🗑️',
  'category.added': '🏷️',
  'category.renamed': '🏷️',
  'user.updated': '👤',
  'user.removed': '🚪',
  'settings.updated': '⚙️',
}

export const activityIcon = (type) => ACTIVITY_ICONS[type] || '•'

export const ACTIVITY_FILTERS = [
  { value: 'all', label: 'All changes', prefix: '' },
  { value: 'movies', label: 'Movies', prefix: 'movie.' },
  { value: 'categories', label: 'Categories', prefix: 'category.' },
  { value: 'users', label: 'Users', prefix: 'user.' },
  { value: 'settings', label: 'Settings', prefix: 'settings.' },
]

export const matchActivityFilter = (type, filterValue) => {
  const filter = ACTIVITY_FILTERS.find((entry) => entry.value === filterValue)
  if (!filter || !filter.prefix) return true
  return type.startsWith(filter.prefix)
}
