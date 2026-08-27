import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as authApi from '../api/customer/authApi'

// Customer-only auth store — completely separate from staffAuthStore,
// separate localStorage key, never shares logic (see Global Context
// Prompt, AUTH section). Customers carry no permissions/role at all —
// this store is deliberately much simpler than staffAuthStore's.
//
// NOTE: `user` stays null after login — this tag has no "me" endpoint
// (unlike staff's patched /iam/auth/me). It's only populated by an
// explicit fetchProfile() call once Phase 29 builds GET /customers
// (customer-profile tag). Consumers must handle user === null gracefully
// even while isAuthenticated is true.
export const useCustomerAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      loading: false,
      error: null,

      login: async (email, password) => {
        set({ loading: true, error: null })
        try {
          const tokens = await authApi.login({ email, password })
          set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            loading: false,
            error: null,
          })
        } catch (err) {
          set({
            loading: false,
            error:
              err?.response?.data?.message || err?.message || 'Login failed.',
          })
          throw err
        }
      },

      logout: async () => {
        const { refreshToken } = get()
        try {
          if (refreshToken) {
            await authApi.logout({ refreshToken })
          }
        } finally {
          set({ accessToken: null, refreshToken: null, user: null })
        }
      },
    }),
    {
      name: 'ihg-customer-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
)