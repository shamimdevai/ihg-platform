import staffClient from '../staffClient'

export async function listRoles() {
  const res = await staffClient.get('/iam/roles')
  return res.data.data // [{ id, name, description, permissions: [{id, code, description}] }]
}

export async function getRole(roleId) {
  const res = await staffClient.get(`/iam/roles/${roleId}`)
  return res.data.data
}

export async function createRole({ name, description }) {
  const res = await staffClient.post('/iam/roles', { name, description })
  return res.data.data
}

export async function updateRole(roleId, { name, description }) {
  const res = await staffClient.put(`/iam/roles/${roleId}`, { name, description })
  return res.data.data
}

// Assumed additive (see chat note) — adds the given permission ids to
// the role without touching any it already holds. Paired with
// removePermission below for the "diff and send both" pattern used by
// PermissionAssignment.jsx.
export async function assignPermissions(roleId, permissionIds) {
  const res = await staffClient.post(`/iam/roles/${roleId}/permissions`, {
    permission_ids: permissionIds,
  })
  return res.data.data
}

export async function removePermission(roleId, permissionId) {
  const res = await staffClient.delete(
    `/iam/roles/${roleId}/permissions/${permissionId}`
  )
  return res.data
}

// Backlog item 5, RESOLVED — DELETE /iam/roles/{role_id} now exists on
// the backend (soft-delete; blocked with a 409 if the role still holds
// the "*" wildcard or is still assigned to any active staff member —
// see the backend endpoint's own docstring). Errors are NOT swallowed
// here — RolesList.jsx reads err.response.data.message directly so the
// specific 409 reason (which staff/how many, or the wildcard block)
// reaches the person instead of a generic failure toast.
export async function deleteRole(roleId) {
  const res = await staffClient.delete(`/iam/roles/${roleId}`)
  return res.data
}