import axios from 'axios'

// Deliberately raw `axios` calls, NOT the shared `staffClient` instance.
// Both calls here need an explicit, caller-supplied bearer token rather
// than whatever staffClient's interceptor would currently attach:
//   - impersonate() must be called with the SUPERADMIN's own token
//     (backend enforces staff_id === caller's own id — RBAC_MATRIX
//     §1/§6.2/§7 — you may only impersonate AS yourself)
//   - getImpersonatedProfile() must be called with the freshly-issued
//     IMPERSONATION token, to fetch the target's own /iam/auth/me
//     response, not the superadmin's
// Routing either through staffClient's interceptor would also create a
// circular import (staffClient -> impersonationStore -> this file ->
// staffClient) — using raw axios here avoids that entirely, so only
// staffClient.js itself needs to import impersonationStore (see its
// own comment).

export async function impersonate({ staffId, targetType, targetId, accessToken }) {
  const res = await axios.post(
    `/api/v1/iam/staff/${staffId}/impersonate/${targetType}/${targetId}`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  return res.data.data // { access_token, refresh_token, token_type, expires_in }
}

export async function getImpersonatedProfile(accessToken) {
  const res = await axios.get('/api/v1/iam/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res.data.data
}