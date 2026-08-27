import { useCustomerAuthStore } from '../store/customerAuthStore'

export function useCustomerAuth() {
  const accessToken = useCustomerAuthStore((s) => s.accessToken)
  const refreshToken = useCustomerAuthStore((s) => s.refreshToken)
  const user = useCustomerAuthStore((s) => s.user)
  const loading = useCustomerAuthStore((s) => s.loading)
  const error = useCustomerAuthStore((s) => s.error)
  const login = useCustomerAuthStore((s) => s.login)
  const logout = useCustomerAuthStore((s) => s.logout)

  return {
    accessToken,
    refreshToken,
    user,
    loading,
    error,
    // Deliberately based on token presence only, NOT `user` — user stays
    // null until Phase 29, but the customer is genuinely authenticated
    // as far as the API is concerned.
    isAuthenticated: Boolean(accessToken),
    login,
    logout,
  }
}