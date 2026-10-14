import { useCallback, useEffect, useRef } from 'react'
import { useStaffAuth } from './useStaffAuth'
import { useToast } from '@/components/ui/ToastProvider'

// Per explicit decision. >>Initially 5 min selected
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000

// Stable signature of everything that affects hasPermission()/nav-
// gating for a given user — used to detect whether a refresh actually
// CHANGED anything, not just whether the network call succeeded.
// Covers: the superadmin flag (bypasses RBAC entirely), which role the
// person holds (a ROLE REASSIGNMENT, not just an edit to the same
// role's grants), and the sorted set of that role's permission codes
// (an edit to the current role's grants).
function permissionsSignature(user) {
  if (!user) return ''
  const codes = (user.role?.permissions || []).map((p) => p.code).sort()
  return [user.is_superadmin ? '1' : '0', user.role?.id || '', codes.join(',')].join('|')
}

/**
 * Backlog item 4: keeps hasPermission()/nav-gating fresh without
 * requiring a re-login. Two mechanisms, both funneling through
 * useStaffAuth().fetchMe() (impersonation-aware — see useStaffAuth.js):
 *
 *   - automatic: silently re-fetches every 5 minutes while
 *     authenticated. Only shows a toast if something actually CHANGED —
 *     a "nothing changed" toast every 5 minutes would be pure noise;
 *   - manual: `refreshPermissions()` returned here, for a person-
 *     triggered button (StaffLayout.jsx). ALWAYS shows a toast, either
 *     confirming no change or announcing one, per explicit decision —
 *     the person asked, so they get a direct answer either way.
 *
 * Mount this once, high in the authenticated tree (StaffLayout.jsx) —
 * calling it more than once would start multiple independent 5-minute
 * timers.
 */
export function usePermissionsRefresh() {
  const { user, isAuthenticated, fetchMe } = useStaffAuth()
  const { toast } = useToast()
  // Ref, not state — read/written inside a callback and an interval
  // effect; never needs to itself trigger a re-render.
  const lastSignatureRef = useRef(permissionsSignature(user))

  useEffect(() => {
    lastSignatureRef.current = permissionsSignature(user)
  }, [user])

  const refreshPermissions = useCallback(
    async ({ silent = false } = {}) => {
      const before = lastSignatureRef.current
      try {
        const refreshedUser = await fetchMe()
        const after = permissionsSignature(refreshedUser)
        const changed = before !== after

        if (changed) {
          toast({ title: 'Your permissions have been updated.', variant: 'success' })
        } else if (!silent) {
          toast({ title: 'Permissions refreshed successfully.' })
        }
        return changed
      } catch (err) {
        if (!silent) {
          toast({
            title: 'Could not refresh permissions.',
            description: 'Please try again.',
            variant: 'destructive',
          })
        }
        return false
      }
    },
    [fetchMe, toast]
  )

  useEffect(() => {
    if (!isAuthenticated) return
    const id = setInterval(() => {
      refreshPermissions({ silent: true })
    }, AUTO_REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isAuthenticated, refreshPermissions])

  return { refreshPermissions }
}