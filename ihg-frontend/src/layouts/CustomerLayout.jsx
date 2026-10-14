import { useEffect, useState } from 'react'
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom'
import { RotateCw } from 'lucide-react'
import { useCustomerAuth } from '@/hooks/useCustomerAuth'
import { useAppConfig } from '@/hooks/useAppConfig'
import { useCartStore, selectCartCount } from '@/store/cartStore'
import '@/theme/customerTheme.css'

// Public shell for the whole customer site. Browsing (home, rooms, menu,
// cart) works logged out; only the account pages are behind login (see
// customerRoutes.jsx). All styling comes from theme/customerTheme.css.

function navClass({ isActive }) {
  return `cx-nav-link${isActive ? ' cx-nav-link--active' : ''}`
}

function CartLink() {
  const count = useCartStore(selectCartCount)
  return (
    <NavLink to="/shop/cart" className={navClass}>
      Cart{count > 0 ? ` (${count})` : ''}
    </NavLink>
  )
}

function displayName(user) {
  if (!user) return null
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return name || user.email || null
}

export default function CustomerLayout() {
  const { isAuthenticated, user, logout, fetchProfile } = useCustomerAuth()
  const { data, isModuleEnabled } = useAppConfig()
  const navigate = useNavigate()
  const [retrying, setRetrying] = useState(false)

  // Profile fetch once per mount while logged in with no user loaded
  // (same behaviour as before this layout went public).
  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const handleRetryProfile = async () => {
    setRetrying(true)
    await fetchProfile()
    setRetrying(false)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/shop', { replace: true })
  }

  const links = [{ to: '/shop', label: 'Home', end: true }]
  if (isModuleEnabled('hotel')) links.push({ to: '/shop/rooms', label: 'Rooms' })
  if (isModuleEnabled('restaurant') || isModuleEnabled('delivery')) {
    links.push({ to: '/shop/menu', label: 'Menu' })
  }
  if (isAuthenticated) {
    links.push(
      { to: '/shop/orders', label: 'My Orders' },
      { to: '/shop/addresses', label: 'Addresses' },
      { to: '/shop/profile', label: 'Profile' }
    )
  }

  const name = displayName(user)
  const companyName = data.company_name || 'IHG Platform'

  return (
    <div className="customer-shell">
      <header className="cx-header">
        <div className="cx-container cx-header-inner">
          <Link to="/shop" className="cx-brand">
            {data.logo_url && (
              <img
                src={data.logo_url}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
            <span>{companyName}</span>
          </Link>

          <nav className="cx-nav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>
                {l.label}
              </NavLink>
            ))}
            <CartLink />
          </nav>

          <div className="cx-header-actions">
            {isAuthenticated ? (
              <>
                {name ? (
                  <span className="cx-muted" style={{ fontSize: '0.875rem' }}>
                    {name}
                  </span>
                ) : (
                  <button
                    onClick={handleRetryProfile}
                    disabled={retrying}
                    className="cx-nav-link"
                    title="Couldn't load your name — click to retry"
                  >
                    My Account <RotateCw className={`inline h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <button className="cx-btn cx-btn-ghost" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/shop/login" className="cx-btn cx-btn-ghost">
                  Sign in
                </Link>
                <Link to="/shop/register" className="cx-btn cx-btn-gold">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>

        <nav className="cx-mobile-nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>
              {l.label}
            </NavLink>
          ))}
          <CartLink />
        </nav>
      </header>

      <main className="cx-main">
        <Outlet />
      </main>

      <footer className="cx-footer">
        <div className="cx-container">
          <strong>{companyName}</strong>
          {data.footer_text && <p style={{ marginTop: '0.35rem' }}>{data.footer_text}</p>}
        </div>
      </footer>
    </div>
  )
}