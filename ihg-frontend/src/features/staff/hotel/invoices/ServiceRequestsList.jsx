import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import * as hotelApi from '@/api/staff/hotelApi'

// View-only this phase, matching the acceptance checklist's "Service
// requests are viewable" wording exactly — create/assign/status-update
// are real endpoints (hotelApi.js) but deliberately not wired in here,
// same discipline Phase 15 applied to TaskBoard.jsx's create/assign
// functions. Don't add those actions without confirming it's now in
// scope.
//
// ServiceRequest.status has no confirmed enum in this phase's given
// slice (single example value "pending") — inferred, non-exhaustive
// colorMap via StatusBadge's fallback, same treatment as every other
// unconfirmed status field in this codebase.
const requestStatusMap = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
}

function shortId(id) {
  return id ? <span title={id}>{id.slice(0, 8)}…</span> : '—'
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function ServiceRequestsList() {
  const [bookingId, setBookingId] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hotel', 'service-requests', { bookingId, status }],
    queryFn: () =>
      hotelApi.listServiceRequests({
        bookingId: bookingId || undefined,
        status: status || undefined,
      }),
  })

  const clearFilters = () => {
    setBookingId('')
    setStatus('')
  }

  const columns = [
    { key: 'request_type', header: 'Type', render: (row) => row.request_type || '—' },
    { key: 'description', header: 'Description', render: (row) => row.description || '—' },
    { key: 'booking_id', header: 'Booking', render: (row) => shortId(row.booking_id) },
    { key: 'room_id', header: 'Room', render: (row) => shortId(row.room_id) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} colorMap={requestStatusMap} />,
    },
    { key: 'assigned_to_staff_id', header: 'Assigned To', render: (row) => shortId(row.assigned_to_staff_id) },
    { key: 'completed_at', header: 'Completed', render: (row) => formatDateTime(row.completed_at) },
    { key: 'created_at', header: 'Created', render: (row) => formatDateTime(row.created_at) },
  ]

  return (
    <div>
      <div className="flex items-end gap-2 mb-4 flex-wrap">
        <div className="space-y-1">
          <Label htmlFor="sr-booking-filter">Booking ID</Label>
          <Input
            id="sr-booking-filter"
            placeholder="UUID"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            className="w-64"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sr-status-filter">Status</Label>
          <Input
            id="sr-status-filter"
            placeholder="e.g. pending, completed"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-48"
          />
        </div>
        {(bookingId || status) && (
          <Button variant="outline" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        data={data}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No service requests found"
      />
    </div>
  )
}