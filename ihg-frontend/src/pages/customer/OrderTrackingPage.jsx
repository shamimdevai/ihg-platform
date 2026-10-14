import PageHeader from '@/components/layout/PageHeader'
import OrderTracking from '@/features/customer/orders/OrderTracking'

export default function OrderTrackingPage() {
  return (
    <div>
      <PageHeader title="Order Status" description="Live status for this delivery order." />
      <OrderTracking />
    </div>
  )
}