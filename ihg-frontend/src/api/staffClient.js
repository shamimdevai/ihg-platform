import axios from 'axios'

// Two separate axios instances exist so staff and customer JWTs can never
// cross (see Global Context Prompt — AUTH section). This is the STAFF-only
// client — never attach a customer token here, and never import this from
// anything under src/features/customer or src/api/customer.
//
// baseURL is a relative path in every environment ('/api/v1') — nginx is
// the single entrypoint in both dev and prod, so there's no absolute host
// to configure and no CORS concern for local dev.
const staffClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// TODO (Phase 2 — Staff Auth): replace this stub with a real read from
// staffAuthStore once that store exists. Keep this interceptor as the
// single place the staff token gets attached — don't duplicate this
// logic anywhere else.
staffClient.interceptors.request.use((config) => {
  const token = null // TODO: read from staffAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default staffClient