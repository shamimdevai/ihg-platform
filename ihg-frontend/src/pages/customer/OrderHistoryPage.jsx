import PageHeader from '@/components/layout/PageHeader'
import OrderHistory from '@/features/customer/orders/OrderHistory'

export default function OrderHistoryPage() {
  return (
    <div>
      <PageHeader title="My Orders" description="Track and review your delivery orders." />
      <OrderHistory />
    </div>
  )
}