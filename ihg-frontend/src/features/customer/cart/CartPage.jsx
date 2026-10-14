import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { useAppConfig } from '@/hooks/useAppConfig'
import { useCartStore, selectCartSubtotal } from '@/store/cartStore'

function formatPrice(price, currency) {
  const amount = Number(price).toFixed(2)
  return currency ? `${currency} ${amount}` : amount
}

// PATTERN CHOICE (flagged in docs/PROGRESS.md, Phase 26): a full CartPage
// was picked over a CartDrawer. Reasoning: customerRoutes.jsx already
// reserves a dedicated `/shop/cart` route (Phase 6), and every other
// customer screen in this app (Orders, Addresses, Profile) is a full
// page, not an overlay — a drawer would be a new UI pattern introduced
// for one screen only, with no existing precedent to follow. CartDrawer.jsx
// stays an unbuilt stub; a future phase can add a drawer as a secondary,
// quick-glance affordance if wanted without touching this page.
export default function CartPage() {
  const navigate = useNavigate()
  const { data: config } = useAppConfig()
  const currency = config?.currency

  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const subtotal = useCartStore(selectCartSubtotal)

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Browse the menu and add something to get started."
        action={
          <Link to="/shop/menu">
            <Button>Browse Menu</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.itemId}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="h-14 w-14 rounded-md bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">No image</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{item.name}</p>
                <p className="text-sm text-muted-foreground">{formatPrice(item.price, currency)} each</p>
              </div>

              <Input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => updateQuantity(item.itemId, Number(e.target.value))}
                className="w-16 text-center"
                aria-label={`Quantity for ${item.name}`}
              />

              <p className="w-20 text-right font-medium text-foreground">
                {formatPrice(item.price * item.quantity, currency)}
              </p>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeItem(item.itemId)}
                aria-label={`Remove ${item.name} from cart`}
              >
                Remove
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <Button variant="outline" onClick={clearCart}>
          Clear Cart
        </Button>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Subtotal</p>
          <p className="text-xl font-bold text-foreground">{formatPrice(subtotal, currency)}</p>
        </div>
      </div>

      {/* Checkout wiring belongs to Phase 27 — this button is real UI,
          not a fake success state, but its destination route
          (/shop/checkout) is still a RouteComingSoon placeholder until
          then. Not gated/disabled, since navigating there today
          correctly shows "coming soon" rather than silently doing
          nothing. */}
      <div className="flex justify-end mt-4">
        <Button size="lg" onClick={() => navigate('/shop/checkout')}>
          Proceed to Checkout
        </Button>
      </div>
    </div>
  )
}