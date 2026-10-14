import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import PendingFeatureBanner from '@/components/ui/PendingFeatureBanner'
import { useToast } from '@/components/ui/ToastProvider'
import { usePermission } from '@/hooks/usePermission'
import * as hotelApi from '@/api/staff/hotelApi'
import BookingForm from './BookingForm'
import CheckInModal from './CheckInModal'
import CheckOutModal from './CheckOutModal'

// Booking.status has no confirmed enum block in this phase's OpenAPI
// slice — only one example value ("confirmed") is shown, and the
// Global Context Prompt's "reserved → checked_in → checked_out/
// cancelled" wording is explicitly flagged there as a paraphrase, not a
// guaranteed literal. Same treatment as Phase 11's alert `status` and
// Phase 12's Payment/RefundRequest `status`: a free-text filter (not a
// dropdown of assumed values) and a fallback-safe StatusBadge, rather
// than hardcoding strings that might not match the real values. The
// action buttons below are gated off REAL typed fields
// (actual_check_in_at / actual_check_out_at / cancelled_reason)
// instead of this unconfirmed string, for the same reason Phase 11/12
// gated their own actions off resolved_at/refunded_at/reviewed_at.
const statusColorMap = {
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-700' },
  checked_in: { label: 'Checked In', className: 'bg-green-100 text-green-700' },
  checked_out: { label: 'Checked Out', className: 'bg-gray-200 text-gray-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

export default function BookingsList({ hotelId, availableRooms = [], allRooms = [], guests = [] }) {
  const canWrite = usePermission('hotel:booking:write')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [checkInTarget, setCheckInTarget] = useState(null)
  const [checkOutTarget, setCheckOutTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hotel', 'bookings', hotelId, statusFilter],
    queryFn: () => hotelApi.listBookings({ hotelId, status: statusFilter || undefined }),
    enabled: Boolean(hotelId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hotel', 'bookings', hotelId] })

  const createMutation = useMutation({
    mutationFn: hotelApi.createBooking,
    onSuccess: () => {
      toast({ title: 'Booking created', variant: 'success' })
      invalidate()
      setFormOpen(false)
    },
    onError: (err) =>
      toast({
        title: 'Could not create booking',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => hotelApi.cancelBooking(id, reason),
    onSuccess: () => {
      toast({ title: 'Booking cancelled', variant: 'success' })
      invalidate()
      setCancelTarget(null)
      setCancelReason('')
    },
    onError: (err) =>
      toast({
        title: 'Could not cancel booking',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const checkInMutation = useMutation({
    mutationFn: (id) => hotelApi.checkInBooking(id),
    onSuccess: () => {
      toast({ title: 'Guest checked in', variant: 'success' })
      invalidate()
      setCheckInTarget(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not check in',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const checkOutMutation = useMutation({
    mutationFn: (id) => hotelApi.checkOutBooking(id),
    onSuccess: () => {
      toast({ title: 'Guest checked out', variant: 'success' })
      invalidate()
      setCheckOutTarget(null)
    },
    onError: (err) =>
      toast({
        title: 'Could not check out',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      }),
  })

  const roomNumber = (roomId) => allRooms.find((r) => r.id === roomId)?.room_number || roomId
  const guestName = (guestId) => {
    const g = guests.find((g) => g.id === guestId)
    return g ? `${g.first_name} ${g.last_name}` : guestId
  }

  const columns = [
    { key: 'room_id', header: 'Room', render: (row) => `Room ${roomNumber(row.room_id)}` },
    { key: 'guest_id', header: 'Guest', render: (row) => guestName(row.guest_id) },
    { key: 'check_in_date', header: 'Check-in' },
    { key: 'check_out_date', header: 'Check-out' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={statusColorMap} />,
    },
    { key: 'total_amount', header: 'Total', render: (row) => (row.total_amount != null ? row.total_amount : '—') },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            render: (row) => {
              // Gated off real typed fields, not the unconfirmed status
              // string — see the status note above.
              const canCheckIn = !row.actual_check_in_at && !row.cancelled_reason
              const canCheckOut = Boolean(row.actual_check_in_at) && !row.actual_check_out_at && !row.cancelled_reason
              const canCancel = !row.actual_check_out_at && !row.cancelled_reason

              return (
                <div className="flex gap-2">
                  {canCheckIn && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCheckInTarget({ ...row, roomNumber: roomNumber(row.room_id) })}
                    >
                      Check In
                    </Button>
                  )}
                  {canCheckOut && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCheckOutTarget({ ...row, roomNumber: roomNumber(row.room_id) })}
                    >
                      Check Out
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
      {/* Flag #1 (Global Context Prompt §1 Bucket B) — no guest-facing
          booking surface exists anywhere in the app; hotel guests never
          log in at all. This note lives here, on the staff-facing
          bookings screen, since there's nowhere else for it to attach
          to. See PROGRESS.md Open Question (1). */}
      <PendingFeatureBanner className="mb-4">
        Guests currently cannot book directly — bookings are staff-created only. See Open Question #1
        in PROGRESS.md.
      </PendingFeatureBanner>

      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="w-56">
          <Label htmlFor="booking-status-filter" className="sr-only">
            Filter by status
          </Label>
          <Input
            id="booking-status-filter"
            placeholder="Filter by status (e.g. confirmed)"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
        {canWrite && <Button onClick={() => setFormOpen(true)}>New Booking</Button>}
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No bookings yet"
      />

      {canWrite && (
        <BookingForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => createMutation.mutate({ hotel_id: hotelId, ...values })}
          loading={createMutation.isPending}
          rooms={availableRooms}
          guests={guests}
        />
      )}

      {canWrite && (
        <CheckInModal
          booking={checkInTarget}
          onClose={() => setCheckInTarget(null)}
          onConfirm={() => checkInMutation.mutate(checkInTarget.id)}
          loading={checkInMutation.isPending}
        />
      )}

      {canWrite && (
        <CheckOutModal
          booking={checkOutTarget}
          onClose={() => setCheckOutTarget(null)}
          onConfirm={() => checkOutMutation.mutate(checkOutTarget.id)}
          loading={checkOutMutation.isPending}
        />
      )}

      {/* Cancel-with-optional-reason kept inline rather than a separate
          file — Phase 14's own deliverable list names CheckInModal/
          CheckOutModal only; this is the one other booking-action modal
          needed, small enough to live next to the list that owns it —
          same precedent as Phase 13's RoomStatusModal living inside
          RoomsList.jsx. */}
      {canWrite && (
        <Modal
          open={Boolean(cancelTarget)}
          onClose={() => {
            setCancelTarget(null)
            setCancelReason('')
          }}
          title="Cancel this booking?"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Optional — e.g. guest requested cancellation"
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
                Keep Booking
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason || undefined })}
              >
                Cancel Booking
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}