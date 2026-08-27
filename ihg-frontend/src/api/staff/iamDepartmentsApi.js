import staffClient from '../staffClient'

// Only the list read is needed for Phase 7 (StaffForm's optional
// department dropdown + StaffList's department-name lookup). Full CRUD
// belongs to Phase 9 (iam-departments tag) — do not extend this file
// further until that phase's OpenAPI slice is provided.
export async function listDepartments() {
  const res = await staffClient.get('/iam/departments')
  return res.data.data // [{ id, name, description }]
}