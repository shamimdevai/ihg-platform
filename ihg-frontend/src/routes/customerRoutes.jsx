import { Routes, Route, Navigate } from 'react-router-dom'
import CustomerProtectedRoute from './CustomerProtectedRoute'
import CustomerLayout from '../layouts/CustomerLayout'
import CustomerContent from '../components/customer/CustomerContent'
import RouteComingSoon from '../components/RouteComingSoon'

import RegisterPage from '../pages/customer/RegisterPage'
import LoginPage from '../pages/customer/LoginPage'
import VerifyEmailPage from '../pages/customer/VerifyEmailPage'
import ForgotPasswordPage from '../pages/customer/ForgotPasswordPage'
import ResetPasswordPage from '../pages/customer/ResetPasswordPage'
import HomePage from '../pages/customer/HomePage'
import RoomsPage from '../pages/customer/RoomsPage'
import MenuPage from '../pages/customer/MenuPage'
import CartPage from '../pages/customer/CartPage'
import CheckoutPage from '../pages/customer/CheckoutPage'
import OrderHistoryPage from '../pages/customer/OrderHistoryPage'
import OrderTrackingPage from '../pages/customer/OrderTrackingPage'
import AddressesPage from '../pages/customer/AddressesPage'
import ProfilePage from '../pages/customer/ProfilePage'

export default function CustomerRoutes() {
  return (
    <Routes>
      {/* Auth screens — public, no layout (unchanged). */}
      <Route path="register" element={<RegisterPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="verify-email" element={<VerifyEmailPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />

      {/* Site shell — header/footer/theme for everything below. */}
      <Route element={<CustomerLayout />}>
        {/* PUBLIC, full-width home page */}
        <Route index element={<HomePage />} />

        {/* Padded content pages */}
        <Route element={<CustomerContent />}>
          {/* PUBLIC — browse without logging in */}
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="menu" element={<MenuPage />} />
          <Route path="cart" element={<CartPage />} />

          {/* PROTECTED — login required (returns here afterwards) */}
          <Route element={<CustomerProtectedRoute />}>
            <Route path="book" element={<RouteComingSoon title="Room booking" />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="orders" element={<OrderHistoryPage />} />
            <Route path="orders/:orderId" element={<OrderTrackingPage />} />
            <Route path="addresses" element={<AddressesPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/shop" replace />} />
    </Routes>
  )
}