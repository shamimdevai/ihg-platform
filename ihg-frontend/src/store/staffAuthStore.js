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

        let tokens
        try {
          tokens = await iamAuthApi.login({ email, password })
        } catch (err) {
          // Credentials/login itself failed — nothing was ever written
          // to the store, so nothing to roll back here.
          set({
            loading: false,
            error:
              err?.response?.data?.message ||
              err?.message ||
              'Login failed.',
          })
          throw err
        }

        // Tokens are valid at this point — persisted immediately.
        // Login itself only returns tokens — role/permissions come
        // from a separate call, GET /iam/auth/me (backlog item 3;
        // confirmed present and mounted on this backend instance —
        // see PROGRESS.md).
        set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token })

        try {
          const user = await iamAuthApi.getMyProfile()
          set({ user, loading: false, error: null })
          return user
        } catch (err) {
          // Backlog item 3 fix: the tokens set just above must NOT be
          // left sitting in localStorage on their own — that's a
          // zombie state (a persisted "valid-looking" session with no
          // `user`, which could confuse isAuthenticated-style checks on
          // a later page load instead of cleanly presenting as
          // "not logged in"). Roll everything back out, and use a
          // message that doesn't read as "wrong password" — the
          // credentials WERE correct; this is a different failure.
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            loading: false,
            error:
              'Signed in, but your staff profile could not be loaded. Please contact an administrator.',
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