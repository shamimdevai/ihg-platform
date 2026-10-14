import { useLocation } from 'react-router-dom'
import LoginForm from '../../features/staff/auth/LoginForm'

export default function LoginPage() {
  const location = useLocation()
  const sessionExpired = Boolean(location.state?.sessionExpired)
  const loggedOutElsewhere = Boolean(location.state?.loggedOutElsewhere)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-bold text-navy mb-6 text-center">
          Staff Sign In
        </h1>
        {sessionExpired && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Your session expired — please log in again.
          </div>
        )}
        {loggedOutElsewhere && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            You were logged out in another tab or window.
          </div>
        )}
        <LoginForm />
      </div>
    </div>
  )
}