import { useQuery } from '@tanstack/react-query'
import CustomerSection from '@/components/customer/CustomerSection'
import RoomTypeCard from '@/features/customer/rooms/RoomTypeCard'
import PropertyPicker from '@/features/customer/shared/PropertyPicker'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as publicCatalogApi from '@/api/customer/publicCatalogApi'

// One hotel → featured rooms. Several hotels → a "choose a hotel" picker
// (featured rooms from different hotels would be confusing mixed together).
export default function FeaturedRooms() {
  const { data: config } = useAppConfig()
  const { data: hotels } = useQuery({ queryKey: ['public', 'hotels'], queryFn: publicCatalogApi.listHotels })
  const singleHotelId = hotels?.length === 1 ? hotels[0].id : undefined
  const { data: roomTypes } = useQuery({
    queryKey: ['public', 'room-types', singleHotelId],
    queryFn: () => publicCatalogApi.listRoomTypes(singleHotelId),
    enabled: Boolean(singleHotelId),
  })

  if (hotels && hotels.length > 1) {
    return (
      <CustomerSection title="Our hotels" subtitle="Choose a property to see its rooms.">
        <PropertyPicker kind="hotel" properties={hotels} buildLink={(h) => `/shop/rooms?hotelId=${h.id}`} />
      </CustomerSection>
    )
  }

  if (!roomTypes || roomTypes.length === 0) return null

  return (
    <CustomerSection
      title="Rooms & suites"
      subtitle="Comfortable stays for every kind of trip."
      action={{ to: '/shop/rooms', label: 'See all rooms' }}
    >
      <div className="cx-grid">
        {roomTypes.slice(0, 3).map((rt) => (
          <RoomTypeCard key={rt.id} roomType={rt} currency={config?.currency} />
        ))}
      </div>
    </CustomerSection>
  )
}