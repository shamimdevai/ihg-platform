import PageHeader from '@/components/layout/PageHeader'
import TaskBoard from '@/features/staff/hotel/housekeeping/TaskBoard'

export default function HousekeepingPage() {
  return (
    <div>
      <PageHeader
        title="Housekeeping"
        description="View your cleaning tasks and update their status."
      />
      <TaskBoard />
    </div>
  )
}