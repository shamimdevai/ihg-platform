import axios from 'axios'
import { useStaffAuthStore } from '../store/staffAuthStore'
import { useImpersonationStore } from '../store/impersonationStore'
import * as iamAuthApi from './staff/iamAuthApi'
import { attachAuthRefreshInterceptor } from './authRefreshInterceptor'
import { redirectToLogin } from '../lib/authRedirect'

// KNOWN MAINTENANCE CONCERN, left as-is (confirmed acceptable): this
// creates a circular import with ./staff/iamAuthApi.js, which itself
// imports this file's default export. Safe today because neither
// module calls the other at module-evaluation time — only inside
// function bodies invoked later, well after both modules have finished
// loading (iamAuthApi.refresh() is only ever called from inside the
// interceptor's response-error handler, on an actual 401). If either
// file's top-level code ever changes to call the other synchronously
// at module scope, this would break. Not fixed here per explicit
// instruction — flagging for whoever touches either file next.

// STAFF-only client — never attach a customer token here (see Global
// Context Prompt, AUTH section). baseURL is relative in every
// environment; nginx is the single entrypoint (see Phase 0).
const staffClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Phase 9: while a Superadmin is actively impersonating, every request
// this client makes must carry the IMPERSONATION token, not the
// superadmin's own — otherwise every screen would visually claim to be
// "impersonating" while every actual API call (and therefore every
// audit_log row, per RBAC_MATRIX §7) still ran as the superadmin. Falls
// back to the real staff token exactly as before when not impersonating
// — no change to existing behavior in that case.
staffClient.interceptors.request.use((config) => {
  const impersonation = useImpersonationStore.getState()
  const token =
    impersonation.active && impersonation.accessToken
      ? impersonation.accessToken
      : useStaffAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Backlog item 1: 401 → refresh → retry-once. Impersonation-aware —
// mirrors the request interceptor's own "impersonation token if active,
// else the real staff token" selection, so whichever pair is actually
// in use is the pair that gets refreshed.
attachAuthRefreshInterceptor(staffClient, {
  getAccessToken: () => {
    const impersonation = useImpersonationStore.getState()
    return impersonation.active && impersonation.accessToken
      ? impersonation.accessToken
      : useStaffAuthStore.getState().accessToken
  },
  getRefreshToken: () => {
    const impersonation = useImpersonationStore.getState()
    return impersonation.active && impersonation.refreshToken
      ? impersonation.refreshToken
      : useStaffAuthStore.getState().refreshToken
  },
  doRefresh: (refreshToken) => iamAuthApi.refresh({ refreshToken }),
  onRefreshed: (tokens) => {
    const impersonation = useImpersonationStore.getState()
    if (impersonation.active) {
      useImpersonationStore.setState({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      })
    } else {
      useStaffAuthStore.setState({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      })
    }
  },
  onRefreshFailed: () => {
    const impersonation = useImpersonationStore.getState()
    if (impersonation.active) {
      // Confirmed decision: end impersonation only, fall back to the
      // real staff session — NOT a full logout. The real session's own
      // token pair is untouched and still valid, so no redirect here;
      // the superadmin simply continues as themselves on the next
      // request/re-render (ImpersonationBanner disappears accordingly).
      useImpersonationStore.getState().stop()
    } else {
      useStaffAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
      redirectToLogin('/admin/login', { state: { sessionExpired: true } })
    }
  },
  // These carry no meaningful bearer token / a 401 here means bad
  // credentials or an invalid one-time token, never "session expired."
  excludedUrls: [
    '/iam/auth/login',
    '/iam/auth/refresh',
    '/iam/auth/forgot-password',
    '/iam/auth/reset-password',
    '/iam/auth/accept-invite',
  ],
})

export default staffClient