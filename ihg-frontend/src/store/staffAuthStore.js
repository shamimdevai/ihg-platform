import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as iamAuthApi from '../api/staff/iamAuthApi'

// Staff-only auth store — never share state or logic with
// customerAuthStore (see Global Context Prompt, AUTH section).
// Persisted to localStorage (key below) so a page refresh doesn't log
// the user out — this is a real deployed app, not a sandboxed artifact.
export const useStaffAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null, // real shape: GET /iam/auth/me's response
      loading: false,
      error: null,

      login: async (email, password) => {
        set({ loading: true, error: null })
        try {
          const tokens = await iamAuthApi.login({ email, password })
          set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          })
          // Login itself only returns tokens — role/permissions come
          // from a separate call (see brief's flagged gap/patch note).
          const user = await iamAuthApi.getMyProfile()
          set({ user, loading: false, error: null })
          return user
        } catch (err) {
          set({
            loading: false,
            error:
              err?.response?.data?.message ||
              err?.message ||
              'Login failed.',
          })
          throw err
        }
      },

      fetchMe: async () => {
        const user = await iamAuthApi.getMyProfile()
        set({ user })
        return user
      },

      logout: async () => {
        const { refreshToken } = get()
        try {
          if (refreshToken) {
            await iamAuthApi.logout({ refreshToken })
          }
        } finally {
          // Clear local state regardless of whether the API call
          // succeeded — a failed logout call shouldn't leave the user
          // stuck "logged in" client-side.
          set({ accessToken: null, refreshToken: null, user: null })
        }
      },

      logoutAll: async () => {
        try {
          await iamAuthApi.logoutAll()
        } finally {
          set({ accessToken: null, refreshToken: null, user: null })
        }
      },
    }),
    {
      name: 'ihg-staff-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
)