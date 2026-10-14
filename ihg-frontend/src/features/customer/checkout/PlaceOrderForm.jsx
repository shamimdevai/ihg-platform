import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Label } from '@/components/ui/Label'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/ToastProvider'
import { useAppConfig } from '@/hooks/useAppConfig'
import { useCartStore, selectCartSubtotal } from '@/store/cartStore'
import * as deliveryOrdersApi from '@/api/customer/deliveryOrdersApi'
import AddressSelect from './AddressSelect'

function formatPrice(price, currency) {
  const amount = Number(price).toFixed(2)
  return currency ? `${currency} ${amount}` : amount
}

/**
 * PlaceOrderForm — the real submission screen for Phase 27. Deliberately
 * NOT one single react-hook-form-registered form: AddressSelect is a
 * compound, async-data component (its own fetch + its own inline
 * create-mutation), not a plain input react-hook-form's register() can
 * target — so the selected address id is plain component state here,
 * and delivery notes is a plain controlled textarea for the same
 * reason. Cart contents come straight from cartStore, never re-entered.
 *
 * Render-order note: the `placedOrder` check runs BEFORE the
 * empty-cart check, on purpose — a successful order calls clearCart(),
 * which would otherwise make the empty-cart branch below win on the
 * very next render and yank the confirmation screen out from under the
 * user. CheckoutPage.jsx deliberately does no cart-empty check of its
 * own for the same reason.
 */
export default function PlaceOrderForm() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: config } = useAppConfig()
  const currency = config?.currency

  const items = useCartStore((s) => s.items)
  const restaurantId = useCartStore((s) => s.restaurantId)
  const clearCart = useCartStore((s) => s.clearCart)
  const subtotal = useCartStore(selectCartSubtotal)

  const [addressId, setAddressId] = useState(null)
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [addressError, setAddressError] = useState(null)
  const [placedOrder, setPlacedOrder] = useState(null)
  const [unverified, setUnverified] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const mutation = useMutation({
    mutationFn: () =>
      deliveryOrdersApi.placeOrder({
        restaurantId,
        deliveryAddressId: addressId,
        deliveryNotes: deliveryNotes.trim() || null,
        items,
      }),
    onSuccess: (order) => {
      clearCart()
      setPlacedOrder(order)
    },
    onError: (err) => {
      // CONFIRMED from source (this phase's brief): this endpoint
      // requires a verified email (require_verified_customer(), not
      // just get_current_customer()) — an unverified customer gets a
      // real 403 here. There is no client-side signal for verification
      // status today (no customer "me" endpoint exists — see
      // customerAuthStore.js), so this is the only point in the app
      // that can ever detect it.
      if (err?.response?.status === 403) {
        setUnverified(true)
        return
      }
      const message = err?.response?.data?.message || 'Could not place your order.'
      setSubmitError(message)
      toast({ title: 'Order failed', description: message, variant: 'destructive' })
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitError(null)
    setUnverified(false)
    if (!addressId) {
      setAddressError('Choose or add a delivery address first.')
      return
    }
    setAddressError(null)
    mutation.mutate()
  }

  if (placedOrder) {
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Order placed!</h2>
          <p className="text-sm text-muted-foreground">
            Order #{placedOrder.id.slice(0, 8)} — status: {placedOrder.status}
          </p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(placedOrder.subtotal, placedOrder.currency || currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery fee</span>
              <span>{formatPrice(placedOrder.delivery_fee, placedOrder.currency || currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatPrice(placedOrder.tax_amount, placedOrder.currency || currency)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground pt-1 border-t">
              <span>Total</span>
              <span>{formatPrice(placedOrder.total_amount, placedOrder.currency || currency)}</span>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate('/shop/menu')}>
              Back to Menu
            </Button>
            {/* /shop/orders/:orderId is still a RouteComingSoon
                placeholder until Phase 28 builds real tracking — same
                "real navigation, not-yet-built destination" precedent
                Phase 26 set for the Checkout button. */}
            <Button onClick={() => navigate(`/shop/orders/${placedOrder.id}`)}>
              View Order Status
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Add something from the menu before checking out."
        action={
          <Link to="/shop/menu">
            <Button>Browse Menu</Button>
          </Link>
        }
      />
    )
  }

  if (unverified) {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Verify your email to order</h2>
          <p className="text-sm text-muted-foreground">
            Your account needs a verified email address before you can place a delivery order.
          </p>
          <Link to="/shop/verify-email">
            <Button>Verify my email</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <AddressSelect value={addressId} onChange={setAddressId} />
      {addressError && <p className="text-sm text-destructive">{addressError}</p>}

      <div>
        <Label htmlFor="delivery-notes">Delivery notes (optional)</Label>
        <textarea
          id="delivery-notes"
          rows={3}
          value={deliveryNotes}
          onChange={(e) => setDeliveryNotes(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Gate code, floor number, delivery instructions…"
        />
      </div>

      <div className="rounded-md border p-4 space-y-1 text-sm">
        <p className="font-medium text-foreground mb-1">Order summary</p>
        {items.map((item) => (
          <div key={item.itemId} className="flex justify-between text-muted-foreground">
            <span>{item.quantity} × {item.name}</span>
            <span>{formatPrice(item.price * item.quantity, currency)}</span>
          </div>
        ))}
        <div className="flex justify-between font-semibold text-foreground pt-2 border-t mt-2">
          <span>Estimated subtotal</span>
          <span>{formatPrice(subtotal, currency)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Delivery fee and tax are calculated by the server and shown after you place the order.
        </p>
      </div>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <Button type="submit" size="lg" className="w-full" loading={mutation.isPending}>
        Place Order
      </Button>
    </form>
  )
}