import { Link } from 'react-router-dom'
import CustomerSection from '@/components/customer/CustomerSection'
import { useAppConfig } from '@/hooks/useAppConfig'

// One tile per ENABLED business line. Text only — no fake data.
export default function ServiceTiles() {
  const { isModuleEnabled } = useAppConfig()
  const tiles = []
  if (isModuleEnabled('hotel'))
    tiles.push({ to: '/shop/rooms', title: 'Stay with us', text: 'Browse rooms and check dates in seconds.', tone: '' })
  if (isModuleEnabled('restaurant'))
    tiles.push({ to: '/shop/menu', title: 'Dine with us', text: 'Explore our full restaurant menu.', tone: 'cx-tile--teal' })
  if (isModuleEnabled('delivery'))
    tiles.push({ to: '/shop/menu', title: 'Delivered to you', text: 'Order from the menu and track it live.', tone: 'cx-tile--red' })

  if (tiles.length === 0) return null

  return (
    <CustomerSection title="Everything in one place">
      <div className="cx-grid">
        {tiles.map((t) => (
          <Link key={t.title} to={t.to} className={`cx-tile ${t.tone}`}>
            <div className="cx-tile-title">{t.title}</div>
            <p className="cx-tile-text">{t.text}</p>
          </Link>
        ))}
      </div>
    </CustomerSection>
  )
}