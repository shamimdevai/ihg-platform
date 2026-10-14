// Tiny router-aware redirect registry. Axios interceptors (in
// staffClient.js/customerClient.js) run completely outside React
// Router's context — there's no `navigate()` available there — so
// App.jsx registers its real `navigate` function here once, on mount,
// and the auth-refresh interceptor calls `redirectToLogin()` instead of
// reaching for `window.location`. Keeps a forced session-expiry logout
// an in-SPA navigation (no full page reload, no lost app state outside
// the page that 401'd) rather than a hard redirect.
let navigateFn = null

export function registerAuthRedirect(navigate) {
  navigateFn = navigate
}

export function redirectToLogin(path, options = {}) {
  if (navigateFn) {
    navigateFn(path, { replace: true, ...options })
  } else {
    // Extremely unlikely — would mean a 401 fired before App.jsx ever
    // mounted. Falls back to a hard redirect rather than silently doing
    // nothing, so a forced logout can never be a no-op.
    window.location.href = path
  }
}