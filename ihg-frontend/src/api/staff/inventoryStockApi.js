import staffClient from '../staffClient'

// inventory-stock — read gated by inventory:stock:read, adjustments by
// the named-exception code inventory:stock:adjust (NOT stock:write —
// RBAC_MATRIX §2/§4.4 confirms deliberately no such code exists at all).

export async function listStock() {
  const res = await staffClient.get('/inventory/stock')
  return res.data.data // [{ id, inventory_item_id, quantity_on_hand }]
}

export async function getStock(itemId) {
  const res = await staffClient.get(`/inventory/stock/${itemId}`)
  return res.data.data
}

export async function adjustStock(itemId, { quantity_delta, reason }) {
  const res = await staffClient.post(`/inventory/stock/${itemId}/adjust`, {
    quantity_delta,
    ...(reason ? { reason } : {}),
  })
  return res.data.data // includes balance_after, transaction_type, created_at, etc.
}

export async function listStockTransactions(itemId) {
  const res = await staffClient.get(`/inventory/stock/${itemId}/transactions`)
  return res.data.data
}