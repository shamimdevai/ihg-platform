import PageHeader from '@/components/layout/PageHeader'
import ItemsList from '@/features/staff/inventory/items/ItemsList'

export default function ItemsPage() {
  return (
    <div>
      <PageHeader title="Inventory Items" description="Manage the items tracked in inventory." />
      <ItemsList />
    </div>
  )
}