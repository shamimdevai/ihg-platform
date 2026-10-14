import axios from 'axios'

// NO-AUTH client for public browsing (rooms, menu, availability).
// Deliberately has no token and no 401-refresh interceptor: a stale
// customer token must never trigger a forced redirect to login on a page
// that is supposed to be public.
const publicClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

export default publicClient