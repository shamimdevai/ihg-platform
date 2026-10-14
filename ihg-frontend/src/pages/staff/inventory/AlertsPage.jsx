import PageHeader from '@/components/layout/PageHeader'
import AlertsList from '@/features/staff/inventory/alerts/AlertsList'

export default function AlertsPage() {
  return (
    <div>
      <PageHeader title="Low-Stock Alerts" description="Review and resolve low-stock alerts." />
      <AlertsList />
    </div>
  )
}