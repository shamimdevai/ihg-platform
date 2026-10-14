import staffClient from '../staffClient'

// inventory-items — read gated by inventory:item:read, write (create/
// update/delete) by inventory:item:write (RBAC_MATRIX §4.4/§6.4).
// Currently Admin-only in DEFAULT_ROLES — no other seeded role holds
// either code (RBAC_MATRIX §5.1/§5.2, PROGRESS.md Resolved item 10).
//
// NOTE: written fresh this session — the zip's copy of this file (and
// every other Phase 11 file) is 0 bytes despite this being the current
// phase; flagged in chat, same recurring pattern as Phases 7-10.

export async function listItems() {
  const res = await staffClient.get('/inventory/items')
  return res.data.data // [{ id, name, unit, sku, description, category, reorder_threshold, default_supplier_id, is_active }]
}

export async function getItem(itemId) {
  const res = await staffClient.get(`/inventory/items/${itemId}`)
  return res.data.data
}

export async function createItem(values) {
  const res = await staffClient.post('/inventory/items', values)
  return res.data.data
}

export async function updateItem(itemId, values) {
  const res = await staffClient.put(`/inventory/items/${itemId}`, values)
  return res.data.data
}

export async function deleteItem(itemId) {
  const res = await staffClient.delete(`/inventory/items/${itemId}`)
  return res.data // { success, message: 'Item deleted.', data: null }
}