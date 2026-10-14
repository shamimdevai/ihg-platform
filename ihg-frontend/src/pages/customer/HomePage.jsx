import { Link } from 'react-router-dom'
import CustomerHero from '@/components/customer/CustomerHero'
import HomeSearchBar from '@/features/customer/home/HomeSearchBar'
import FeaturedRooms from '@/features/customer/home/FeaturedRooms'
import FeaturedMenu from '@/features/customer/home/FeaturedMenu'
import ServiceTiles from '@/features/customer/home/ServiceTiles'
import { useAppConfig } from '@/hooks/useAppConfig'

export default function HomePage() {
  const { data, isModuleEnabled } = useAppConfig()
  const hotel = isModuleEnabled('hotel')
  const food = isModuleEnabled('restaurant') || isModuleEnabled('delivery')

  return (
    <>
      <CustomerHero
        variant="full"
        title={`Welcome to ${data.company_name || 'our hotel'}`}
        subtitle="Stay, dine and order delivery — browse everything, and sign in only when you're ready to book or order."
        actions={
          <>
            {hotel && <Link to="/shop/rooms" className="cx-btn cx-btn-gold">Book a room</Link>}
            {food && <Link to="/shop/menu" className="cx-btn cx-btn-ghost-light">Order food</Link>}
          </>
        }
      >
        {hotel && <HomeSearchBar />}
      </CustomerHero>

      {hotel && <FeaturedRooms />}
      {food && <FeaturedMenu />}
      <ServiceTiles />
    </>
  )
}