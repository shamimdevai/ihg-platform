import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as deliveryApi from '@/api/staff/deliveryApi'
import * as iamStaffApi from '@/api/staff/iamStaffApi'
import RiderForm from './RiderForm'

// INFERRED, quick-pick options only — "available" is the schema's own
// real example value, but "busy"/"offline" have zero schema signal at
// all (see deliveryApi.js header comment). A free-text "custom" fallback
// is offered in the status modal below, same precedent as
// TaskBoard.jsx's housekeeping-status treatment (Phase 15).
const INFERRED_RIDER_STATUSES = ['available', 'busy', 'offline']

const statusColorMap = {
  available: { label: 'Available', className: 'bg-green-100 text-green-700' },
  busy: { label: 'Busy', className: 'bg-amber-100 text-amber-800' },
  offline: { label: 'Offline', className: 'bg-gray-200 text-gray-600' },
}

const activeMap = {
  true: { label: 'Active', className: 'bg-green-100 text-green-700' },
  false: { label: 'Inactive', className: 'bg-gray-200 text-gray-600' },
}

function RiderStatusModal({ rider, onClose, onSubmit, loading }) {
  const [status, setStatus] = useState('available')
  const [useCustom, setUseCustom] = useState(false)
  const [customStatus, setCustomStatus] = useState('')

  useEffect(() => {
    if (rider) {
      setStatus(rider.status || 'available')
      setUseCustom(false)
      setCustomStatus('')
    }
  }, [rider])

  const isValid = useCustom ? customStatus.trim().length > 0 : Boolean(status)

  return (
    <Modal open={Boolean(rider)} onClose={onClose} title="Change Rider Status">
      <div className="space-y-4">
        {!useCustom ? (
          <div className="space-y-1">
            <Label htmlFor="rider-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="rider-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INFERRED_RIDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusColorMap[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              className="text-xs text-blue-600 mt-1 underline"
              onClick={() => setUseCustom(true)}
            >
              Use a different status value
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="rider-status-custom">Status (custom value)</Label>
            <Input
              id="rider-status-custom"
              placeholder="e.g. on_break"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
            />
            <button
              type="button"
              className="text-xs text-blue-600 mt-1 underline"
              onClick={() => setUseCustom(false)}
            >
              Choose from common statuses instead
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit(useCustom ? customStatus.trim() : status)}
            loading={loading}
            disabled={!isValid}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// Gated at the route level by delivery:rider:write (staffRoutes.jsx).
// Every action inside this screen (create, edit, status override,
// active/inactive toggle) uses that same code — CONFIRMED Admin-only,
// Rider does not hold it (RBAC_MATRIX §5.1/§6.8).
export default function RidersList() {
  const canWrite = usePermission('delivery:rider:write')
  const canReadStaff = usePermission('iam:staff:read')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingRider, setEditingRider] = useState(null)
  const [statusEditing, setStatusEditing] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['delivery', 'riders', 'all', statusFilter],
    queryFn: () => deliveryApi.listRiders({ status: statusFilter || undefined }),
  })

  // Riders carry only staff_id, not a name — resolved client-side the
  // same way TablesList.jsx resolves waiter names (Phase 17). Degrades
  // to the raw UUID if the caller doesn't hold iam:staff:read.
  const { data: staffList } = useQuery({
    queryKey: ['iam', 'staff'],
    queryFn: iamStaffApi.listStaff,
    enabled: canReadStaff,
  })

  const staffName = (staffId) => {
    const s = (staffList || []).find((s) => s.id === staffId)
    return s ? `${s.first_name} ${s.last_name}` : staffId
  }

  const invalidateRiders = () => queryClient.invalidateQueries({ queryKey: ['delivery', 'riders'] })

  const createMutation = useMutation({
    mutationFn: deliveryApi.createRider,
    onSuccess: () => {
      toast({ title: 'Rider created', variant: 'success' })
      invalidateRiders()
      setFormOpen(false)
    },
    onError: (err) =>
      toast({
        title: 'Could not create rider',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => deliveryApi.updateRider(id, values),
    onSuccess: () => {
      toast({ title: 'Rider updated', variant: 'success' })
      invalidateRiders()
      setEditingRider(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not update rider',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => deliveryApi.setRiderStatus(id, status),
    onSuccess: () => {
      toast({ title: 'Rider status updated', variant: 'success' })
      invalidateRiders()
      setStatusEditing(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not update rider status',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => deliveryApi.updateRider(id, { is_active: isActive }),
    onSuccess: () => {
      toast({ title: 'Rider updated', variant: 'success' })
      invalidateRiders()
    },
    onError: (err) =>
      toast({
        title: 'Could not update rider',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const columns = [
    { key: 'staff_id', header: 'Staff Member', render: (row) => staffName(row.staff_id) },
    { key: 'vehicle_type', header: 'Vehicle', render: (row) => row.vehicle_type || '—' },
    { key: 'license_plate', header: 'Plate', render: (row) => row.license_plate || '—' },
    { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={statusColorMap} />,
    },
    {
      key: 'is_active',
      header: 'Active',
      render: (row) => <StatusBadge status={String(row.is_active)} colorMap={activeMap} />,
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setStatusEditing(row)}>
                  Change Status
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingRider(row)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={toggleActiveMutation.isPending && toggleActiveMutation.variables?.id === row.id}
                  onClick={() =>
                    toggleActiveMutation.mutate({ id: row.id, isActive: !row.is_active })
                  }
                >
                  {row.is_active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="w-56">
          <Label htmlFor="rider-status-filter" className="sr-only">
            Filter by status
          </Label>
          {/* Free-text, not a dropdown — Rider.status is inferred, not
              confirmed by an `enum` block (see deliveryApi.js). */}
          <Input
            id="rider-status-filter"
            placeholder="Filter by status (e.g. available)"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
        {canWrite && <Button onClick={() => setFormOpen(true)}>Add Rider</Button>}
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No riders yet"
      />

      {canWrite && (
        <RiderForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => createMutation.mutate(values)}
          loading={createMutation.isPending}
        />
      )}

      {canWrite && (
        <RiderForm
          open={Boolean(editingRider)}
          rider={editingRider}
          onClose={() => setEditingRider(null)}
          onSubmit={(values) => updateMutation.mutate({ id: editingRider.id, values })}
          loading={updateMutation.isPending}
        />
      )}

      {canWrite && (
        <RiderStatusModal
          rider={statusEditing}
          onClose={() => setStatusEditing(null)}
          onSubmit={(status) => statusMutation.mutate({ id: statusEditing.id, status })}
          loading={statusMutation.isPending}
        />
      )}
    </div>
  )
}