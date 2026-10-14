import PageHeader from '@/components/layout/PageHeader'
import PlaceOrderForm from '@/features/customer/checkout/PlaceOrderForm'

// Deliberately no cart-empty check here — PlaceOrderForm.jsx owns that
// branch itself, after its own success-state check, so a just-placed
// order's confirmation screen (which clears the cart) isn't immediately
// replaced by an empty-cart redirect. See PlaceOrderForm.jsx's own
// comment for the full reasoning.
export default function CheckoutPage() {
  return (
    <div>
      <PageHeader title="Checkout" description="Choose a delivery address and place your order." />
      <PlaceOrderForm />
    </div>
  )
}