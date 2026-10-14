import PageHeader from '@/components/layout/PageHeader'
import KitchenTicketBoard from '@/features/staff/restaurant/kitchen/KitchenTicketBoard'

export default function KitchenPage() {
  return (
    <div>
      <PageHeader
        title="Kitchen"
        description="View kitchen tickets and update their status."
      />
      <KitchenTicketBoard />
    </div>
  )
}