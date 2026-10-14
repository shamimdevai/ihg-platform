import { Routes, Route, Navigate } from 'react-router-dom'
import StaffProtectedRoute from './StaffProtectedRoute'
import StaffLayout from '../layouts/StaffLayout'

import LoginPage from '../pages/staff/LoginPage'
import ForgotPasswordPage from '../pages/staff/ForgotPasswordPage'
import ResetPasswordPage from '../pages/staff/ResetPasswordPage'
import AcceptInvitePage from '../pages/staff/AcceptInvitePage'
import DashboardPage from '../pages/staff/DashboardPage'
import DepartmentsPage from '../pages/staff/iam/DepartmentsPage'
import StaffPage from '../pages/staff/iam/StaffPage'
import SettingsPage from '../pages/staff/settings/SettingsPage'
import RolesPage from '../pages/staff/iam/RolesPage'
import GuestsPage from '../pages/staff/customers/GuestsPage'
import ItemsPage from '../pages/staff/inventory/ItemsPage'
import SuppliersPage from '../pages/staff/inventory/SuppliersPage'
import StockPage from '../pages/staff/inventory/StockPage'
import AlertsPage from '../pages/staff/inventory/AlertsPage'
import PaymentsPage from '../pages/staff/payments/PaymentsPage'
import RefundsPage from '../pages/staff/payments/RefundsPage'
import RoomsPage from '../pages/staff/hotel/RoomsPage'
import BookingsPage from '../pages/staff/hotel/BookingsPage'
import HousekeepingPage from '../pages/staff/hotel/HousekeepingPage'
import InvoicesPage from '../pages/staff/hotel/InvoicesPage'
import TablesPage from '../pages/staff/restaurant/TablesPage'
import MenuPage from '../pages/staff/restaurant/MenuPage'
import OrdersPage from '../pages/staff/restaurant/OrdersPage'
import KitchenPage from '../pages/staff/restaurant/KitchenPage'
import DeliveryOrdersPage from '../pages/staff/delivery/OrdersPage'
import DeliveryRidersPage from '../pages/staff/delivery/RidersPage'
import MyDeliveriesPage from '../pages/staff/delivery/MyDeliveriesPage'
import ReportsPage from '../pages/staff/reporting/ReportsPage'

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
              <RolesPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="iam/departments"
          element={
            <StaffProtectedRoute requiredPermission="iam:departments:read">
              <DepartmentsPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="customers/guests"
          element={
            <StaffProtectedRoute requiredPermission="customers:guests:read">
              <GuestsPage />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="hotel/rooms"
          element={
            <StaffProtectedRoute requiredPermission="hotel:room:read">
              <RoomsPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="hotel/bookings"
          element={
            <StaffProtectedRoute requiredPermission="hotel:booking:read">
              <BookingsPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="hotel/housekeeping"
          element={
            <StaffProtectedRoute requiredPermission="hotel:housekeeping:read">
              <HousekeepingPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="hotel/invoices"
          element={
            <StaffProtectedRoute requiredPermission="hotel:invoice:read">
              <InvoicesPage />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="restaurant/tables"
          element={
            <StaffProtectedRoute requiredPermission="restaurant:table:read">
               <TablesPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="restaurant/menu"
          element={
            <StaffProtectedRoute requiredPermission="restaurant:menu:read">
              <MenuPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="restaurant/orders"
          element={
            <StaffProtectedRoute requiredPermission="restaurant:order:read">
              <OrdersPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="restaurant/kitchen"
          element={
            <StaffProtectedRoute requiredPermission="restaurant:kitchen:read">
              <KitchenPage />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="delivery/orders"
          element={
            <StaffProtectedRoute requiredPermission="delivery:rider:write">
              <DeliveryOrdersPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="delivery/riders"
          element={
            <StaffProtectedRoute requiredPermission="delivery:rider:write">
              <DeliveryRidersPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="delivery/my-deliveries"
          element={
            <StaffProtectedRoute requiredPermission="delivery:order:update_status">
              <MyDeliveriesPage />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="inventory/items"
          element={
            <StaffProtectedRoute requiredPermission="inventory:item:read">
              <ItemsPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="inventory/suppliers"
          element={
            <StaffProtectedRoute requiredPermission="inventory:supplier:read">
              <SuppliersPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="inventory/stock"
          element={
            <StaffProtectedRoute requiredPermission="inventory:stock:read">
              <StockPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="inventory/alerts"
          element={
            <StaffProtectedRoute requiredPermission="inventory:alert:read">
              <AlertsPage />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="payments"
          element={
            <StaffProtectedRoute requiredPermission="payments:read">
              <PaymentsPage />
            </StaffProtectedRoute>
          }
        />
        <Route
          path="payments/refunds"
          element={
            <StaffProtectedRoute requiredPermission="payments:refund:review">
              <RefundsPage />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="reporting"
          element={
            <StaffProtectedRoute requiredPermission="reporting:read">
              <ReportsPage />
            </StaffProtectedRoute>
          }
        />

        <Route
          path="settings"
          element={
            <StaffProtectedRoute requiredPermission="settings:read">
              <SettingsPage />
            </StaffProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}