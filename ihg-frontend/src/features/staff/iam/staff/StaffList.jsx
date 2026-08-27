import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as iamStaffApi from '@/api/staff/iamStaffApi'
import * as iamRolesApi from '@/api/staff/iamRolesApi'
import * as iamDepartmentsApi from '@/api/staff/iamDepartmentsApi'
import StaffForm from './StaffForm'
import InviteStaffModal from './InviteStaffModal'

const staffStatusMap = {
  true: { label: 'Active', className: 'bg-green-100 text-green-700' },
  false: { label: 'Deactivated', className: 'bg-gray-100 text-gray-600' },
}

function formatLastLogin(value) {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

// Admin: full CRUD + invite. Manager holds iam:staff:read only (RBAC_MATRIX
// §5.1) — sees this same list with zero write controls, enforced below by
// usePermission('iam:staff:write'), not by convention (per the Global
// Context Prompt: hiding UI alone isn't sufficient, but here it IS also
// backed by the backend rejecting the same calls with 403).
export default function StaffList() {
  const canWrite = usePermission('iam:staff:write')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [formOpen, setFormOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null) // null = create mode
  const [inviteTarget, setInviteTarget] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)

  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: iamStaffApi.listStaff })
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: iamRolesApi.listRoles })
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: iamDepartmentsApi.listDepartments })

  const roleNameById = useMemo(() => {
    const map = {}
    ;(rolesQuery.data || []).forEach((r) => { map[r.id] = r.name })
    return map
  }, [rolesQuery.data])

  const departmentNameById = useMemo(() => {
    const map = {}
    ;(departmentsQuery.data || []).forEach((d) => { map[d.id] = d.name })
    return map
  }, [departmentsQuery.data])

  const deactivateMutation = useMutation({
    mutationFn: (staffId) => iamStaffApi.deactivateStaff(staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast({ title: 'Staff account deactivated.', variant: 'success' })
      setDeactivateTarget(null)
    },
    onError: (err) => {
      toast({
        title: 'Could not deactivate staff account.',
        description: err?.response?.data?.message || err?.message,
        variant: 'destructive',
      })
    },
  })

  const columns = [
    { key: 'name', header: 'Name', render: (row) => `${row.first_name} ${row.last_name}` },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (row) => roleNameById[row.role_id] || '—' },
    {
      key: 'department',
      header: 'Department',
      render: (row) => (row.department_id ? departmentNameById[row.department_id] || '—' : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={String(row.is_active)} colorMap={staffStatusMap} />,
    },
    { key: 'last_login_at', header: 'Last Login', render: (row) => formatLastLogin(row.last_login_at) },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setEditingStaff(row); setFormOpen(true) }}>
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setInviteTarget(row)}>
                  Resend Invite
                </Button>
                {row.is_active && (
                  <Button variant="destructive" size="sm" onClick={() => setDeactivateTarget(row)}>
                    Deactivate
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div>
      {canWrite && (
        <div className="flex justify-end mb-4">
          <Button onClick={() => { setEditingStaff(null); setFormOpen(true) }}>Add Staff</Button>
        </div>
      )}

      <Table
        columns={columns}
        data={staffQuery.data}
        loading={staffQuery.isLoading || rolesQuery.isLoading || departmentsQuery.isLoading}
        error={staffQuery.isError ? 'Could not load staff accounts.' : null}
        onRetry={() => staffQuery.refetch()}
        emptyTitle="No staff accounts yet"
      />

      {canWrite && (
        <StaffForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingStaff(null) }}
          staff={editingStaff}
          roles={rolesQuery.data || []}
          departments={departmentsQuery.data || []}
        />
      )}

      {canWrite && (
        <InviteStaffModal
          open={Boolean(inviteTarget)}
          onClose={() => setInviteTarget(null)}
          staff={inviteTarget}
        />
      )}

      {canWrite && (
        <ConfirmDialog
          open={Boolean(deactivateTarget)}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={() => deactivateMutation.mutate(deactivateTarget.id)}
          title="Deactivate this staff account?"
          description={
            deactivateTarget
              ? `${deactivateTarget.first_name} ${deactivateTarget.last_name} will no longer be able to log in. This cannot be undone from here.`
              : undefined
          }
          confirmLabel="Deactivate"
          variant="destructive"
          loading={deactivateMutation.isPending}
        />
      )}
    </div>
  )
}