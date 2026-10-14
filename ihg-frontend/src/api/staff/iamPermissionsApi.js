import staffClient from '../staffClient'

// Read-only — there is no permission-creation endpoint (RBAC_MATRIX §4.2:
// permissions can currently only be created via scripts/seed_data.py).

export async function listPermissions() {
  const res = await staffClient.get('/iam/permissions')
  return res.data.data // [{ id, code, description }]
}

export async function getPermission(permissionId) {
  const res = await staffClient.get(`/iam/permissions/${permissionId}`)
  return res.data.data
}