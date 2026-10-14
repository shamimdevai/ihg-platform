import { useCustomerAuthStore } from '../store/customerAuthStore'

export function useCustomerAuth() {
  const accessToken = useCustomerAuthStore((s) => s.accessToken)
  const refreshToken = useCustomerAuthStore((s) => s.refreshToken)
  const user = useCustomerAuthStore((s) => s.user)
  const loading = useCustomerAuthStore((s) => s.loading)
  const error = useCustomerAuthStore((s) => s.error)
  const login = useCustomerAuthStore((s) => s.login)
  const logout = useCustomerAuthStore((s) => s.logout)
  const fetchProfile = useCustomerAuthStore((s) => s.fetchProfile)

  return {
    accessToken,
    refreshToken,
    user,
    loading,
    error,
    // Deliberately based on token presence only, NOT `user` — a
    // profile-fetch failure (backlog item 2's non-blocking decision)
    // must never flip this false; the customer is genuinely
    // authenticated as far as the API is concerned regardless of
    // whether `user` has loaded yet.
    isAuthenticated: Boolean(accessToken),
    login,
    logout,
    fetchProfile,
  }
}