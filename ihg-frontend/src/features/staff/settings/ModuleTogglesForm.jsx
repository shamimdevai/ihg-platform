import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/Label'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import { useToast } from '@/components/ui/ToastProvider'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as settingsApi from '@/api/staff/settingsApi'

// Only hotel/restaurant/delivery are ever module-gated (RBAC_MATRIX v7
// §7 confirms settings/iam/customers/inventory/payments/reporting never
// are) — these three are the only real toggle keys this screen manages,
// matching the `${module}_module_enabled` convention appConfigStore
// (Phase 1) already assumes.
const MODULES = [
  { key: 'hotel_module_enabled', label: 'Hotel' },
  { key: 'restaurant_module_enabled', label: 'Restaurant' },
  { key: 'delivery_module_enabled', label: 'Delivery' },
]

// No shared Switch/Toggle component exists in components/ui/ yet —
// using the existing Checkbox primitive for on/off state (same
// checked/onCheckedChange controlled pattern used throughout this
// codebase, e.g. RoomForm.jsx's is_active) rather than adding a new
// shared UI component speculatively without approval. Flagged, not a
// silent addition.
//
// Manager holds settings:read but NOT settings:write (RBAC_MATRIX v7
// §5.1) — see docs/PROGRESS.md's Phase 25 decision. `readOnly` disables
// every checkbox here; the underlying values are still fully visible.
export default function ModuleTogglesForm({ readOnly }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { fetchConfig } = useAppConfig()

  const {
    data: settingsRows,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.listSettings,
  })

  const rowsByKey = useMemo(() => {
    const map = {}
    for (const row of settingsRows || []) {
      map[row.key] = row
    }
    return map
  }, [settingsRows])

  const toggleMutation = useMutation({
    mutationFn: ({ key, nextValue, existing }) =>
      settingsApi.upsertSetting(key, {
        value: nextValue,
        value_type: existing?.value_type || 'bool',
        description:
          existing?.description ?? `Enable or disable the ${key.replace('_module_enabled', '')} module.`,
        // ALWAYS true, explicit — this is a full upsert (see
        // settingsApi.js); omitting is_public would silently default
        // to false and the toggle would vanish from GET /config,
        // breaking appConfigStore.isModuleEnabled() for every role.
        is_public: true,
      }),
    onSuccess: async (_data, variables) => {
      const label = MODULES.find((m) => m.key === variables.key)?.label
      toast({
        title: `${label} module ${variables.nextValue ? 'enabled' : 'disabled'}`,
        variant: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      // Re-fetch /config so appConfigStore.isModuleEnabled() — and
      // therefore StaffLayout/navConfig's nav-section gating (Phase 5)
      // — updates live in this same session, not just on next reload.
      await fetchConfig()
    },
    onError: (err) => {
      toast({
        title: 'Could not update module setting',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
    },
  })

  if (isLoading) return <LoadingState label="Loading module settings…" />
  if (isError) {
    return (
      <ErrorState
        message={error?.response?.data?.message || error?.message || 'Failed to load settings.'}
        onRetry={refetch}
      />
    )
  }

  return (
    <div className="space-y-4 max-w-xl">
      {readOnly && (
        <p className="text-sm text-muted-foreground bg-muted rounded-md p-3">
          You have read-only access to Settings. Contact an Admin to make changes.
        </p>
      )}

      {MODULES.map((mod) => {
        const existing = rowsByKey[mod.key]
        // Defaults to TRUE when the row doesn't exist yet — mirrors
        // appConfigStore.isModuleEnabled()'s own pre-seed default
        // exactly (Phase 1), so this screen's initial toggle state
        // never contradicts what the rest of the app already treats
        // as "enabled."
        const currentValue = existing ? Boolean(existing.value) : true

        return (
          <div key={mod.key} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor={mod.key}>{mod.label}</Label>
              {!existing && (
                <p className="text-xs text-muted-foreground">
                  Not yet configured — currently enabled by default.
                </p>
              )}
            </div>
            <Checkbox
              id={mod.key}
              checked={currentValue}
              disabled={readOnly || toggleMutation.isPending}
              onCheckedChange={(checked) =>
                toggleMutation.mutate({ key: mod.key, nextValue: Boolean(checked), existing })
              }
            />
          </div>
        )
      })}
    </div>
  )
}