import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import LoadingState from '@/components/ui/LoadingState'
import ErrorState from '@/components/ui/ErrorState'
import EmptyState from '@/components/ui/EmptyState'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as publicCatalogApi from '@/api/customer/publicCatalogApi'
import RoomTypeCard from './RoomTypeCard'
import PropertyPicker from '@/features/customer/shared/PropertyPicker'

function todayLocal() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// Dates live in the URL (?checkIn=&checkOut=&guests=&hotelId=) so the page
// can be shared/refreshed and the home-page search lands here directly.
// "Book now" goes to /shop/book (protected, built in Phase 4) — a logged-out
// visitor is sent to login and returned there with the choices intact.
export default function RoomsBrowse() {
  const navigate = useNavigate()
  const { data: config } = useAppConfig()
  const [params, setParams] = useSearchParams()
  const today = todayLocal()

  const checkIn = params.get('checkIn') || ''
  const checkOut = params.get('checkOut') || ''
  const guests = params.get('guests') || ''
  const hasDates = Boolean(checkIn && checkOut)

  const [form, setForm] = useState({ checkIn, checkOut, guests: guests || '2' })
  const [formError, setFormError] = useState(null)

  const hotelsQuery = useQuery({ queryKey: ['public', 'hotels'], queryFn: publicCatalogApi.listHotels })
  const hotels = hotelsQuery.data
  // One hotel → use it silently. Several → the visitor chooses one (picker
  // below) and the choice lives in the URL.
  const hotelParam = params.get('hotelId')
  const hotelId = hotelParam || (hotels?.length === 1 ? hotels[0].id : '')

  const availabilityQuery = useQuery({
    queryKey: ['public', 'availability', hotelId, checkIn, checkOut, guests],
    queryFn: () => publicCatalogApi.searchAvailability({ hotelId, checkIn, checkOut, guests }),
    enabled: Boolean(hotelId) && hasDates,
    retry: false,
  })
  const typesQuery = useQuery({
    queryKey: ['public', 'room-types', hotelId],
    queryFn: () => publicCatalogApi.listRoomTypes(hotelId),
    enabled: Boolean(hotelId) && !hasDates,
  })

  const buildParams = (next) => {
    const p = new URLSearchParams()
    if (next.hotelId) p.set('hotelId', next.hotelId)
    if (next.checkIn) p.set('checkIn', next.checkIn)
    if (next.checkOut) p.set('checkOut', next.checkOut)
    if (next.guests) p.set('guests', next.guests)
    return p
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (!form.checkIn || !form.checkOut) return setFormError('Please choose both dates.')
    if (form.checkIn < today) return setFormError('Check-in cannot be in the past.')
    if (form.checkOut <= form.checkIn) return setFormError('Check-out must be after check-in.')
    setFormError(null)
    setParams(buildParams({ hotelId, ...form }))
  }

  const handleClear = () => {
    setForm({ checkIn: '', checkOut: '', guests: '2' })
    setFormError(null)
    setParams(buildParams({ hotelId }))
  }

  const handleBook = (roomType) => {
    const p = new URLSearchParams({ hotelId, roomTypeId: roomType.id, checkIn, checkOut })
    if (guests) p.set('guests', guests)
    navigate(`/shop/book?${p}`)
  }

  if (hotelsQuery.isLoading) return <LoadingState label="Loading rooms…" />
  if (hotelsQuery.isError)
    return <ErrorState message="Could not load hotels." onRetry={hotelsQuery.refetch} />
  if (!hotels || hotels.length === 0)
    return <EmptyState title="No hotels available right now" description="Please check back later." />

  if (hotels.length > 1 && !hotelParam) {
    return (
      <PropertyPicker
        kind="hotel"
        heading="Choose a hotel"
        properties={hotels}
        buildLink={(h) => `/shop/rooms?${buildParams({ hotelId: h.id, checkIn, checkOut, guests })}`}
      />
    )
  }

  const active = hasDates ? availabilityQuery : typesQuery
  const list = hasDates ? availabilityQuery.data?.room_types : typesQuery.data

  return (
    <div>
      <form className="cx-search cx-search--inline" onSubmit={handleSearch} noValidate>
        {hotels.length > 1 && (
          <div>
            <label className="cx-label" htmlFor="rooms-hotel">Hotel</label>
            <select
              id="rooms-hotel"
              className="cx-input"
              value={hotelId}
              onChange={(e) => setParams(buildParams({ hotelId: e.target.value, checkIn, checkOut, guests }))}
            >
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="cx-label" htmlFor="rooms-check-in">Check-in</label>
          <input id="rooms-check-in" type="date" min={today} className="cx-input" value={form.checkIn}
            onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
        </div>
        <div>
          <label className="cx-label" htmlFor="rooms-check-out">Check-out</label>
          <input id="rooms-check-out" type="date" min={form.checkIn || today} className="cx-input" value={form.checkOut}
            onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
        </div>
        <div>
          <label className="cx-label" htmlFor="rooms-guests">Guests</label>
          <select id="rooms-guests" className="cx-input" value={form.guests}
            onChange={(e) => setForm({ ...form, guests: e.target.value })}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="cx-btn cx-btn-primary">Check availability</button>
          {hasDates && <button type="button" className="cx-btn cx-btn-ghost" onClick={handleClear}>Clear</button>}
        </div>
        {formError && <p className="cx-form-error">{formError}</p>}
      </form>

      {active.isLoading ? (
        <LoadingState label={hasDates ? 'Checking availability…' : 'Loading rooms…'} />
      ) : active.isError ? (
        <ErrorState
          message={active.error?.response?.data?.message || 'Could not load rooms.'}
          onRetry={active.refetch}
        />
      ) : !list || list.length === 0 ? (
        <EmptyState
          title={hasDates ? 'No room types match your search' : 'No rooms listed yet'}
          description={hasDates ? 'Try fewer guests or different dates.' : 'Please check back later.'}
        />
      ) : (
        <div className="cx-grid">
          {list.map((rt) => (
            <RoomTypeCard
              key={rt.id}
              roomType={rt}
              currency={config?.currency}
              availability={hasDates ? rt : undefined}
              onBook={handleBook}
            />
          ))}
        </div>
      )}
    </div>
  )
}