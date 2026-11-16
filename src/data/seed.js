const seededAt = '2026-10-01T09:00:00.000Z'

export const seedCategories = [
  { id: 'cat-action', name: 'Action' },
  { id: 'cat-drama', name: 'Drama' },
  { id: 'cat-scifi', name: 'Sci-Fi' },
  { id: 'cat-comedy', name: 'Comedy' },
  { id: 'cat-documentary', name: 'Documentary' },
]

export const seedMovies = [
  {
    id: 'movie-neon-horizon',
    title: 'Neon Horizon',
    description:
      'A courier in a rain-soaked megacity discovers a message that could bring down the corporation ruling every street she runs.',
    releaseDate: '2024-03-15',
    rating: 8.2,
    categoryId: 'cat-scifi',
    poster: null,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'movie-last-crossing',
    title: 'The Last Crossing',
    description:
      'Two estranged siblings drive a broken ferry across a shrinking lake to keep a promise made to their father.',
    releaseDate: '2023-11-02',
    rating: 7.6,
    categoryId: 'cat-drama',
    poster: null,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'movie-midnight-heist',
    title: 'Midnight Heist',
    description:
      'A retired safecracker assembles an unlikely crew for one last job beneath the city museum.',
    releaseDate: '2024-06-21',
    rating: 7.9,
    categoryId: 'cat-action',
    poster: null,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'movie-paper-moons',
    title: 'Paper Moons',
    description:
      'A small-town projectionist keeps a failing cinema alive while his daughter plans a life far away from it.',
    releaseDate: '2022-08-12',
    rating: 8.5,
    categoryId: 'cat-drama',
    poster: null,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'movie-laugh-track',
    title: 'Laugh Track',
    description:
      'A struggling stand-up comic is accidentally hired as a sitcom writer and has to fake his way through a season.',
    releaseDate: '2024-01-19',
    rating: 6.8,
    categoryId: 'cat-comedy',
    poster: null,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'movie-deep-signal',
    title: 'Deep Signal',
    description:
      'A deep-space listening station picks up a transmission in its own language, sent from the year 1899.',
    releaseDate: '2025-02-07',
    rating: 8.8,
    categoryId: 'cat-scifi',
    poster: null,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'movie-iron-verdict',
    title: 'Iron Verdict',
    description:
      'A burned-out detective takes on a smuggling ring that reaches further into the city than he can afford to look.',
    releaseDate: '2023-04-28',
    rating: 7.1,
    categoryId: 'cat-action',
    poster: null,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'movie-blue-kitchen',
    title: 'Blue Kitchen',
    description:
      'Three line cooks open a restaurant with no menu, no plan, and one very patient landlord.',
    releaseDate: '2022-12-09',
    rating: 7.4,
    categoryId: 'cat-comedy',
    poster: null,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'movie-rivers-of-dust',
    title: 'Rivers of Dust',
    description:
      'A four-part look at the communities rebuilding in the wake of a river that changed course overnight.',
    releaseDate: '2024-09-30',
    rating: 8.9,
    categoryId: 'cat-documentary',
    poster: null,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'movie-quiet-hour',
    title: 'The Quiet Hour',
    description:
      'An overnight hospital shift becomes a slow reckoning between a nurse and the family she has been avoiding.',
    releaseDate: '2025-01-10',
    rating: 7.7,
    categoryId: 'cat-drama',
    poster: null,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
]

export const seedUsers = [
  {
    id: 'user-ariya',
    name: 'Ariya Chai',
    email: 'ariya@movieflix.dev',
    role: 'admin',
    status: 'active',
  },
  {
    id: 'user-miles',
    name: 'Miles Tan',
    email: 'miles@movieflix.dev',
    role: 'editor',
    status: 'active',
  },
  {
    id: 'user-nok',
    name: 'Nok Srisuk',
    email: 'nok@movieflix.dev',
    role: 'viewer',
    status: 'active',
  },
  {
    id: 'user-priya',
    name: 'Priya Raman',
    email: 'priya@movieflix.dev',
    role: 'editor',
    status: 'disabled',
  },
]

export const seedSettings = {
  siteName: 'Movieflix Admin',
  defaultCatalogView: 'grid',
  itemsPerPage: 8,
  showRatings: true,
  showDashboardActivity: true,
}

export const seedActivity = [
  {
    id: 'act-starter-catalog',
    type: 'movie.added',
    message: 'Starter catalog loaded with 10 titles',
    timestamp: seededAt,
  },
  {
    id: 'act-starter-users',
    type: 'user.updated',
    message: 'Team accounts imported from the studio directory',
    timestamp: seededAt,
  },
]

export const seedData = {
  categories: seedCategories,
  movies: seedMovies,
  users: seedUsers,
  settings: seedSettings,
  activity: seedActivity,
}
