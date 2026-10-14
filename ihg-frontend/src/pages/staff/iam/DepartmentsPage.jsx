import PageHeader from '@/components/layout/PageHeader'
import DepartmentsList from '@/features/staff/iam/departments/DepartmentsList'

export default function DepartmentsPage() {
  return (
    <div>
      <PageHeader
        title="Departments"
        description="Manage the departments staff accounts can belong to."
      />
      <DepartmentsList />
    </div>
  )
}