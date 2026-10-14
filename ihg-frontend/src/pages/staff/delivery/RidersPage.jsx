import PageHeader from '@/components/layout/PageHeader'
import RidersList from '@/features/staff/delivery/riders/RidersList'

export default function RidersPage() {
  return (
    <div>
      <PageHeader title="Riders" description="Manage delivery riders and their availability." />
      <RidersList />
    </div>
  )
}