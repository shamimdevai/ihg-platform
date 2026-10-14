import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import Table from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import { listRoles, deleteRole } from '@/api/staff/iamRolesApi'

// A role holding the platform "*" wildcard (Admin, by default —
// RBAC_MATRIX §3.2 — but any custom role could theoretically be granted
// it too, §11) is protected from edit/permission-assignment/delete in
// this UI, so a user can never accidentally strip the platform's own
// super-role and lock everyone (including themselves) out. Read-only
// viewing is still allowed. Exported so PermissionAssignment.jsx can
// apply the same check as a second line of defense. The backend now
// enforces this same rule independently for delete specifically (see
// iamRolesApi.js's deleteRole) — this client-side check is the first,
// friendlier line of defense (disabled button + tooltip, no round trip
// needed to find out), not the only one.
export function isProtectedRole(role) {
  return (role?.permissions || []).some((p) => p.code === '*')
}

export default function RolesList({ onEdit, onManagePermissions }) {
  // Write actions are gated by iam:roles:write (Admin-only, confirmed —
  // see chat note on the Manager-visibility reconciliation). The route
  // itself stays gated by iam:roles:read, which Manager also holds.
  const canWrite = usePermission('iam:roles:write')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [roleToDelete, setRoleToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const {
    data: roles,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['iam-roles'],
    queryFn: listRoles,
  })

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return
    setDeleting(true)
    try {
      await deleteRole(roleToDelete.id)
      toast({ title: `"${roleToDelete.name}" was deleted.` })
      queryClient.invalidateQueries({ queryKey: ['iam-roles'] })
      setRoleToDelete(null)
    } catch (err) {
      // The backend's 409 message is specific and actionable ("still
      // assigned to N staff member(s)..." or the wildcard block) — shown
      // verbatim rather than a generic failure toast, so the person
      // knows exactly what to fix before trying again.
      toast({
        title: 'Could not delete role',
        description: err?.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      })
      setRoleToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Role',
      render: (role) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{role.name}</span>
          {isProtectedRole(role) && (
            <span
              title="Holds the platform-wide `*` wildcard — protected from edits in this UI to prevent lockout"
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
            >
              <Lock className="h-3 w-3" />
              Protected
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (role) =>
        role.description || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'permissions',
      header: 'Permissions',
      render: (role) => `${role.permissions?.length || 0} granted`,
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            render: (role) => {
              const protectedRole = isProtectedRole(role)
              return (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={protectedRole}
                    title={
                      protectedRole
                        ? 'Protected role — cannot be edited'
                        : undefined
                    }
                    onClick={() => onEdit(role)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={protectedRole}
                    title={
                      protectedRole
                        ? 'Protected role — permissions cannot be changed'
                        : undefined
                    }
                    onClick={() => onManagePermissions(role)}
                  >
                    Manage Permissions
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={protectedRole}
                    title={
                      protectedRole
                        ? 'Protected role — cannot be deleted'
                        : undefined
                    }
                    onClick={() => setRoleToDelete(role)}
                  >
                    Delete
                  </Button>
                </div>
              )
            },
          },
        ]
      : []),
  ]

  return (
    <>
      <Table
        columns={columns}
        data={roles}
        loading={isLoading}
        error={error ? error?.response?.data?.message || 'Failed to load roles.' : null}
        onRetry={refetch}
        emptyTitle="No roles found"
      />
      <ConfirmDialog
        open={Boolean(roleToDelete)}
        onClose={() => setRoleToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete role?"
        description={
          roleToDelete
            ? `This will delete "${roleToDelete.name}". This can't be undone from this screen. If any staff are currently assigned to it, the deletion will be blocked until they're reassigned.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />
    </>
  )
}