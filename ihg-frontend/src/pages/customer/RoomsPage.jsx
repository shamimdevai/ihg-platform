import CustomerHero from '@/components/customer/CustomerHero'
import RoomsBrowse from '@/features/customer/rooms/RoomsBrowse'

export default function RoomsPage() {
  return (
    <div>
      <CustomerHero
        title="Rooms & suites"
        subtitle="Choose your dates to see what's available. You only need to sign in when you book."
      />
      <RoomsBrowse />
    </div>
  )
}