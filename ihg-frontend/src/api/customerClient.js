import axios from 'axios'
import { useCustomerAuthStore } from '../store/customerAuthStore'

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

export default customerClient