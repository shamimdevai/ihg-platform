import PageHeader from '@/components/layout/PageHeader'
import RiderMyDeliveries from '@/features/staff/delivery/my-deliveries/RiderMyDeliveries'

export default function MyDeliveriesPage() {
  return (
    <div>
      <PageHeader
        title="My Deliveries"
        description="Deliveries currently assigned to you, and your own rider profile."
      />
      <RiderMyDeliveries />
    </div>
  )
}