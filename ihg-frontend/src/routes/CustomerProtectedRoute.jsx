import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCustomerAuth } from '../hooks/useCustomerAuth'

// Works both as a wrapper (<CustomerProtectedRoute><X/></...>) and as a
// layout route (renders <Outlet/> when it has no children).
export default function CustomerProtectedRoute({ children }) {
  const { isAuthenticated } = useCustomerAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/shop/login" state={{ from: location }} replace />
  }

  return children ?? <Outlet />
}