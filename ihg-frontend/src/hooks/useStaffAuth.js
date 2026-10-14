import { useStaffAuthStore } from '../store/staffAuthStore'
import { useImpersonationStore } from '../store/impersonationStore'
import { hasPermission } from '../utils/permissions'

// Thin hook wrapper over staffAuthStore, mirroring useAppConfig's pattern
// from Phase 1. Not explicitly listed in Phase 2's DELIVERABLE, but is
// listed in §1A's folder skeleton — added since components should consume
// auth state through a hook, not import Zustand directly (flagged to user).
//
// Phase 9: while a Superadmin is actively impersonating, `user` (and
// therefore `can()`, and every usePermission() call built on this hook)
// must resolve to the IMPERSONATED identity's real role/permissions —
// not the superadmin's own "*" wildcard — or the entire point of
// impersonation (seeing exactly what that staff member sees) is
// defeated. `realUser` is exposed separately so ImpersonationBanner and
// route/page-level superadmin checks can still see who's really logged
// in regardless of who's being impersonated.
export function useStaffAuth() {
  const accessToken = useStaffAuthStore((s) => s.accessToken)
  const refreshToken = useStaffAuthStore((s) => s.refreshToken)
  const realUser = useStaffAuthStore((s) => s.user)
  const loading = useStaffAuthStore((s) => s.loading)
  const error = useStaffAuthStore((s) => s.error)
  const login = useStaffAuthStore((s) => s.login)
  const logout = useStaffAuthStore((s) => s.logout)
  const logoutAll = useStaffAuthStore((s) => s.logoutAll)
  const fetchRealMe = useStaffAuthStore((s) => s.fetchMe)

  const isImpersonating = useImpersonationStore((s) => s.active)
  const impersonatedUser = useImpersonationStore((s) => s.impersonatedUser)
  const refreshImpersonatedProfile = useImpersonationStore((s) => s.refreshImpersonatedProfile)
  const user = isImpersonating && impersonatedUser ? impersonatedUser : realUser

  // Backlog item 4 fix: refreshes whichever identity is currently
  // EFFECTIVE (matches how `user` itself is resolved just above), not
  // always the real staff account. Previously always called
  // fetchRealMe() — which, while impersonating, refreshed data that
  // `user`/`can()` don't even read, making a "refresh my permissions"
  // action silently do nothing visible. Callers (usePermissionsRefresh)
  // don't need to know which branch ran — they just get back whichever
  // user object `user` would now resolve to.
  const fetchMe = async () => {
    if (isImpersonating) {
      return refreshImpersonatedProfile()
    }
    return fetchRealMe()
  }

  return {
    accessToken,
    refreshToken,
    user,
    realUser,
    isImpersonating,
    loading,
    error,
    // Auth state is about whether a REAL staff session exists —
    // deliberately checks realUser, not the impersonated one.
    isAuthenticated: Boolean(accessToken && realUser),
    login,
    logout,
    logoutAll,
    fetchMe,
    can: (code) => hasPermission(user, code),
  }
}