import { Navigate, useLocation } from 'react-router-dom'
import { useCustomerAuth } from '../hooks/useCustomerAuth'

export default function CustomerProtectedRoute({ children }) {
  const { isAuthenticated } = useCustomerAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/shop/login" state={{ from: location }} replace />
  }

  return children
}