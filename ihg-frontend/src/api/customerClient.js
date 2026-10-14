import axios from 'axios'
import { useCustomerAuthStore } from '../store/customerAuthStore'
import * as authApi from './customer/authApi'
import { attachAuthRefreshInterceptor } from './authRefreshInterceptor'
import { redirectToLogin } from '../lib/authRedirect'

// KNOWN MAINTENANCE CONCERN, left as-is (confirmed acceptable) — same
// circular-import shape as staffClient.js/iamAuthApi.js above, between
// this file and ./customer/authApi.js. See that file's comment for the
// full reasoning; applies identically here.

// CUSTOMER-only client — never attach a staff token here (see Global
// Context Prompt, AUTH section). Same relative baseURL convention as
// staffClient; nginx is the single entrypoint (see Phase 0).
const customerClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

customerClient.interceptors.request.use((config) => {
  const token = useCustomerAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Backlog item 1: 401 → refresh → retry-once. No impersonation concept
// on the customer side — simpler than staffClient's version.
attachAuthRefreshInterceptor(customerClient, {
  getAccessToken: () => useCustomerAuthStore.getState().accessToken,
  getRefreshToken: () => useCustomerAuthStore.getState().refreshToken,
  doRefresh: (refreshToken) => authApi.refresh({ refreshToken }),
  onRefreshed: (tokens) => {
    useCustomerAuthStore.setState({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    })
  },
  onRefreshFailed: () => {
    useCustomerAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
    redirectToLogin('/shop/login', { state: { sessionExpired: true } })
  },
  excludedUrls: [
    '/customers/auth/register',
    '/customers/auth/login',
    '/customers/auth/refresh',
    '/customers/auth/verify-email',
    '/customers/auth/resend-verification',
    '/customers/auth/forgot-password',
    '/customers/auth/reset-password',
  ],
})

export default customerClient