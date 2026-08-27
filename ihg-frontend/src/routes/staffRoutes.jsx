import { Routes, Route, Navigate } from 'react-router-dom'
import StaffProtectedRoute from './StaffProtectedRoute'
import StaffLayout from '../layouts/StaffLayout'

import LoginPage from '../pages/staff/LoginPage'
import ForgotPasswordPage from '../pages/staff/ForgotPasswordPage'
import ResetPasswordPage from '../pages/staff/ResetPasswordPage'
import AcceptInvitePage from '../pages/staff/AcceptInvitePage'
import DashboardPage from '../pages/staff/DashboardPage'
import StaffPage from '../pages/staff/iam/StaffPage'
import RouteComingSoon from '../components/RouteComingSoon'

// Every reserved (not-yet-built) route below is wrapped in its own
// StaffProtectedRoute with the real requiredPermission from navConfig.js
// — the route guard AND the nav-hiding both exist, per the Global
// Context Prompt ("hiding UI alone is not sufficient gating").
export default function StaffRoutes() {
  return (
    <Routes>
      {/* Public — no auth required */}
      <Route path="login" element={<LoginPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route path="accept-invite" element={<AcceptInvitePage />} />

      {/* Protected — everything below requires a valid staff session */}
      <Route
        element={
          <StaffProtectedRoute>
            <StaffLayout />
          </StaffProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />

        <Route
          path="iam/staff"
          element={
            <StaffProtectedRoute requiredPermission="iam:staff:read">
              <StaffPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="iam/roles"
          element={
            <StaffProtectedRoute requiredPermission="iam:roles:read">
              <RouteComingSoon title="Roles & Permissions" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="iam/departments"
          element={
            <StaffProtectedRoute requiredPermission="iam:departments:read">
              <RouteComingSoon title="Departments" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="iam/impersonation"
          element={
            <StaffProtectedRoute>
              <RouteComingSoon title="Impersonation" />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="customers/guests"
          element={
            <StaffProtectedRoute requiredPermission="customers:guests:read">
              <RouteComingSoon title="Hotel Guests" />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="hotel/rooms"
          element={
            <StaffProtectedRoute requiredPermission="hotel:room:read">
              <RouteComingSoon title="Rooms" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="hotel/bookings"
          element={
            <StaffProtectedRoute requiredPermission="hotel:booking:read">
              <RouteComingSoon title="Bookings" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="hotel/housekeeping"
          element={
            <StaffProtectedRoute requiredPermission="hotel:housekeeping:read">
              <RouteComingSoon title="Housekeeping" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="hotel/invoices"
          element={
            <StaffProtectedRoute requiredPermission="hotel:invoice:read">
              <RouteComingSoon title="Invoices" />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="restaurant/tables"
          element={
            <StaffProtectedRoute requiredPermission="restaurant:table:read">
              <RouteComingSoon title="Tables & Reservations" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="restaurant/menu"
          element={
            <StaffProtectedRoute requiredPermission="restaurant:menu:read">
              <RouteComingSoon title="Menu" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="restaurant/orders"
          element={
            <StaffProtectedRoute requiredPermission="restaurant:order:read">
              <RouteComingSoon title="Orders" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="restaurant/kitchen"
          element={
            <StaffProtectedRoute requiredPermission="restaurant:kitchen:read">
              <RouteComingSoon title="Kitchen" />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="delivery/orders"
          element={
            <StaffProtectedRoute requiredPermission="delivery:rider:write">
              <RouteComingSoon title="Orders & Dispatch" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="delivery/riders"
          element={
            <StaffProtectedRoute requiredPermission="delivery:rider:write">
              <RouteComingSoon title="Riders" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="delivery/my-deliveries"
          element={
            <StaffProtectedRoute requiredPermission="delivery:order:update_status">
              <RouteComingSoon title="My Deliveries" />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="inventory/items"
          element={
            <StaffProtectedRoute requiredPermission="inventory:item:read">
              <RouteComingSoon title="Inventory Items" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="inventory/suppliers"
          element={
            <StaffProtectedRoute requiredPermission="inventory:supplier:read">
              <RouteComingSoon title="Suppliers" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="inventory/stock"
          element={
            <StaffProtectedRoute requiredPermission="inventory:stock:read">
              <RouteComingSoon title="Stock" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="inventory/alerts"
          element={
            <StaffProtectedRoute requiredPermission="inventory:alert:read">
              <RouteComingSoon title="Low-Stock Alerts" />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="payments"
          element={
            <StaffProtectedRoute requiredPermission="payments:read">
              <RouteComingSoon title="Payments" />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="payments/refunds"
          element={
            <StaffProtectedRoute requiredPermission="payments:refund:review">
              <RouteComingSoon title="Refund Review" />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="reporting"
          element={
            <StaffProtectedRoute requiredPermission="reporting:read">
              <RouteComingSoon title="Reports" />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="settings"
          element={
            <StaffProtectedRoute requiredPermission="settings:read">
              <RouteComingSoon title="Settings" />
            </StaffProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}