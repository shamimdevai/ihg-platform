import { useStaffAuthStore } from '../store/staffAuthStore'
import { hasPermission } from '../utils/permissions'

// Thin hook wrapper over staffAuthStore, mirroring useAppConfig's pattern
// from Phase 1. Not explicitly listed in Phase 2's DELIVERABLE, but is
// listed in §1A's folder skeleton — added since components should consume
// auth state through a hook, not import Zustand directly (flagged to user).
export function useStaffAuth() {
  const accessToken = useStaffAuthStore((s) => s.accessToken)
  const refreshToken = useStaffAuthStore((s) => s.refreshToken)
  const user = useStaffAuthStore((s) => s.user)
  const loading = useStaffAuthStore((s) => s.loading)
  const error = useStaffAuthStore((s) => s.error)
  const login = useStaffAuthStore((s) => s.login)
  const logout = useStaffAuthStore((s) => s.logout)
  const logoutAll = useStaffAuthStore((s) => s.logoutAll)
  const fetchMe = useStaffAuthStore((s) => s.fetchMe)

  return {
    accessToken,
    refreshToken,
    user,
    loading,
    error,
    isAuthenticated: Boolean(accessToken && user),
    login,
    logout,
    logoutAll,
    fetchMe,
    can: (code) => hasPermission(user, code),
  }
}