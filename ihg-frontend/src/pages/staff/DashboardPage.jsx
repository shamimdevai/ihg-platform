import PageHeader from '@/components/layout/PageHeader'
import DashboardHome from '@/features/staff/dashboard/DashboardHome'

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" />
      <DashboardHome />
    </div>
  )
}