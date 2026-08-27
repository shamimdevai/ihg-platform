import { create } from 'zustand'
import { fetchPublicConfig } from '../api/configApi'

// GET /config is a dynamic merge (branding + whatever settings rows are
// currently is_public: true) — there is no fixed schema. We deliberately
// spread the whole response into `data` rather than destructuring named
// keys, so new public settings (e.g. module-enabled flags, once Phase 25
// creates them) show up automatically with zero code changes here.
//
// OPEN QUESTION (see docs/PROGRESS.md): the real settings-key naming
// convention for module toggles (e.g. `hotel_module_enabled` vs
// `modules.hotel` vs something else) is not yet confirmed — no such rows
// exist on this backend yet. isModuleEnabled() below assumes the
// `${module}_module_enabled` convention as a working guess; confirm with
// the backend owner before Phase 25 builds the toggle UI, and update this
// function's key-lookup if the real convention differs.
export const useAppConfigStore = create((set, get) => ({
  data: {},
  loaded: false,
  error: null,

  fetchConfig: async () => {
    set({ loaded: false, error: null })
    try {
      const data = await fetchPublicConfig()
      set({ data, loaded: true, error: null })
    } catch (err) {
      set({
        loaded: false,
        error: err?.message || 'Failed to load application configuration.',
      })
    }
  },

  /**
   * Defaults to TRUE when a module's setting key doesn't exist yet.
   * This is deliberate, not an oversight: no module-toggle settings rows
   * exist on the backend today, so defaulting to hidden would make every
   * business-line module vanish from nav until Phase 25 ships — breaking
   * every phase in between (13–22) that assumes its own module is visible.
   * Once Phase 25 creates real rows, an explicit `false` will correctly
   * hide a disabled module; only the *absence* of the key defaults open.
   */
  isModuleEnabled: (moduleName) => {
    const { data } = get()
    const key = `${moduleName}_module_enabled`
    if (!(key in data)) return true
    return Boolean(data[key])
  },
}))