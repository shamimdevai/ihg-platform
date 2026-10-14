import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import PendingFeatureBanner from '@/components/ui/PendingFeatureBanner'
import { Label } from '@/components/ui/Label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import * as hotelApi from '@/api/staff/hotelApi'

// FLAGGED IN CHAT, not silently built around: this phase's OpenAPI
// slice has no availability/date-range endpoint at all — GET
// /hotel/rooms only accepts hotel_id/status query params, and there's
// no queryable booking data yet (bookings are Phase 14). Real
// overlap-checking ("is this room free for these dates") is therefore
// not buildable against anything real today.
//
// What this screen actually does instead: a real, working "which rooms
// are free RIGHT NOW" browser, using the real status=available filter
// that does exist — plus an optional room-type filter. The banner below
// makes the gap visible to staff rather than pretending date-range
// checking works. Logged in docs/PROGRESS.md for Phase 14 to pick up
// (a real booking-overlap check will need a new backend endpoint or a
// client-side cross-reference against booking data once that exists).
export default function AvailabilitySearch({ hotelId, roomTypes = [] }) {
  const [roomTypeFilter, setRoomTypeFilter] = useState('all')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hotel', 'rooms', hotelId, 'available'],
    queryFn: () => hotelApi.listRooms({ hotelId, status: 'available' }),
    enabled: Boolean(hotelId),
  })

  const roomTypeName = (roomTypeId) => roomTypes.find((rt) => rt.id === roomTypeId)?.name || '—'

  const filtered = (data || []).filter(
    (room) => roomTypeFilter === 'all' || room.room_type_id === roomTypeFilter
  )

  const columns = [
    { key: 'room_number', header: 'Room #' },
    { key: 'floor', header: 'Floor', render: (row) => row.floor || '—' },
    { key: 'room_type_id', header: 'Room Type', render: (row) => roomTypeName(row.room_type_id) },
    {
      key: 'status',
      header: 'Status',
      render: () => (
        <StatusBadge
          status="available"
          colorMap={{ available: { label: 'Available', className: 'bg-green-100 text-green-700' } }}
        />
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PendingFeatureBanner>
        Date-range availability checking (confirming a room is free for a specific check-in/check-out
        range, accounting for existing bookings) isn't supported by the backend yet — there's no
        availability endpoint and no date parameters on the rooms list. This shows rooms that are
        currently marked "available" right now, not a true date-range search. Flagged for
        product-owner/backend follow-up ahead of Phase 14's booking flow.
      </PendingFeatureBanner>

      <div className="w-64">
        <Label htmlFor="rt-filter">Room Type</Label>
        <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
          <SelectTrigger id="rt-filter">
            <SelectValue placeholder="All room types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All room types</SelectItem>
            {roomTypes.map((rt) => (
              <SelectItem key={rt.id} value={rt.id}>
                {rt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table
        columns={columns}
        data={filtered}
        loading={isLoading}
        error={isError ? error?.response?.data?.message || error?.message : null}
        onRetry={refetch}
        emptyTitle="No available rooms right now"
      />
    </div>
  )
}