/**
 * Shared 401 → refresh-token → retry-once logic, attached to BOTH
 * staffClient and customerClient (backlog item 1: "build once, share
 * the retry/queue logic between both clients rather than duplicating
 * it"). Each caller supplies small store-specific callbacks; this file
 * has no knowledge of staffAuthStore/customerAuthStore/impersonation
 * itself.
 *
 * Behavior:
 * - A 401 from an excluded URL (login, refresh, register, forgot/reset-
 *   password, etc.) is NEVER treated as "session expired" — those
 *   endpoints carry no meaningful bearer token, and a 401 from them
 *   means "wrong credentials/invalid token," not "your session's
 *   access token expired mid-use."
 * - A 401 with no token currently in the relevant store at all is also
 *   passed through untouched — nobody is logged in, so this isn't a
 *   stale-session case.
 * - Otherwise: the FIRST 401 triggers exactly one refresh call; any
 *   other requests that 401 while that refresh is still in flight queue
 *   behind it (the "stampede guard") rather than firing their own
 *   refresh calls. Once the refresh resolves, the original request and
 *   everything queued behind it are retried once each (marked so they
 *   can't loop forever if one of them 401s again).
 * - Refresh failure calls `onRefreshFailed()` — what that does (full
 *   logout + redirect vs. something narrower) is entirely up to the
 *   caller; see staffClient.js's impersonation-aware version.
 */
export function attachAuthRefreshInterceptor(
  client,
  { getAccessToken, getRefreshToken, doRefresh, onRefreshed, onRefreshFailed, excludedUrls = [] }
) {
  let isRefreshing = false
  let refreshPromise = null
  let queue = [] // { resolve, reject, config }

  const isExcluded = (url = '') => excludedUrls.some((suffix) => url.includes(suffix))

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const { config, response } = error

      if (!response || response.status !== 401 || !config) {
        return Promise.reject(error)
      }
      if (isExcluded(config.url)) {
        return Promise.reject(error)
      }
      if (!getAccessToken()) {
        return Promise.reject(error)
      }
      if (config._retry) {
        // Already retried once after a successful refresh and STILL
        // 401'd — a hard failure, not another refresh opportunity.
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject, config })
        })
      }

      config._retry = true
      isRefreshing = true
      const refreshToken = getRefreshToken()

      refreshPromise = (async () => {
        if (!refreshToken) throw new Error('No refresh token available.')
        const tokens = await doRefresh(refreshToken)
        onRefreshed(tokens)
        return tokens
      })()

      try {
        await refreshPromise

        // Retry everything that queued up behind this refresh. Each is
        // resent through the SAME client instance, so it picks up the
        // just-updated token via that client's own request interceptor
        // — no manual header patching needed here.
        const queued = queue
        queue = []
        queued.forEach(({ resolve, reject, config: queuedConfig }) => {
          queuedConfig._retry = true
          client(queuedConfig).then(resolve).catch(reject)
        })

        return client(config)
      } catch (refreshErr) {
        const queued = queue
        queue = []
        queued.forEach(({ reject }) => reject(error))
        onRefreshFailed()
        return Promise.reject(error)
      } finally {
        isRefreshing = false
        refreshPromise = null
      }
    }
  )
}