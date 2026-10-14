import PageHeader from '@/components/layout/PageHeader'
import CartPageContent from '@/features/customer/cart/CartPage'

export default function CartPage() {
  return (
    <div>
      <PageHeader title="Your Cart" />
      <CartPageContent />
    </div>
  )
}