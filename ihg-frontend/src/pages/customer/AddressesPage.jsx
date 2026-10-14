import PageHeader from '@/components/layout/PageHeader'
import AddressList from '@/features/customer/addresses/AddressList'

export default function AddressesPage() {
  return (
    <div>
      <PageHeader title="Addresses" description="Manage your saved delivery addresses." />
      <AddressList />
    </div>
  )
}