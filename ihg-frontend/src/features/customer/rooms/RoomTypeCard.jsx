import CustomerCard from '@/components/customer/CustomerCard'
import CustomerBadge from '@/components/customer/CustomerBadge'
import { formatMoney } from '@/components/customer/formatMoney'

// A room type. `availability` is optional ({ available_rooms, nights,
// estimated_total }) — present only after a date search.
export default function RoomTypeCard({ roomType, currency, availability, onBook }) {
  const amenities = (roomType.amenities || '').split(',').map((a) => a.trim()).filter(Boolean)
  const soldOut = availability && availability.available_rooms === 0

  let badge = null
  if (availability) {
    if (soldOut) badge = <CustomerBadge tone="red">Sold out</CustomerBadge>
    else if (availability.available_rooms <= 2)
      badge = <CustomerBadge tone="gold">Only {availability.available_rooms} left</CustomerBadge>
    else badge = <CustomerBadge tone="teal">Available</CustomerBadge>
  }

  return (
    <CustomerCard
      image={roomType.image_url}
      title={roomType.name}
      subtitle={`Sleeps up to ${roomType.capacity}`}
      badge={badge}
      footer={
        <>
          <div>
            <div className="cx-price">{formatMoney(roomType.base_rate, currency)} <span className="cx-muted" style={{ fontWeight: 400, fontSize: '0.8rem' }}>/ night</span></div>
            {availability && (
              <div className="cx-muted" style={{ fontSize: '0.8rem' }}>
                {availability.nights} {availability.nights === 1 ? 'night' : 'nights'}: {formatMoney(availability.estimated_total, currency)}
              </div>
            )}
          </div>
          {availability ? (
            <button className="cx-btn cx-btn-accent" disabled={soldOut} onClick={() => onBook?.(roomType)}>
              Book now
            </button>
          ) : (
            <span className="cx-muted" style={{ fontSize: '0.8rem' }}>Pick dates to book</span>
          )}
        </>
      }
    >
      {roomType.description && (
        <p className="cx-muted" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>{roomType.description}</p>
      )}
      {amenities.length > 0 && (
        <div className="cx-chips">
          {amenities.map((a) => (
            <span key={a} className="cx-chip">{a}</span>
          ))}
        </div>
      )}
    </CustomerCard>
  )
}