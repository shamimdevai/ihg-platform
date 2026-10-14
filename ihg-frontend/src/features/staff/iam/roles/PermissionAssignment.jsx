import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import { useToast } from '@/components/ui/ToastProvider'
import { listPermissions } from '@/api/staff/iamPermissionsApi'
import { assignPermissions, removePermission } from '@/api/staff/iamRolesApi'
import { isProtectedRole } from '@/features/staff/iam/roles/RolesList'

// Groups the REAL permission catalog by domain (the segment before the
// first ':') so the checkbox list mirrors RBAC_MATRIX.md §2's structure
// instead of one long flat list. Nothing here is a hardcoded/guessed
// permission set — every row comes from GET /iam/permissions. The lone
// `*` code has no domain segment and is grouped separately, first, with
// an explicit warning since granting it makes a role platform-wide.
function groupByDomain(permissions) {
  const wildcard = []
  const byDomain = {}
  for (const p of permissions) {
    if (p.code === '*') {
      wildcard.push(p)
      continue
    }
    const domain = p.code.split(':')[0]
    if (!byDomain[domain]) byDomain[domain] = []
    byDomain[domain].push(p)
  }
  return { wildcard, domains: Object.keys(byDomain).sort(), byDomain }
}

export default function PermissionAssignment({ role, onClose }) {
  const protectedRole = isProtectedRole(role)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const {
    data: allPermissions,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['iam-permissions'],
    queryFn: listPermissions,
    enabled: !protectedRole,
  })

  const initialIds = useMemo(
    () => new Set((role.permissions || []).map((p) => p.id)),
    [role]
  )
  const [selectedIds, setSelectedIds] = useState(initialIds)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const added = [...selectedIds].filter((id) => !initialIds.has(id))
      const removed = [...initialIds].filter((id) => !selectedIds.has(id))
      // Diffed and sent as two kinds of calls rather than assumed to be
      // a bulk replace — see the assign-semantics note in chat.
      if (added.length > 0) {
        await assignPermissions(role.id, added)
      }
      await Promise.all(removed.map((id) => removePermission(role.id, id)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-roles'] })
      toast({ title: 'Permissions updated', variant: 'success' })
      onClose?.()
    },
    onError: (err) => {
      toast({
        title: 'Something went wrong',
        description: err?.response?.data?.message || 'Could not update permissions.',
        variant: 'destructive',
      })
    },
  })

  // Second line of defense — RolesList already hides/disables the
  // button that opens this component for a protected role, but this
  // guards against it being reached any other way.
  if (protectedRole) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <strong>{role.name}</strong> holds the platform-wide{' '}
          <code className="font-mono">*</code> wildcard and is protected from
          permission changes in this UI, to prevent accidentally locking
          everyone — including yourself — out of the platform. See
          RBAC_MATRIX.md §3.2/§9.
        </p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) return <LoadingState label="Loading permission catalog…" />
  if (error) {
    return (
      <ErrorState
        message={error?.response?.data?.message || 'Failed to load permissions.'}
        onRetry={refetch}
      />
    )
  }

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const { wildcard, domains, byDomain } = groupByDomain(allPermissions || [])

  return (
    <div className="space-y-4">
      <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-5">
        {wildcard.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
            <p className="text-xs text-amber-800 mb-2">
              Platform-wide — grants EVERY permission, for every domain, present
              and future. Grant with the same care as the Admin role
              (RBAC_MATRIX §11).
            </p>
            {wildcard.map((p) => (
              <PermissionRow
                key={p.id}
                permission={p}
                checked={selectedIds.has(p.id)}
                onToggle={toggle}
              />
            ))}
          </div>
        )}

        {domains.map((domain) => (
          <div key={domain}>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              {domain}
            </h4>
            <div className="space-y-2">
              {byDomain[domain].map((p) => (
                <PermissionRow
                  key={p.id}
                  permission={p}
                  checked={selectedIds.has(p.id)}
                  onToggle={toggle}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
          Cancel
        </Button>
        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
          Save changes
        </Button>
      </div>
    </div>
  )
}

function PermissionRow({ permission, checked, onToggle }) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={`perm-${permission.id}`}
        checked={checked}
        onCheckedChange={() => onToggle(permission.id)}
        className="mt-0.5"
      />
      <Label htmlFor={`perm-${permission.id}`} className="font-normal cursor-pointer">
        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
          {permission.code}
        </span>
        {permission.description && (
          <span className="block text-xs text-muted-foreground mt-0.5">
            {permission.description}
          </span>
        )}
      </Label>
    </div>
  )
}