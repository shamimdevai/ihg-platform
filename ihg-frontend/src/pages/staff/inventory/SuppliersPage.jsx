import PageHeader from '@/components/layout/PageHeader'
import SuppliersList from '@/features/staff/inventory/suppliers/SuppliersList'

export default function SuppliersPage() {
  return (
    <div>
      <PageHeader title="Suppliers" description="Manage inventory suppliers." />
      <SuppliersList />
    </div>
  )
}