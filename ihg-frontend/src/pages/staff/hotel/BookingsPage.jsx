import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '@/components/layout/PageHeader'
import { Label } from '@/components/ui/Label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import { usePermission } from '@/hooks/usePermission'
import * as hotelApi from '@/api/staff/hotelApi'
import * as hotelGuestsApi from '@/api/staff/hotelGuestsApi'
import BookingsList from '@/features/staff/hotel/bookings/BookingsList'

// Hotel selector reuses the same hotels list Phase 13's RoomsPage
// fetches (create/edit UI stays on that page only — no duplicate hotel
// management surface here, just a picker so bookings can be scoped to
// one hotel at a time, same as Rooms/Availability already do).
export default function BookingsPage() {
  const canReadGuests = usePermission('customers:guests:read')
  const [selectedHotelId, setSelectedHotelId] = useState(null)

  const {
    data: hotels,
    isLoading: hotelsLoading,
    isError: hotelsError,
  } = useQuery({
    queryKey: ['hotel', 'hotels'],
    queryFn: hotelApi.listHotels,
  })

  useEffect(() => {
    if (!selectedHotelId && hotels && hotels.length > 0) {
      setSelectedHotelId(hotels[0].id)
    }
  }, [hotels, selectedHotelId])

  // Full room list (all statuses) — used to join room_id → room_number
  // for display in BookingsList, across bookings of any status
  // (including past/occupied rooms).
  const { data: allRooms } = useQuery({
    queryKey: ['hotel', 'rooms', selectedHotelId, 'all'],
    queryFn: () => hotelApi.listRooms({ hotelId: selectedHotelId }),
    enabled: Boolean(selectedHotelId),
  })

  // Rooms currently marked available — sourced for BookingForm's room
  // dropdown. Same client-side-only limitation as Phase 13's
  // AvailabilitySearch (Open Question 5): this is "available right
  // now", not a true check-in/check-out date-range overlap check.
  const { data: availableRooms } = useQuery({
    queryKey: ['hotel', 'rooms', selectedHotelId, 'available'],
    queryFn: () => hotelApi.listRooms({ hotelId: selectedHotelId, status: 'available' }),
    enabled: Boolean(selectedHotelId),
  })

  // Guests fetched here only if the caller holds customers:guests:read
  // — degrades gracefully in BookingForm.jsx if not (see that file's
  // notes). Both roles that hold hotel:booking:write today (Admin,
  // Reception) also hold this code.
  const { data: guests } = useQuery({
    queryKey: ['customers', 'guests'],
    queryFn: hotelGuestsApi.listGuests,
    enabled: canReadGuests,
  })

  return (
    <div>
      <PageHeader title="Bookings" description="Create bookings, and check guests in or out." />

      {hotelsLoading && <LoadingState label="Loading hotels…" />}

      {hotelsError && (
        <EmptyState
          title="Couldn't load hotels"
          description="Something went wrong fetching the hotel list. Try refreshing the page."
        />
      )}

      {!hotelsLoading && !hotelsError && (!hotels || hotels.length === 0) && (
        <EmptyState
          title="No hotels have been set up yet"
          description="Ask an administrator to set up a hotel and rooms (under Rooms) before bookings can be managed here."
        />
      )}

      {!hotelsLoading && hotels && hotels.length > 0 && (
        <>
          <div className="w-72 mb-6">
            <Label htmlFor="booking-hotel-select">Hotel</Label>
            <Select value={selectedHotelId || undefined} onValueChange={setSelectedHotelId}>
              <SelectTrigger id="booking-hotel-select">
                <SelectValue placeholder="Select a hotel" />
              </SelectTrigger>
              <SelectContent>
                {hotels.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedHotelId && (
            <BookingsList
              hotelId={selectedHotelId}
              allRooms={allRooms || []}
              availableRooms={availableRooms || []}
              guests={guests || []}
            />
          )}
        </>
      )}
    </div>
  )
}