import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as restaurantApi from '@/api/staff/restaurantApi'
import * as iamStaffApi from '@/api/staff/iamStaffApi'

// Real, schema-confirmed values (from the status field's description
// string on PUT /tables/{id}/status) — NOT inferred, same treatment as
// Phase 13's ROOM_STATUSES.
const TABLE_STATUSES = ['available', 'reserved', 'occupied', 'cleaning']

const statusColorMap = {
  available: { label: 'Available', className: 'bg-green-100 text-green-700' },
  reserved: { label: 'Reserved', className: 'bg-blue-100 text-blue-700' },
  occupied: { label: 'Occupied', className: 'bg-red-100 text-red-700' },
  cleaning: { label: 'Cleaning', className: 'bg-amber-100 text-amber-700' },
}

const activeMap = {
  true: { label: 'Active', className: 'bg-green-100 text-green-700' },
  false: { label: 'Inactive', className: 'bg-gray-200 text-gray-600' },
}

// Waiter assignment is built inline here (per-row action + modal)
// rather than as a separate file — not named in Phase 17's deliverable
// list, but required by the acceptance checklist. Same precedent as
// RoomStatusModal living inside RoomsList.jsx (Phase 13) and the Cancel
// modal living inside BookingsList.jsx (Phase 14). Gated by the same
// restaurant:table:write code as everything else on this screen —
// CONFIRMED from the assign-waiter endpoint's own source comment, not
// restaurant:order:*.
export default function TablesList({ restaurantId }) {
  const canWrite = usePermission('restaurant:table:write')
  const canReadStaff = usePermission('iam:staff:read')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [statusEditing, setStatusEditing] = useState(null)
  const [assignTarget, setAssignTarget] = useState(null)
  const [unassignTarget, setUnassignTarget] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['restaurant', 'tables', restaurantId, statusFilter],
    queryFn: () =>
      restaurantApi.listTables({ restaurantId, status: statusFilter === 'all' ? undefined : statusFilter }),
    enabled: Boolean(restaurantId),
  })

  // Fetched regardless of canWrite — viewing which waiter is on a table
  // is restaurant:table:read territory; only assign/unassign are write
  // actions. Filtered to active assignments only; at most one active
  // assignment per table is assumed (not enforced client-side, the
  // backend owns that invariant).
  const { data: assignments } = useQuery({
    queryKey: ['restaurant', 'waiters', 'active'],
    queryFn: () => restaurantApi.listWaiterAssignments({ isActive: true }),
  })

  const { data: staffList } = useQuery({
    queryKey: ['iam', 'staff'],
    queryFn: iamStaffApi.listStaff,
    enabled: canReadStaff && canWrite,
  })

  const invalidateTables = () => queryClient.invalidateQueries({ queryKey: ['restaurant', 'tables', restaurantId] })
  const invalidateAssignments = () => queryClient.invalidateQueries({ queryKey: ['restaurant', 'waiters', 'active'] })

  const createMutation = useMutation({
    mutationFn: restaurantApi.createTable,
    onSuccess: () => {
      toast({ title: 'Table created', variant: 'success' })
      invalidateTables()
      setFormOpen(false)
    },
    onError: (err) =>
      toast({
        title: 'Could not create table',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => restaurantApi.updateTableStatus(id, status),
    onSuccess: () => {
      toast({ title: 'Table status updated', variant: 'success' })
      invalidateTables()
      setStatusEditing(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not update table status',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const assignMutation = useMutation({
    mutationFn: ({ tableId, staffId }) => restaurantApi.assignWaiter({ table_id: tableId, staff_id: staffId }),
    onSuccess: () => {
      toast({ title: 'Waiter assigned', variant: 'success' })
      invalidateAssignments()
      setAssignTarget(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not assign waiter',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const unassignMutation = useMutation({
    mutationFn: (assignmentId) => restaurantApi.unassignWaiter(assignmentId),
    onSuccess: () => {
      toast({ title: 'Waiter unassigned', variant: 'success' })
      invalidateAssignments()
      setUnassignTarget(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not unassign waiter',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const activeAssignmentForTable = (tableId) => (assignments || []).find((a) => a.table_id === tableId && a.is_active)

  const staffName = (staffId) => {
    const s = (staffList || []).find((s) => s.id === staffId)
    return s ? `${s.first_name} ${s.last_name}` : staffId
  }

  const columns = [
    { key: 'table_number', header: 'Table #' },
    { key: 'capacity', header: 'Capacity' },
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
    {
      key: 'waiter',
      header: 'Waiter',
      render: (row) => {
        const a = activeAssignmentForTable(row.id)
        if (!a) return <span className="text-muted-foreground">Unassigned</span>
        return canReadStaff ? staffName(a.staff_id) : a.staff_id
      },
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            render: (row) => {
              const a = activeAssignmentForTable(row.id)
              return (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStatusEditing(row)}>
                    Change Status
                  </Button>
                  {a ? (
                    <Button variant="ghost" size="sm" onClick={() => setUnassignTarget(a)}>
                      Unassign Waiter
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setAssignTarget(row)}>
                      Assign Waiter
                    </Button>
                  )}
                </div>
              )
            },
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {TABLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusColorMap[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canWrite && <Button onClick={() => setFormOpen(true)}>Add Table</Button>}
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No tables yet"
      />

      {canWrite && (
        <TableForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => createMutation.mutate({ restaurant_id: restaurantId, ...values })}
          loading={createMutation.isPending}
        />
      )}

      {canWrite && (
        <TableStatusModal
          table={statusEditing}
          onClose={() => setStatusEditing(null)}
          onSubmit={(status) => statusMutation.mutate({ id: statusEditing.id, status })}
          loading={statusMutation.isPending}
        />
      )}

      {canWrite && (
        <AssignWaiterModal
          table={assignTarget}
          staffList={staffList || []}
          canReadStaff={canReadStaff}
          onClose={() => setAssignTarget(null)}
          onSubmit={(staffId) => assignMutation.mutate({ tableId: assignTarget.id, staffId })}
          loading={assignMutation.isPending}
        />
      )}

      {canWrite && (
        <ConfirmDialog
          open={Boolean(unassignTarget)}
          onClose={() => setUnassignTarget(null)}
          onConfirm={() => unassignMutation.mutate(unassignTarget.id)}
          title="Unassign this waiter?"
          description="The table will show as unassigned until a new waiter is assigned."
          confirmLabel="Unassign"
          variant="destructive"
          loading={unassignMutation.isPending}
        />
      )}
    </div>
  )
}

// Create-only, inline — no general edit endpoint exists for a table's
// own fields (table_number/capacity/is_active), only the status
// transition above. Same "create-only, edit is a separate narrow
// endpoint" shape as hotel rooms in Phase 13.
const tableSchema = z.object({
  table_number: z.string().min(1, 'Table number is required'),
  capacity: z.string().optional(),
  is_active: z.boolean(),
})

function TableForm({ open, onClose, onSubmit, loading }) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(tableSchema),
    defaultValues: { table_number: '', capacity: '2', is_active: true },
  })

  useEffect(() => {
    if (open) reset({ table_number: '', capacity: '2', is_active: true })
  }, [open, reset])

  const submit = (values) => {
    onSubmit({
      table_number: values.table_number,
      capacity: values.capacity ? Number(values.capacity) : 2,
      is_active: values.is_active,
    })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Table">
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <Label htmlFor="table_number">Table Number</Label>
          <Input id="table_number" {...register('table_number')} />
          {errors.table_number && <p className="text-sm text-destructive">{errors.table_number.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="capacity">Capacity</Label>
          <Input id="capacity" type="number" min="1" {...register('capacity')} />
        </div>
        <div className="flex items-center gap-2">
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <Checkbox id="table-is_active" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <Label htmlFor="table-is_active">Active</Label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Table
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function TableStatusModal({ table, onClose, onSubmit, loading }) {
  const [status, setStatus] = useState('available')

  useEffect(() => {
    if (table) setStatus(table.status)
  }, [table])

  return (
    <Modal open={Boolean(table)} onClose={onClose} title={table ? `Table ${table.table_number} — Status` : ''}>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="table-status">New Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="table-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusColorMap[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSubmit(status)} loading={loading}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// Staff dropdown degrades to a plain UUID text input if the caller
// doesn't hold iam:staff:read — same defensive pattern as BookingForm's
// guest dropdown (Phase 14).
function AssignWaiterModal({ table, staffList, canReadStaff, onClose, onSubmit, loading }) {
  const [staffId, setStaffId] = useState('')

  useEffect(() => {
    if (table) setStaffId('')
  }, [table])

  return (
    <Modal open={Boolean(table)} onClose={onClose} title={table ? `Assign Waiter — Table ${table.table_number}` : ''}>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="waiter-staff">Staff Member</Label>
          {canReadStaff ? (
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger id="waiter-staff">
                <SelectValue placeholder="Select a staff member" />
              </SelectTrigger>
              <SelectContent>
                {staffList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="waiter-staff"
              placeholder="Staff ID (UUID)"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            />
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSubmit(staffId)} loading={loading} disabled={!staffId}>
            Assign
          </Button>
        </div>
      </div>
    </Modal>
  )
}