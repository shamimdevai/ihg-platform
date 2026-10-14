import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as restaurantApi from '@/api/staff/restaurantApi'
import ReservationForm from './ReservationForm'

// Reservation.status has NO confirmed enum in this phase's given slice
// (single example value "confirmed", no `enum` block). Inferred from
// the three real actions this screen exposes: confirmed (on create) →
// seated (via /seat) → completed (via /complete), or → cancelled (via
// /cancel) at any point before completion. Same free-text-filter +
// fallback-badge treatment every unconfirmed status field has gotten
// since Phase 11.
//
// IMPORTANT DEVIATION, flagged explicitly: every prior unconfirmed
// status field in this codebase (Booking, Invoice, HousekeepingTask)
// still had a REAL typed field to gate its action buttons off of
// instead of the guessed string (actual_check_in_at, issued_at, etc.).
// Reservation has no such field anywhere in its response shape — the
// action buttons below are gated directly off this inferred `status`
// string because there is genuinely nothing else to gate off of. This
// is a real gap in the given schema, not a design choice — if the
// backend owner confirms real enum values later, re-verify these gates
// are actually correct, don't just carry the guess forward.
const statusColorMap = {
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-700' },
  seated: { label: 'Seated', className: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', className: 'bg-gray-200 text-gray-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

export default function ReservationsList({ restaurantId, tables = [] }) {
  const canWrite = usePermission('restaurant:table:write')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [tableFilter, setTableFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['restaurant', 'reservations', restaurantId, tableFilter, statusFilter],
    queryFn: () =>
      restaurantApi.listReservations({
        restaurantId,
        tableId: tableFilter === 'all' ? undefined : tableFilter,
        status: statusFilter || undefined,
      }),
    enabled: Boolean(restaurantId),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['restaurant', 'reservations', restaurantId] })

  const createMutation = useMutation({
    mutationFn: restaurantApi.createReservation,
    onSuccess: () => {
      toast({ title: 'Reservation created', variant: 'success' })
      invalidate()
      setFormOpen(false)
    },
    onError: (err) =>
      toast({
        title: 'Could not create reservation',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const seatMutation = useMutation({
    mutationFn: (id) => restaurantApi.seatReservation(id),
    onSuccess: () => {
      toast({ title: 'Guest seated', variant: 'success' })
      invalidate()
    },
    onError: (err) =>
      toast({
        title: 'Could not seat reservation',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const completeMutation = useMutation({
    mutationFn: (id) => restaurantApi.completeReservation(id),
    onSuccess: () => {
      toast({ title: 'Reservation completed', variant: 'success' })
      invalidate()
    },
    onError: (err) =>
      toast({
        title: 'Could not complete reservation',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => restaurantApi.cancelReservation(id, reason),
    onSuccess: () => {
      toast({ title: 'Reservation cancelled', variant: 'success' })
      invalidate()
      setCancelTarget(null)
      setCancelReason('')
    },
    onError: (err) =>
      toast({
        title: 'Could not cancel reservation',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const tableNumber = (tableId) => tables.find((t) => t.id === tableId)?.table_number || tableId

  const columns = [
    { key: 'table_id', header: 'Table', render: (row) => `Table ${tableNumber(row.table_id)}` },
    { key: 'customer_name', header: 'Customer' },
    { key: 'customer_phone', header: 'Phone', render: (row) => row.customer_phone || '—' },
    {
      key: 'reservation_time',
      header: 'Date & Time',
      render: (row) => new Date(row.reservation_time).toLocaleString(),
    },
    { key: 'party_size', header: 'Party Size' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={statusColorMap} />,
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            render: (row) => {
              // See the header comment above — gated off the inferred
              // status string itself, since no real typed field exists
              // here to gate off of instead.
              const canSeat = !['seated', 'completed', 'cancelled'].includes(row.status)
              const canComplete = row.status === 'seated'
              const canCancel = !['completed', 'cancelled'].includes(row.status)

              return (
                <div className="flex gap-2">
                  {canSeat && (
                    <Button variant="outline" size="sm" onClick={() => seatMutation.mutate(row.id)}>
                      Seat
                    </Button>
                  )}
                  {canComplete && (
                    <Button variant="outline" size="sm" onClick={() => completeMutation.mutate(row.id)}>
                      Complete
                    </Button>
                  )}
                  {canCancel && (
                    <Button variant="ghost" size="sm" onClick={() => setCancelTarget(row)}>
                      Cancel
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
        <div className="flex gap-4 flex-wrap">
          <div className="w-48">
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All tables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tables</SelectItem>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Table {t.table_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <Label htmlFor="reservation-status-filter" className="sr-only">
              Filter by status
            </Label>
            <Input
              id="reservation-status-filter"
              placeholder="Filter by status (e.g. confirmed)"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
        {canWrite && <Button onClick={() => setFormOpen(true)}>New Reservation</Button>}
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No reservations yet"
      />

      {canWrite && (
        <ReservationForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => createMutation.mutate({ restaurant_id: restaurantId, ...values })}
          loading={createMutation.isPending}
          tables={tables}
        />
      )}

      {/* Cancel-with-optional-reason kept inline — same precedent as
          Phase 14's BookingsList.jsx cancel modal. */}
      {canWrite && (
        <Modal
          open={Boolean(cancelTarget)}
          onClose={() => {
            setCancelTarget(null)
            setCancelReason('')
          }}
          title="Cancel this reservation?"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="reservation-cancel-reason">Reason (optional)</Label>
              <Textarea
                id="reservation-cancel-reason"
                placeholder="Optional — e.g. customer called to cancel"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCancelTarget(null)
                  setCancelReason('')
                }}
                disabled={cancelMutation.isPending}
              >
                Keep Reservation
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason || undefined })}
              >
                Cancel Reservation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}