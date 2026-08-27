import { Outlet, Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useCustomerAuth } from '@/hooks/useCustomerAuth'
import { useAppConfig } from '@/hooks/useAppConfig'

// Simple top nav per the Phase 6 brief — Menu, My Orders, Addresses,
// Profile. Cart/Checkout are reserved routes but deliberately NOT in
// top nav (reached via the Menu flow in Phase 26) — see Phase 6 flag #2.
const navLinks = [
  { to: '/shop/menu', label: 'Menu' },
  { to: '/shop/orders', label: 'My Orders' },
  { to: '/shop/addresses', label: 'Addresses' },
  { to: '/shop/profile', label: 'Profile' },
]

export default function CustomerLayout() {
  const { isAuthenticated, logout } = useCustomerAuth()
  const { data } = useAppConfig()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/shop/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 flex items-center justify-between px-4 border-b bg-background">
        <Link to="/shop" className="font-semibold text-primary">
          {data.company_name || 'IHG Platform'}
        </Link>

        <nav className="hidden sm:flex items-center gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div>
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {/* No name/email available yet — customer-auth has no "me"
                  endpoint (Phase 3 flagged gap). Generic label until
                  Phase 29 fetches the real profile. */}
              <span className="text-sm text-muted-foreground">My Account</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/shop/login">
                <Button variant="outline" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/shop/register">
                <Button size="sm">Create account</Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Mobile nav row */}
      <nav className="flex sm:hidden items-center gap-4 px-4 py-2 border-b overflow-x-auto">
        {navLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="text-sm font-medium text-muted-foreground hover:text-foreground whitespace-nowrap"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}