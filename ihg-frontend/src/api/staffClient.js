import axios from 'axios'
import { useStaffAuthStore } from '../store/staffAuthStore'

// STAFF-only client — never attach a customer token here (see Global
// Context Prompt, AUTH section). baseURL is relative in every
// environment; nginx is the single entrypoint (see Phase 0).
const staffClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Reads the live token from staffAuthStore on every request rather than
// closing over a stale value — Phase 0 left this as a TODO stub pending
// the real store, which now exists.
staffClient.interceptors.request.use((config) => {
  const token = useStaffAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default staffClient