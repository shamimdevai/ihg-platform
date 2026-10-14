import customerClient from '../customerClient'

// CONFLICT FLAGGED, still not silently resolved: this phase's given
// OpenAPI slice (and Phase 27's) both document these endpoints at
// `/customers/me/addresses` — but both the Global Context Prompt's API-
// conventions section and RBAC_MATRIX v7 §6.3 document the same resource
// at `/customers/addresses` (no `/me/` segment). Two independent
// phase-given slices now agree on `/me/`, so this file is built against
// that path — but confirm with the backend owner which is actually live
// before a real production deployment. If it turns out to be
// `/customers/addresses`, only the five `customerClient` calls in this
// file need their path segment updated — nothing else in Phase 27/29
// depends on the exact string.
//
// Phase 27 built list/create only. Phase 29 adds get/update/delete here
// — same file, not recreated, same "extend, don't recreate" rule as
// iamRolesApi.js/iamDepartmentsApi.js.

export async function listAddresses() {
  const res = await customerClient.get('/customers/me/addresses')
  return res.data.data
  // [{ id, customer_id, label, address_line1, address_line2, city,
  //    state, postal_code, country, latitude, longitude, is_default }]
}

export async function getAddress(addressId) {
  const res = await customerClient.get(`/customers/me/addresses/${addressId}`)
  return res.data.data
}

export async function createAddress({
  label,
  addressLine1,
  addressLine2,
  city,
  state,
  postalCode,
  country,
  latitude,
  longitude,
  isDefault,
}) {
  const res = await customerClient.post('/customers/me/addresses', {
    label,
    address_line1: addressLine1,
    address_line2: addressLine2 || null,
    city,
    state: state || null,
    postal_code: postalCode || null,
    country,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    is_default: Boolean(isDefault),
  })
  return res.data.data
}

// PUT is a real partial update (every field optional per the given
// schema) — only send keys that were actually provided, rather than
// forcing every field to null on every edit. Callers pass a plain
// partial object with the same camelCase keys as createAddress().
export async function updateAddress(addressId, values) {
  const body = {}
  if (values.label !== undefined) body.label = values.label
  if (values.addressLine1 !== undefined) body.address_line1 = values.addressLine1
  if (values.addressLine2 !== undefined) body.address_line2 = values.addressLine2 || null
  if (values.city !== undefined) body.city = values.city
  if (values.state !== undefined) body.state = values.state || null
  if (values.postalCode !== undefined) body.postal_code = values.postalCode || null
  if (values.country !== undefined) body.country = values.country
  if (values.latitude !== undefined) body.latitude = values.latitude ?? null
  if (values.longitude !== undefined) body.longitude = values.longitude ?? null
  if (values.isDefault !== undefined) body.is_default = Boolean(values.isDefault)

  const res = await customerClient.put(`/customers/me/addresses/${addressId}`, body)
  return res.data.data
}

export async function deleteAddress(addressId) {
  await customerClient.delete(`/customers/me/addresses/${addressId}`)
}