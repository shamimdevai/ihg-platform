import staffClient from '../staffClient'

// Staff CRUD + invite (iam-staff tag). Staff records only carry
// role_id/department_id, not names — see iamRolesApi.js/
// iamDepartmentsApi.js for the read-only list calls StaffList/StaffForm
// use to resolve names for display and populate the dropdowns.

export async function listStaff() {
  const res = await staffClient.get('/iam/staff')
  return res.data.data // array of staff records
}

export async function getStaff(staffId) {
  const res = await staffClient.get(`/iam/staff/${staffId}`)
  return res.data.data
}

export async function createStaff({ email, firstName, lastName, roleId, departmentId }) {
  const res = await staffClient.post('/iam/staff', {
    email,
    first_name: firstName,
    last_name: lastName,
    role_id: roleId,
    department_id: departmentId ?? null,
  })
  return res.data.data
}

export async function updateStaff(staffId, { firstName, lastName, roleId, departmentId }) {
  const res = await staffClient.put(`/iam/staff/${staffId}`, {
    first_name: firstName,
    last_name: lastName,
    role_id: roleId,
    department_id: departmentId ?? null,
  })
  return res.data.data
}

export async function deactivateStaff(staffId) {
  const res = await staffClient.delete(`/iam/staff/${staffId}`)
  return res.data // { success, message: 'Staff account deactivated.', data: null }
}

export async function resendInvite(staffId) {
  const res = await staffClient.post(`/iam/staff/${staffId}/invite`)
  return res.data // { success, message: 'Invite email resent.', data: null }
}