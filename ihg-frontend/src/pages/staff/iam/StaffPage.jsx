import PageHeader from '@/components/layout/PageHeader'
import StaffList from '@/features/staff/iam/staff/StaffList'

export default function StaffPage() {
  return (
    <div>
      <PageHeader title="Staff" description="Manage staff accounts, roles, and departments." />
      <StaffList />
    </div>
  )
}