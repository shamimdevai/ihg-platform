import { Card, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

function formatPrice(price, currency) {
  const amount = Number(price).toFixed(2)
  return currency ? `${currency} ${amount}` : amount
}

function discountBadgeLabel(item) {
  return item.discount_type === 'percentage'
    ? `${Number(item.discount_value)}% OFF`
    : `${formatPrice(item.discount_value)} OFF`
}

// Single menu item — image, name, description, price, and an Add to
// Cart action. `discount_active` and `effective_price` come straight
// from the backend's MenuItemRead (see schemas/menu.py) — this
// component never computes discount math itself, so it can never drift
// from what the person is actually charged at checkout.
export default function MenuItemCard({ item, currency, onAdd }) {
  return (
    <Card className="flex flex-col overflow-hidden relative">
      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden relative">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground">No image</span>
        )}
        {item.discount_active && (
          <span className="absolute top-2 left-2 rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground shadow">
            {discountBadgeLabel(item)}
          </span>
        )}
      </div>

      <CardContent className="flex-1 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground">{item.name}</h3>
          <div className="text-right whitespace-nowrap">
            {item.discount_active ? (
              <>
                <div className="text-xs text-muted-foreground line-through">
                  {formatPrice(item.price, currency)}
                </div>
                <div className="text-sm font-semibold text-destructive">
                  {formatPrice(item.effective_price, currency)}
                </div>
              </>
            ) : (
              <span className="text-sm font-semibold text-foreground">{formatPrice(item.price, currency)}</span>
            )}
          </div>
        </div>
        {item.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
        )}
        {!item.is_available && (
          <p className="text-xs text-destructive mt-2 font-medium">Currently unavailable</p>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          className="w-full"
          size="sm"
          disabled={!item.is_available}
          onClick={() => onAdd(item)}
        >
          Add to Cart
        </Button>
      </CardFooter>
    </Card>
  )
}