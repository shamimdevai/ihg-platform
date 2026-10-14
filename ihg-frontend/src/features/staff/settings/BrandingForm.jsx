import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import { useToast } from '@/components/ui/ToastProvider'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as settingsApi from '@/api/staff/settingsApi'

// These 8 keys are the "confirmed real branding fields" the Global
// Context Prompt names as GET /config's payload (company_name,
// logo_url, primary_color, secondary_color, currency, timezone, locale,
// footer_text). ASSUMPTION, flagged rather than silently treated as
// fact: no schema anywhere confirms the underlying settings ROW KEYS
// are literally these exact strings — that's the natural, obvious
// mapping given /config dynamically merges branding with is_public
// settings rows (per Phase 1's own note), but it hasn't been verified
// against a live GET /settings response. If a save 404s or a field
// doesn't round-trip, this mapping is the first thing to check.
const BRANDING_FIELDS = [
  { key: 'company_name', label: 'Company Name', kind: 'text' },
  { key: 'logo_url', label: 'Logo URL', kind: 'text' },
  { key: 'primary_color', label: 'Primary Color', kind: 'color' },
  { key: 'secondary_color', label: 'Secondary Color', kind: 'color' },
  { key: 'currency', label: 'Currency', kind: 'text' },
  { key: 'timezone', label: 'Timezone', kind: 'text' },
  { key: 'locale', label: 'Locale', kind: 'text' },
  { key: 'footer_text', label: 'Footer Text', kind: 'textarea' },
]

const hexColor = z
  .string()
  .refine((v) => v === '' || /^#([0-9A-Fa-f]{6})$/.test(v), {
    message: 'Must be a hex color like #1F3A5F',
  })
  .optional()

const schema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  logo_url: z.string().optional(),
  primary_color: hexColor,
  secondary_color: hexColor,
  currency: z.string().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  footer_text: z.string().optional(),
})

// Manager holds settings:read but NOT settings:write (RBAC_MATRIX v7
// §5.1) — see docs/PROGRESS.md's Phase 25 decision: Manager gets a
// genuine READ-ONLY view of this screen rather than being excluded
// from the route entirely. `readOnly` drives that here: every input is
// disabled and the Save button is hidden, but the underlying data is
// still fully visible since Manager does hold settings:read. Server-
// side, a Manager attempting a write would also 403 regardless of
// anything client-side — this prop only controls the UI affordance.
export default function BrandingForm({ readOnly }) {
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

  // Map of key -> full settings row, so a save can preserve each row's
  // existing value_type/description rather than guessing blind, and so
  // the form can tell a never-set key apart from an explicitly empty one.
  const rowsByKey = useMemo(() => {
    const map = {}
    for (const row of settingsRows || []) {
      map[row.key] = row
    }
    return map
  }, [settingsRows])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: BRANDING_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {}),
  })

  useEffect(() => {
    if (settingsRows) {
      const values = {}
      for (const field of BRANDING_FIELDS) {
        values[field.key] = rowsByKey[field.key]?.value ?? ''
      }
      reset(values)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsRows])

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      // PUT /settings/{key} is a full upsert (see settingsApi.js note)
      // — every field is saved every time, same "don't diff, just send
      // it all" precedent as DepartmentForm (Phase 9), just across 8
      // keys instead of 2. value_type/description are preserved from
      // each existing row when one exists, and default to
      // 'string'/null for a key that's never been set before.
      // is_public is ALWAYS sent as true, explicitly — required so
      // these keys actually surface on GET /config; omitting it would
      // silently default to false per the real schema.
      await Promise.all(
        BRANDING_FIELDS.map((field) => {
          const existing = rowsByKey[field.key]
          return settingsApi.upsertSetting(field.key, {
            value: values[field.key] ?? '',
            value_type: existing?.value_type || 'string',
            description: existing?.description ?? null,
            is_public: true,
          })
        })
      )
    },
    onSuccess: async () => {
      toast({ title: 'Branding updated', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      // Refresh appConfigStore's cached /config data so the theme (and
      // every screen reading useAppConfig()) reflects the new values
      // immediately — no hard reload. fetchConfig() re-fetches /config
      // and replaces appConfigStore.data outright (Phase 1), which is
      // the approach used here rather than a manual local patch.
      await fetchConfig()
    },
    onError: (err) => {
      toast({
        title: 'Could not update branding',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      })
    },
  })

  if (isLoading) return <LoadingState label="Loading branding settings…" />
  if (isError) {
    return (
      <ErrorState
        message={error?.response?.data?.message || error?.message || 'Failed to load settings.'}
        onRetry={refetch}
      />
    )
  }

  return (
    <form
      onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
      className="space-y-4 max-w-xl"
      noValidate
    >
      {readOnly && (
        <p className="text-sm text-muted-foreground bg-muted rounded-md p-3">
          You have read-only access to Settings. Contact an Admin to make changes.
        </p>
      )}

      {BRANDING_FIELDS.map((field) => (
        <div key={field.key} className="space-y-1">
          <Label htmlFor={field.key}>{field.label}</Label>

          {field.kind === 'textarea' && (
            <Textarea id={field.key} disabled={readOnly} {...register(field.key)} />
          )}

          {field.kind === 'color' && (
            <div className="flex items-center gap-2">
              <Input id={field.key} disabled={readOnly} placeholder="#1F3A5F" {...register(field.key)} />
              {/* Live swatch preview — a genuinely dynamic value tied to
                  live form state, so an inline style here is the
                  allowed exception to the "no inline styles" rule. */}
              <span
                className="h-8 w-8 shrink-0 rounded border border-input"
                style={{ backgroundColor: watch(field.key) || 'transparent' }}
              />
            </div>
          )}

          {field.kind === 'text' && (
            <Input id={field.key} disabled={readOnly} {...register(field.key)} />
          )}

          {errors[field.key] && <p className="text-sm text-destructive">{errors[field.key].message}</p>}
        </div>
      ))}

      {!readOnly && (
        <div className="flex justify-end pt-2">
          <Button type="submit" loading={saveMutation.isPending} disabled={!isDirty}>
            Save Changes
          </Button>
        </div>
      )}
    </form>
  )
}