import axios from 'axios'

// Two separate axios instances exist so staff and customer JWTs can never
// cross (see Global Context Prompt — AUTH section). This is the CUSTOMER-
// only client — never attach a staff token here, and never import this
// from anything under src/features/staff or src/api/staff.
//
// baseURL is a relative path in every environment ('/api/v1') — nginx is
// the single entrypoint in both dev and prod, so there's no absolute host
// to configure and no CORS concern for local dev.
const customerClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// TODO (Phase 3 — Customer Auth): replace this stub with a real read from
// customerAuthStore once that store exists. Keep this interceptor as the
// single place the customer token gets attached — don't duplicate this
// logic anywhere else.
customerClient.interceptors.request.use((config) => {
  const token = null // TODO: read from customerAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default customerClient