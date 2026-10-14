import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as publicCatalogApi from '@/api/customer/publicCatalogApi'

function todayLocal() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// Hero date search → sends the visitor to /shop/rooms with the dates in the URL.
// With several hotels, a hotel dropdown is added and hotelId goes in the URL.
export default function HomeSearchBar() {
  const navigate = useNavigate()
  const today = todayLocal()
  const { data: hotels } = useQuery({ queryKey: ['public', 'hotels'], queryFn: publicCatalogApi.listHotels })
  const multi = (hotels?.length || 0) > 1

  const [hotelId, setHotelId] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState('2')
  const [error, setError] = useState(null)

  const effectiveHotelId = hotelId || hotels?.[0]?.id || ''

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!checkIn || !checkOut) return setError('Please choose both dates.')
    if (checkIn < today) return setError('Check-in cannot be in the past.')
    if (checkOut <= checkIn) return setError('Check-out must be after check-in.')
    setError(null)
    const p = new URLSearchParams({ checkIn, checkOut, guests })
    if (multi && effectiveHotelId) p.set('hotelId', effectiveHotelId)
    navigate(`/shop/rooms?${p}`)
  }

  return (
    <form className={`cx-search${multi ? ' cx-search--4' : ''}`} onSubmit={handleSubmit} noValidate>
      {multi && (
        <div>
          <label className="cx-label" htmlFor="home-hotel">Hotel</label>
          <select id="home-hotel" value={effectiveHotelId} onChange={(e) => setHotelId(e.target.value)} className="cx-input">
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="cx-label" htmlFor="home-check-in">Check-in</label>
        <input id="home-check-in" type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="cx-input" />
      </div>
      <div>
        <label className="cx-label" htmlFor="home-check-out">Check-out</label>
        <input id="home-check-out" type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="cx-input" />
      </div>
      <div>
        <label className="cx-label" htmlFor="home-guests">Guests</label>
        <select id="home-guests" value={guests} onChange={(e) => setGuests(e.target.value)} className="cx-input">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
          ))}
        </select>
      </div>
      <button type="submit" className="cx-btn cx-btn-accent">Search rooms</button>
      {error && <p className="cx-form-error">{error}</p>}
    </form>
  )
}