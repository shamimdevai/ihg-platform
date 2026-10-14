import staffClient from '../staffClient'

// inventory-suppliers — read gated by inventory:supplier:read, write
// (create/update/delete) by inventory:supplier:write (RBAC_MATRIX
// §4.4/§6.4). Currently Admin-only — see inventoryItemsApi.js note.

export async function listSuppliers() {
  const res = await staffClient.get('/inventory/suppliers')
  return res.data.data // [{ id, name, contact_name, email, phone, address, is_active }]
}

export async function getSupplier(supplierId) {
  const res = await staffClient.get(`/inventory/suppliers/${supplierId}`)
  return res.data.data
}

export async function createSupplier(values) {
  const res = await staffClient.post('/inventory/suppliers', values)
  return res.data.data
}

export async function updateSupplier(supplierId, values) {
  const res = await staffClient.put(`/inventory/suppliers/${supplierId}`, values)
  return res.data.data
}

export async function deleteSupplier(supplierId) {
  const res = await staffClient.delete(`/inventory/suppliers/${supplierId}`)
  return res.data
}