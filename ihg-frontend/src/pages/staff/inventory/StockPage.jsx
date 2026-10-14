import PageHeader from '@/components/layout/PageHeader'
import StockList from '@/features/staff/inventory/stock/StockList'

export default function StockPage() {
  return (
    <div>
      <PageHeader title="Stock" description="View stock levels and record adjustments." />
      <StockList />
    </div>
  )
}