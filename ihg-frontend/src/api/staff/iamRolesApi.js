import staffClient from '../staffClient'

// Only the list read is needed for Phase 7 (StaffForm's role dropdown +
// StaffList's role-name lookup). Full CRUD + permission-assignment
// endpoints belong to Phase 8 (iam-roles tag) — do not extend this file
// further until that phase's OpenAPI slice is provided.
export async function listRoles() {
  const res = await staffClient.get('/iam/roles')
  return res.data.data // [{ id, name, description, permissions: [{ id, code, description }] }]
}