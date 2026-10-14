import customerClient from '../customerClient'

// Customer-facing delivery order placement — the one write endpoint in
// this domain a customer token can reach (RBAC_MATRIX §1/§6.8: gated by
// require_verified_customer(), not just get_current_customer() — an
// unverified customer's own token still gets a real 403 here). See
// PlaceOrderForm.jsx for how that 403 is surfaced to the user.
//
// FLAGGED SCHEMA GAP, same treatment as Phase 19's restaurantApi.js
// createOrder(): DeliveryOrderItemCreate is referenced only by $ref in
// this phase's given slice, never expanded — its exact field names are
// unconfirmed. Built against the minimal, reasonable shape a delivery
// line item needs (menu_item_id + quantity), matching cartStore.js's
// own item shape exactly. cartStore items carry no special-instructions
// field today, so none is sent here — if a future phase adds a per-item
// note to the cart, add it here too. If order placement ever 422s, this
// is the first place to check.
export async function placeOrder({ restaurantId, deliveryAddressId, deliveryNotes, items }) {
  const res = await customerClient.post('/delivery/orders', {
    restaurant_id: restaurantId,
    delivery_address_id: deliveryAddressId,
    delivery_notes: deliveryNotes || null,
    items: items.map((item) => ({
      menu_item_id: item.itemId,
      quantity: item.quantity,
    })),
  })
  return res.data.data
  // { id, customer_id, delivery_address_id, restaurant_id, status,
  //   subtotal, delivery_fee, tax_amount, total_amount, currency,
  //   delivery_notes, cancelled_reason, confirmed_at, ready_at,
  //   out_for_delivery_at, delivered_at, cancelled_at, created_at }
}

// ─────────────────────────────────────────────────────────────────
// Phase 28 additions — order history + tracking, all scoped to the
// caller's OWN orders. Every function below hits a `/mine`- or
// `/tracking`-namespaced endpoint gated by get_current_customer() (+ an
// ownership check server-side per RBAC_MATRIX §6.8) — there is no
// general order-by-id lookup anywhere in this file, and none should
// ever be added: an order_id only ever reaches these calls via
// listMyOrders()'s own results, or via the id PlaceOrderForm.jsx
// receives back from placeOrder() above (i.e. the customer's own
// just-placed order) — never guessed, typed, or incremented.
// ─────────────────────────────────────────────────────────────────

// GET /delivery/orders/mine — order history list. `status` is an
// optional free-text filter (no confirmed enum on this field — see
// OrderHistory.jsx's colorMap comment), passed through as-is or
// omitted entirely.
export async function listMyOrders({ status } = {}) {
  const res = await customerClient.get('/delivery/orders/mine', {
    params: status ? { status } : undefined,
  })
  return res.data.data
}

// GET /delivery/orders/mine/{order_id} — full detail, INCLUDING the
// nested `items` array (unlike getMyOrderStatus below). Used once per
// tracking-page visit for the order summary/items — not polled, since
// items don't change after placement and this is the heavier of the
// two GETs.
export async function getMyOrder(orderId) {
  const res = await customerClient.get(`/delivery/orders/mine/${orderId}`)
  return res.data.data
  // adds: { ...same fields as placeOrder()'s return, items: [{ id,
  //   menu_item_id, item_name, quantity, unit_price, line_total,
  //   special_instructions }] }
}

// GET /delivery/tracking/{order_id}/status — the lightweight,
// no-items variant of the same order, per RBAC_MATRIX §6.8's own
// description ("lightweight customer-facing tracking view"). This is
// the one OrderTracking.jsx polls — see that file for the polling
// decision.
export async function getMyOrderStatus(orderId) {
  const res = await customerClient.get(`/delivery/tracking/${orderId}/status`)
  return res.data.data
}

// POST /delivery/orders/mine/{order_id}/cancel — customer-initiated
// cancel. RBAC_MATRIX §6.8: server-enforced via is_customer_cancellable(),
// only while the order is still "placed"/"confirmed" — this file does
// not attempt to replicate that check; it just calls the real endpoint
// and lets the server be the final authority (a request made too late
// fails with a real error, surfaced via the caller's onError handler).
// `reason` is optional per the real request schema.
export async function cancelMyOrder(orderId, reason) {
  const res = await customerClient.post(`/delivery/orders/mine/${orderId}/cancel`, {
    reason: reason || null,
  })
  return res.data.data
}