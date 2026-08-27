import customerClient from '../customerClient'

// Customer self-signup flow — register (self-signup, NOT auto-login) →
// verify-email → login. Unlike staff, there is no "me" endpoint in this
// tag; login returns tokens only. See Phase 3 notes for how the store
// handles the resulting gap (user: null until Phase 29's profile fetch).

export async function register({ email, password, firstName, lastName, phone }) {
  const res = await customerClient.post('/customers/auth/register', {
    email,
    password,
    first_name: firstName,
    last_name: lastName,
    phone: phone ?? null,
  })
  return res.data.data // full profile object, NOT tokens — does not log the user in
}

export async function verifyEmail({ token }) {
  const res = await customerClient.post('/customers/auth/verify-email', { token })
  return res.data.data
}

export async function resendVerification({ email }) {
  const res = await customerClient.post('/customers/auth/resend-verification', { email })
  return res.data
}

export async function login({ email, password }) {
  const res = await customerClient.post('/customers/auth/login', { email, password })
  return res.data.data // { access_token, refresh_token, token_type, expires_in } — no profile
}

export async function refresh({ refreshToken }) {
  const res = await customerClient.post('/customers/auth/refresh', {
    refresh_token: refreshToken,
  })
  return res.data.data
}

export async function logout({ refreshToken }) {
  const res = await customerClient.post('/customers/auth/logout', {
    refresh_token: refreshToken,
  })
  return res.data
}

export async function forgotPassword({ email }) {
  const res = await customerClient.post('/customers/auth/forgot-password', { email })
  return res.data
}

export async function resetPassword({ token, newPassword }) {
  const res = await customerClient.post('/customers/auth/reset-password', {
    token,
    new_password: newPassword,
  })
  return res.data
}

// In the tag, but no UI form built this phase per the DELIVERABLE list —
// belongs with Phase 29's authenticated self-service profile screen.
export async function changePassword({ currentPassword, newPassword }) {
  const res = await customerClient.post('/customers/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return res.data
}