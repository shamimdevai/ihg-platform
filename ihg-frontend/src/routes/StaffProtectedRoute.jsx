import { Navigate, useLocation } from 'react-router-dom'
import { useStaffAuth } from '../hooks/useStaffAuth'

// Wraps any /admin route. Redirects to staff login if unauthenticated.
// Accepts an optional `requiredPermission` for route-level gating — per
// the Global Context Prompt, hiding a nav item is NOT sufficient on its
// own; every gated route must also be guarded here, since a determined
// user could navigate directly to the URL.
export default function StaffProtectedRoute({
  children,
  requiredPermission,
}) {
  const { isAuthenticated, can } = useStaffAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  if (requiredPermission && !can(requiredPermission)) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold text-red mb-2">Access denied</h1>
        <p className="text-gray-600">
          You don't have permission to view this page.
        </p>
      </div>
    )
  }

  return children
}