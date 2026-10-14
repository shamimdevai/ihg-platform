import staffClient from '../staffClient'

// iam-departments — read gated by iam:departments:read, write by
// iam:departments:write (RBAC_MATRIX §4.2/§6.2).
//
// NOTE: written fresh this session — see the conflict flagged in chat
// re: this file being 0 bytes in the uploaded zip despite PROGRESS.md
// describing a real Phase 7 version. Reconcile if that version exists.

export async function listDepartments() {
  const res = await staffClient.get('/iam/departments')
  return res.data.data // [{ id, name, description }]
}

export async function getDepartment(departmentId) {
  const res = await staffClient.get(`/iam/departments/${departmentId}`)
  return res.data.data
}

export async function createDepartment({ name, description }) {
  const res = await staffClient.post('/iam/departments', { name, description })
  return res.data.data
}

export async function updateDepartment(departmentId, { name, description }) {
  const res = await staffClient.put(`/iam/departments/${departmentId}`, {
    name,
    description,
  })
  return res.data.data
}

// Backlog item 6, RESOLVED — DELETE /iam/departments/{department_id}
// now exists on the backend (soft-delete; blocked with a 409 if any
// active staff member is still assigned to it — see the backend
// endpoint's own docstring). Errors are NOT swallowed here —
// DepartmentsList.jsx reads err.response.data.message directly so the
// specific 409 reason reaches the person instead of a generic failure.
export async function deleteDepartment(departmentId) {
  const res = await staffClient.delete(`/iam/departments/${departmentId}`)
  return res.data
}