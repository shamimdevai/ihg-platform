import { create } from 'zustand'

// Client-side-only cart. No backend cart/basket endpoint exists anywhere
// in the API (confirmed — Phase 26 brief) — this is expected, not a gap
// to flag. Deliberately NOT wrapped in zustand's `persist` middleware:
// the brief calls for "no persistence beyond the session," so a plain
// in-memory store is correct here (unlike customerAuthStore's tokens,
// which DO persist to localStorage — cart intentionally does not follow
// that precedent).
//
// A cart is scoped to exactly one restaurant, matching how a real
// food-delivery order works (Phase 27 will submit one order against one
// restaurant_id). If the cart already holds items from restaurant A and
// something from restaurant B is added, the add is rejected — the
// calling component is expected to ask the user to clear the cart
// first rather than silently mixing restaurants or silently replacing
// the cart. This is a UI-level decision (no backend rule enforces it,
// since there's no cart endpoint at all) — flagged here rather than
// silently assumed.
export const useCartStore = create((set, get) => ({
  restaurantId: null,
  items: [], // [{ itemId, name, price (effective), listPrice, imageUrl, quantity }]

  /**
   * addItem(item, restaurantId) — item is a real menu item object from
   * the API ({ id, name, price, image_url, is_available, ... }).
   * Returns { ok: true } on success or { ok: false, reason } if
   * rejected (different restaurant already in cart, or item
   * unavailable) so the caller can show a toast without this store
   * needing to know about ToastProvider.
   */
  addItem: (item, restaurantId) => {
    const { restaurantId: currentRestaurantId, items } = get()

    if (!item.is_available) {
      return { ok: false, reason: 'This item is currently unavailable.' }
    }

    if (currentRestaurantId && currentRestaurantId !== restaurantId) {
      return {
        ok: false,
        reason: 'Your cart has items from a different restaurant. Clear your cart first to order from here instead.',
      }
    }

    const existing = items.find((i) => i.itemId === item.id)
    if (existing) {
      set({
        items: items.map((i) =>
          i.itemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      })
    } else {
      set({
        restaurantId,
        items: [
          ...items,
          {
            itemId: item.id,
            name: item.name,
            // Use the backend's effective (post-discount) price so the
            // cart/checkout estimate matches what is actually charged.
            // Falls back to the list price when no discount applies or
            // the field is absent. listPrice is kept for display if a
            // strike-through is ever wanted.
            price: item.effective_price ?? item.price,
            listPrice: item.price,
            imageUrl: item.image_url || null,
            quantity: 1,
          },
        ],
      })
    }
    return { ok: true }
  },

  updateQuantity: (itemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(itemId)
      return
    }
    set({
      items: get().items.map((i) => (i.itemId === itemId ? { ...i, quantity } : i)),
    })
  },

  removeItem: (itemId) => {
    const remaining = get().items.filter((i) => i.itemId !== itemId)
    set({
      items: remaining,
      // Once the cart is empty there's no restaurant lock left either —
      // the next add can start a cart for any restaurant again.
      restaurantId: remaining.length > 0 ? get().restaurantId : null,
    })
  },

  clearCart: () => set({ restaurantId: null, items: [] }),
}))

// Plain (non-hook) selectors for derived totals — usable both inside
// components via useCartStore(selectCartCount) and outside React if
// ever needed (e.g. Phase 27's checkout submission).
export const selectCartCount = (state) =>
  state.items.reduce((sum, i) => sum + i.quantity, 0)

export const selectCartSubtotal = (state) =>
  state.items.reduce((sum, i) => sum + i.price * i.quantity, 0)