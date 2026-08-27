import { useAppConfigStore } from '../store/appConfigStore'

// Thin hook wrapper over appConfigStore, per the folder structure's
// intended split (store = state/actions, hooks = the consumption surface
// components actually import from).
export function useAppConfig() {
  const data = useAppConfigStore((state) => state.data)
  const loaded = useAppConfigStore((state) => state.loaded)
  const error = useAppConfigStore((state) => state.error)
  const fetchConfig = useAppConfigStore((state) => state.fetchConfig)
  const isModuleEnabled = useAppConfigStore((state) => state.isModuleEnabled)

  return { data, loaded, error, fetchConfig, isModuleEnabled }
}