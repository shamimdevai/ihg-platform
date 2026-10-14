import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useStaffAuthStore } from './staffAuthStore'
import * as iamImpersonationApi from '../api/staff/iamImpersonationApi'

// Deliberately its OWN store, never merged into staffAuthStore —
// staffAuthStore's persisted accessToken/refreshToken/user always
// represent the REAL logged-in staff account; this store layers an
// optional impersonation session on top without ever overwriting that.
//
// Storage choice matters for the acceptance checklist ("doesn't
// silently persist past logout or across browser sessions"):
// sessionStorage survives a same-tab page refresh (so the banner
// correctly reappears after a reload mid-impersonation) but is cleared
// the instant the browser/tab is closed — so an impersonation session
// can never silently resume in a fresh browser session the way a real
// (localStorage-persisted) login would. Explicit "Stop impersonating"
// or closing the tab are the only two ways this ever ends.
export const useImpersonationStore = create(
  persist(
    (set, get) => ({
      active: false,
      targetType: null,
      targetId: null,
      accessToken: null,
      refreshToken: null,
      impersonatedUser: null, // GET /iam/auth/me's response, under the impersonation token

      start: async ({ targetType, targetId }) => {
        const { user: realUser, accessToken: realAccessToken } = useStaffAuthStore.getState()

        // Belt-and-suspenders — the UI (ImpersonationPage) already
        // hides/blocks this for non-Superadmins, but the store itself
        // never trusts the caller.
        if (!realUser?.is_superadmin) {
          throw new Error('Only Superadmin accounts can impersonate.')
        }

        const tokens = await iamImpersonationApi.impersonate({
          staffId: realUser.id,
          targetType,
          targetId,
          accessToken: realAccessToken,
        })

        const impersonatedUser = await iamImpersonationApi.getImpersonatedProfile(
          tokens.access_token
        )

        set({
          active: true,
          targetType,
          targetId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          impersonatedUser,
        })
      },

      // Backlog item 4 fix: re-fetches the IMPERSONATED identity's own
      // profile/role/permissions — reuses the exact same call `start()`
      // makes on entry. Added so useStaffAuth.js's fetchMe() can stay
      // impersonation-aware (refresh whichever identity is currently
      // effective), matching the same "active pair, not always the
      // real one" pattern staffClient.js's interceptors already use.
      // No-ops (returns null) if not currently impersonating — callers
      // are expected to check `active` first, same as elsewhere in this
      // store.
      refreshImpersonatedProfile: async () => {
        const { active, accessToken } = get()
        if (!active || !accessToken) return null
        const impersonatedUser = await iamImpersonationApi.getImpersonatedProfile(accessToken)
        set({ impersonatedUser })
        return impersonatedUser
      },

      stop: () => {
        set({
          active: false,
          targetType: null,
          targetId: null,
          accessToken: null,
          refreshToken: null,
          impersonatedUser: null,
        })
      },
    }),
    {
      name: 'ihg-staff-impersonation',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)