import staffClient from '../staffClient'

// inventory-alerts — read gated by inventory:alert:read, resolve by the
// named-exception code inventory:alert:resolve (RBAC_MATRIX §4.4).
// `status`'s exact enum values are NOT confirmed in this phase's
// OpenAPI slice (schema only shows the placeholder "status_example") —
// see AlertsList.jsx, which treats the filter as free text rather than
// guessing a dropdown of values.

export async function listAlerts(status) {
  const res = await staffClient.get('/inventory/alerts', {
    params: status ? { status } : undefined,
  })
  return res.data.data
}

export async function resolveAlert(alertId, { resolution_note } = {}) {
  const res = await staffClient.post(`/inventory/alerts/${alertId}/resolve`, {
    resolution_note: resolution_note || null,
  })
  return res.data.data
}