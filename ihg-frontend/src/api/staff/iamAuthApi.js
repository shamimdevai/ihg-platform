import staffClient from '../staffClient'

// All staff auth endpoints — login, own-profile, refresh, logout(-all),
// forgot/reset/change password, accept-invite. Staff never self-register
// (see Global Context Prompt) — there is deliberately no `register` call
// here.

export async function login({ email, password }) {
  const res = await staffClient.post('/iam/auth/login', { email, password })
  return res.data.data // { access_token, refresh_token, token_type, expires_in }
}

// Gated by authentication only (get_current_staff_user), not by any
// require_permission — every staff member can call this regardless of
// iam:staff:read/iam:roles:read. Requires the backend_patch_staff_me
// patch to be applied (see brief) — flagged to the user separately.
export async function getMyProfile() {
  const res = await staffClient.get('/iam/auth/me')
  return res.data.data // { id, email, first_name, last_name, ..., role: { permissions: [...] } }
}

export async function refresh({ refreshToken }) {
  const res = await staffClient.post('/iam/auth/refresh', {
    refresh_token: refreshToken,
  })
  return res.data.data
}

export async function logout({ refreshToken }) {
  const res = await staffClient.post('/iam/auth/logout', {
    refresh_token: refreshToken,
  })
  return res.data
}

export async function logoutAll() {
  const res = await staffClient.post('/iam/auth/logout-all')
  return res.data.data // { sessions_revoked }
}

export async function forgotPassword({ email }) {
  const res = await staffClient.post('/iam/auth/forgot-password', { email })
  return res.data
}

export async function resetPassword({ token, newPassword }) {
  const res = await staffClient.post('/iam/auth/reset-password', {
    token,
    new_password: newPassword,
  })
  return res.data
}

export async function changePassword({ currentPassword, newPassword }) {
  const res = await staffClient.post('/iam/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return res.data
}

export async function acceptInvite({ token, newPassword }) {
  const res = await staffClient.post('/iam/auth/accept-invite', {
    token,
    new_password: newPassword,
  })
  return res.data
}