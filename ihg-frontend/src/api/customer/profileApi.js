import customerClient from '../customerClient'

// CONFLICT FLAGGED: this phase's given slice documents these at
// `/customers/me`, while RBAC_MATRIX v7 §6.3 documents the same
// resource at `/customers` (no `/me/`) — same class of discrepancy as
// addressesApi.js above, same resolution (built against what was
// actually given this session; confirm the true live path with the
// backend owner before production).
//
// CONFIRMED FROM SCHEMA: `PUT /customers/me`'s request body only
// accepts first_name/last_name/phone — there is NO email field. Email
// is not editable through this endpoint at all, so there is no
// re-verification flow to build for an email change here — this is a
// confirmed absence, not an assumption. ProfileForm.jsx renders email
// as read-only for this reason.

export async function getMyProfile() {
  const res = await customerClient.get('/customers/me')
  return res.data.data
  // { id, email, phone, first_name, last_name, email_verified_at, is_active }
}

export async function updateMyProfile({ firstName, lastName, phone }) {
  const res = await customerClient.put('/customers/me', {
    first_name: firstName ?? null,
    last_name: lastName ?? null,
    phone: phone ?? null,
  })
  return res.data.data
}