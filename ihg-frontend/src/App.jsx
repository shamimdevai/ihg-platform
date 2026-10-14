import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAppConfig } from './hooks/useAppConfig'
import StaffRoutes from './routes/staffRoutes'
import CustomerRoutes from './routes/customerRoutes'
import { registerAuthRedirect } from './lib/authRedirect'
import { startCrossTabAuthSync } from './store/crossTabAuthSync'

function FullPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div
          className="h-10 w-10 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading"
        />
        <p className="mt-4 text-gray-600">Loading…</p>
      </div>
    </div>
  )
}

function FullPageError({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-4">
        <h1 className="text-xl font-bold text-destructive mb-2">
          Unable to load the application
        </h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}

export default function App() {
  const { data, loaded, error, fetchConfig } = useAppConfig()
  const navigate = useNavigate()

  // Registers this App instance's real navigate() as the target for
  // authRefreshInterceptor's forced-logout redirect (backlog item 1) —
  // must happen unconditionally on mount, before the loading/error
  // early-returns below, so a 401 that fires during initial /config
  // load still has somewhere to redirect to.
  useEffect(() => {
    registerAuthRedirect(navigate)
  }, [navigate])

  // Cross-tab auth sync — attaches once per page load (see
  // crossTabAuthSync.js's own doc comment for what this covers and
  // why). Also needs to run before the loading/error early-returns
  // below, for the same reason as the registration above.
  useEffect(() => {
    startCrossTabAuthSync()
  }, [])

  useEffect(() => {
    fetchConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loaded) return
    const root = document.documentElement
    if (data.primary_color) {
      root.style.setProperty('--color-primary', data.primary_color)
    }
    if (data.secondary_color) {
      root.style.setProperty('--color-secondary', data.secondary_color)
    }
  }, [loaded, data])

  if (error) {
    return <FullPageError message={error} />
  }

  if (!loaded) {
    return <FullPageLoading />
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/shop" replace />} />
      <Route path="/admin/*" element={<StaffRoutes />} />
      <Route path="/shop/*" element={<CustomerRoutes />} />
      <Route path="*" element={<Navigate to="/shop" replace />} />
    </Routes>
  )
}