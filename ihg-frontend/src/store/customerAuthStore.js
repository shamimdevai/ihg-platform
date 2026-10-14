import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as authApi from '../api/customer/authApi'
import * as profileApi from '../api/customer/profileApi'

// Customer-only auth store — completely separate from staffAuthStore,
// separate localStorage key, never shares logic (see Global Context
// Prompt, AUTH section). Customers carry no permissions/role at all —
// this store is deliberately much simpler than staffAuthStore's.
//
// Backlog item 2, RESOLVED: `user` is now populated via a profile fetch
// triggered from login() — but NON-BLOCKING, by explicit decision. This
// deliberately differs from staffAuthStore's login(), where a failed
// GET /iam/auth/me fails the entire login. Two reasons that pattern was
// NOT mirrored here: (1) GET /customers/me's own path is itself a
// flagged, unconfirmed conflict against RBAC_MATRIX (backlog item 12,
// documented in profileApi.js) — a secondary enrichment call must never
// be able to take down the primary login flow over that; (2) tokens are
// the real credential, profile is display-only enrichment. So: tokens
// saved + login considered successful the moment authApi.login()
// resolves; `fetchProfile()` is attempted afterward and swallows its
// own failure — `user` simply stays null, exactly as it did before this
// change, and every consumer must still handle that gracefully (now, as
// before).
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

        // Deliberately OUTSIDE the try/catch above and awaited AFTER
        // login is already considered successful — fetchProfile() never
        // throws (see below), so awaiting it here just means login()
        // resolves once the first attempt has settled, without any risk
        // of undoing the success already set above.
        await get().fetchProfile()
      },

      // Mirrors staffAuthStore's fetchMe() naming/shape. Called from
      // login() above, AND from CustomerLayout.jsx on every mount while
      // `user` is still null (the "retry on next authenticated page
      // load" behavior), AND from a manual retry control in
      // CustomerLayout's header. Never throws — a failure here should
      // never be able to surface as an uncaught rejection to whichever
      // of those three callers triggered it; `user` simply stays/
      // remains null and the next trigger (mount or manual click) tries
      // again.
      fetchProfile: async () => {
        try {
          const user = await profileApi.getMyProfile()
          set({ user })
          return user
        } catch (err) {
          return null
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