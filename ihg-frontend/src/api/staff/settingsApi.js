import staffClient from '../staffClient'

// settings — read gated by settings:read (Admin + Manager, RBAC_MATRIX
// v7 §5.1), write gated by settings:write (Admin-only). GET /settings
// returns full metadata per row (value, value_type, description,
// is_public, id, key, updated_by_staff_id) — this is what both
// BrandingForm and ModuleTogglesForm read from, rather than GET
// /config, so a save can preserve each row's existing value_type/
// description instead of guessing blind.
//
// IMPORTANT, confirmed from the real PUT /settings/{key} request
// schema: this is a full UPSERT, not a partial patch — only `value`/
// `value_type` are required; `is_public` defaults to `false` and
// `description` defaults to null when omitted. This means every write
// in this phase must ALWAYS explicitly re-send `is_public: true` for
// branding/module keys, or the row would silently flip to non-public
// and vanish from GET /config on the very next save. Never omit it.

export async function listSettings() {
  const res = await staffClient.get('/settings')
  return res.data.data // [{ id, key, value, value_type, description, is_public, updated_by_staff_id }]
}

export async function getSetting(key) {
  // Real, in-scope endpoint — included for completeness even though
  // this phase's UI reads via listSettings() instead (that call returns
  // full row metadata; this one only returns { key, value }). Not
  // currently called from anywhere in this phase's files — flagged
  // rather than silently omitted, same "real but unwired" treatment as
  // Phase 10's linkGuestToCustomer().
  const res = await staffClient.get(`/settings/${key}`)
  return res.data.data // { key, value }
}

export async function upsertSetting(key, { value, value_type, description = null, is_public }) {
  const res = await staffClient.put(`/settings/${key}`, {
    value,
    value_type,
    description,
    is_public,
  })
  return res.data.data
}