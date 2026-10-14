import { useStaffAuthStore } from './staffAuthStore'
import { useCustomerAuthStore } from './customerAuthStore'
import { redirectToLogin } from '../lib/authRedirect'

/**
 * Cross-tab auth sync. zustand's `persist` middleware writes to
 * localStorage but does NOT, on its own, notify OTHER open tabs when
 * that happens — each tab's store is just an in-memory object seeded
 * from (and written back to) localStorage independently. The browser's
 * native `storage` event is what bridges that: it fires in every OTHER
 * same-origin tab (never the tab that made the write) whenever a
 * localStorage key actually changes. This module listens for that and
 * mirrors the change into THIS tab's own live store, so:
 *
 *   - a refresh-token failure in Tab A (staffClient's/customerClient's
 *     authRefreshInterceptor clearing the store + redirecting) is
 *     reflected in Tab B within one storage event — Tab B's own
 *     `isAuthenticated` flips false, its ProtectedRoute redirects, and
 *     this module additionally routes it to the login page with a
 *     "logged out in another tab" message — deliberately NOT the same
 *     "session expired" wording staffClient.js/customerClient.js use
 *     for a same-tab refresh failure. Tab B genuinely doesn't know
 *     *why* Tab A logged out — expiry vs. an explicit "Log out" click
 *     are different situations and shouldn't be described identically;
 *
 *   - a SUCCESSFUL refresh in Tab A (new token pair written) is also
 *     mirrored into Tab B, so Tab B starts using the fresh token on its
 *     next request instead of independently discovering the old one is
 *     about to expire and running its own redundant refresh.
 *
 * Deliberately NOT applied to impersonationStore — that store persists
 * to sessionStorage, which is already tab-isolated by the browser (the
 * `storage` event never fires across tabs for it), matching its
 * existing "never silently resumes outside this one tab" design (see
 * impersonationStore.js's own doc comment). Nothing to add there.
 */

const STAFF_KEY = 'ihg-staff-auth'
const CUSTOMER_KEY = 'ihg-customer-auth'

function parsePersistedState(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)?.state ?? null
  } catch {
    return null
  }
}

function syncStaffAuth(event) {
  const hadToken = Boolean(useStaffAuthStore.getState().accessToken)
  const nextState = parsePersistedState(event.newValue)

  useStaffAuthStore.setState({
    accessToken: nextState?.accessToken ?? null,
    refreshToken: nextState?.refreshToken ?? null,
    user: nextState?.user ?? null,
  })

  const isNowLoggedOut = !nextState?.accessToken
  if (hadToken && isNowLoggedOut) {
    redirectToLogin('/admin/login', { state: { loggedOutElsewhere: true } })
  }
}

function syncCustomerAuth(event) {
  const hadToken = Boolean(useCustomerAuthStore.getState().accessToken)
  const nextState = parsePersistedState(event.newValue)

  useCustomerAuthStore.setState({
    accessToken: nextState?.accessToken ?? null,
    refreshToken: nextState?.refreshToken ?? null,
    user: nextState?.user ?? null,
  })

  const isNowLoggedOut = !nextState?.accessToken
  if (hadToken && isNowLoggedOut) {
    redirectToLogin('/shop/login', { state: { loggedOutElsewhere: true } })
  }
}

let started = false

/**
 * Idempotent — safe to call more than once (e.g. React StrictMode's
 * double-invoke of effects in dev); only ever attaches the listener
 * once per page load.
 */
export function startCrossTabAuthSync() {
  if (started || typeof window === 'undefined') return
  started = true

  window.addEventListener('storage', (event) => {
    if (event.key === STAFF_KEY) {
      syncStaffAuth(event)
    } else if (event.key === CUSTOMER_KEY) {
      syncCustomerAuth(event)
    }
  })
}