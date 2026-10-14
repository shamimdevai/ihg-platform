import { Outlet } from 'react-router-dom'

// Padded, centred container for every non-home customer page.
export default function CustomerContent() {
  return (
    <div className="cx-container cx-content">
      <Outlet />
    </div>
  )
}