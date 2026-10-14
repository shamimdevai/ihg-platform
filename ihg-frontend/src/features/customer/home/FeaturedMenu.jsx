import { Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import CustomerSection from '@/components/customer/CustomerSection'
import CustomerCard from '@/components/customer/CustomerCard'
import CustomerBadge from '@/components/customer/CustomerBadge'
import { formatMoney } from '@/components/customer/formatMoney'
import PropertyPicker from '@/features/customer/shared/PropertyPicker'
import { useAppConfig } from '@/hooks/useAppConfig'
import * as menuApi from '@/api/customer/menuApi'

function dealLabel(item) {
  return item.discount_type === 'percentage'
    ? `${Number(item.discount_value)}% OFF`
    : `${formatMoney(item.discount_value)} OFF`
}

// Home page: real discounted items as "Special offers" (data from the
// menu-item discount feature), plus a short menu highlights row.
// Banner/room promotions arrive with the promotions feature (Phase 6).
export default function FeaturedMenu() {
  const { data: config } = useAppConfig()
  const currency = config?.currency
  const { data: restaurants } = useQuery({ queryKey: ['public', 'restaurants'], queryFn: menuApi.listRestaurants })
  // Several restaurants → show a picker instead of mixing their menus.
  const restaurantId = restaurants?.length === 1 ? restaurants[0].id : undefined
  const { data: items } = useQuery({
    queryKey: ['public', 'menu-items', restaurantId],
    queryFn: () => menuApi.listMenuItems({ restaurantId, isAvailable: true }),
    enabled: Boolean(restaurantId),
  })

  if (restaurants && restaurants.length > 1) {
    return (
      <CustomerSection title="Our restaurants" subtitle="Choose a restaurant to see its menu." tone="sky">
        <PropertyPicker kind="restaurant" properties={restaurants} buildLink={(r) => `/shop/menu?restaurantId=${r.id}`} />
      </CustomerSection>
    )
  }

  if (!items || items.length === 0) return null

  const deals = items.filter((i) => i.discount_active).slice(0, 3)
  const highlights = items.filter((i) => !i.discount_active).slice(0, 6)

  return (
    <Fragment>
      {deals.length > 0 && (
        <CustomerSection
          title="Special offers"
          subtitle="Limited-time prices on guest favourites."
          tone="blush"
          action={{ to: '/shop/menu', label: 'See full menu' }}
        >
          <div className="cx-grid">
            {deals.map((item) => (
              <CustomerCard
                key={item.id}
                image={item.image_url}
                title={item.name}
                badge={<CustomerBadge tone="red">{dealLabel(item)}</CustomerBadge>}
                footer={
                  <div>
                    <span className="cx-price-old">{formatMoney(item.price, currency)}</span>
                    <span className="cx-price-deal">{formatMoney(item.effective_price, currency)}</span>
                  </div>
                }
              />
            ))}
          </div>
        </CustomerSection>
      )}

      {highlights.length > 0 && (
        <CustomerSection
          title="From our kitchen"
          subtitle="A taste of what's on the menu."
          tone="sky"
          action={{ to: '/shop/menu', label: 'Order now' }}
        >
          <div className="cx-grid">
            {highlights.map((item) => (
              <CustomerCard
                key={item.id}
                image={item.image_url}
                title={item.name}
                subtitle={item.description}
                footer={<span className="cx-price">{formatMoney(item.price, currency)}</span>}
              />
            ))}
          </div>
        </CustomerSection>
      )}
    </Fragment>
  )
}