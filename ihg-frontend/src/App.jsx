import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAppConfig } from './hooks/useAppConfig'
import StaffRoutes from './routes/staffRoutes'
import CustomerRoutes from './routes/customerRoutes'

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
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/*" element={<StaffRoutes />} />
      <Route path="/shop/*" element={<CustomerRoutes />} />
    </Routes>
  )
}