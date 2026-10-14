import PageHeader from '@/components/layout/PageHeader'
import PaymentsList from '@/features/staff/payments/PaymentsList'

export default function PaymentsPage() {
  return (
    <div>
      <PageHeader title="Payments" description="Browse payment records across the platform." />
      <PaymentsList />
    </div>
  )
}