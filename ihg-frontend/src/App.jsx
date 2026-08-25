import { Routes, Route, Navigate } from 'react-router-dom'

// Placeholder only — Phase 1 wraps this in the /config bootstrap gate,
// and Phases 2/3/5/6 replace these placeholders with the real
// StaffProtectedRoute / CustomerProtectedRoute route trees.
function AdminPlaceholder() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy">Staff Portal</h1>
      <p className="text-gray-600 mt-2">
        /admin route tree — real routes land in later phases.
      </p>
    </div>
  )
}

function ShopPlaceholder() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy">Customer Storefront</h1>
      <p className="text-gray-600 mt-2">
        /shop route tree — real routes land in later phases.
      </p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/*" element={<AdminPlaceholder />} />
      <Route path="/shop/*" element={<ShopPlaceholder />} />
    </Routes>
  )
}