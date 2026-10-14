import PageHeader from '@/components/layout/PageHeader'
import RefundReviewList from '@/features/staff/payments/RefundReviewList'

export default function RefundsPage() {
  return (
    <div>
      <PageHeader title="Refund Review" description="Approve or reject staff-submitted refund requests." />
      <RefundReviewList />
    </div>
  )
}