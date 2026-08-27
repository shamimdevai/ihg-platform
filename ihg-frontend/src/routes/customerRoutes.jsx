import { Routes, Route, Navigate } from 'react-router-dom'
import CustomerProtectedRoute from './CustomerProtectedRoute'
import CustomerLayout from '../layouts/CustomerLayout'
import RouteComingSoon from '../components/RouteComingSoon'

import RegisterPage from '../pages/customer/RegisterPage'
import LoginPage from '../pages/customer/LoginPage'
import VerifyEmailPage from '../pages/customer/VerifyEmailPage'
import ForgotPasswordPage from '../pages/customer/ForgotPasswordPage'
import ResetPasswordPage from '../pages/customer/ResetPasswordPage'

export default function CustomerRoutes() {
  return (
    <Routes>
      {/* Public — no auth required. Must stay reachable WITHOUT
          CustomerProtectedRoute, or an unauthenticated visitor trying to
          register/log in would be redirect-looped back to login. */}
      <Route path="register" element={<RegisterPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="verify-email" element={<VerifyEmailPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />

      {/* Protected — everything below requires a valid customer session.
          No real content yet (Phases 26–29 fill these in); this phase
          only needs the shell + working reserved routes. */}
      <Route
        element={
          <CustomerProtectedRoute>
            <CustomerLayout />
          </CustomerProtectedRoute>
        }
      >
        <Route index element={<RouteComingSoon title="Welcome" />} />
        <Route path="menu" element={<RouteComingSoon title="Menu" />} />
        <Route path="cart" element={<RouteComingSoon title="Cart" />} />
        <Route path="checkout" element={<RouteComingSoon title="Checkout" />} />
        <Route path="orders" element={<RouteComingSoon title="My Orders" />} />
        <Route path="orders/:orderId" element={<RouteComingSoon title="Order Tracking" />} />
        <Route path="addresses" element={<RouteComingSoon title="Addresses" />} />
        <Route path="profile" element={<RouteComingSoon title="Profile" />} />
      </Route>

      <Route path="*" element={<Navigate to="/shop" replace />} />
    </Routes>
  )
}