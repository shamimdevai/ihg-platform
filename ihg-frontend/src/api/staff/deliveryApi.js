import staffClient from '../staffClient'

// delivery domain (staff side) — Phase 21 builds orders (staff lifecycle
// actions only: confirm/preparing/ready/cancel — NOT pickup/deliver,
// which belong to the Rider's own tracking flow), riders, and
// assignments (dispatch). This file grows further in Phase 22: Rider's
// own GET /delivery/riders/me, and the tracking pickup/deliver/status
// endpoints gated by delivery:order:update_status (not given in this
// phase's slice).
//
// Gating (RBAC_MATRIX v7 §4.10/§6.8):
//   delivery:order:read   → GET orders (list/detail)
//   delivery:order:write  → POST orders/{id}/cancel (staff-initiated,
//                            no pre-preparation restriction), and the
//                            three tracking transitions below
//                            (confirm/preparing/ready)
//   delivery:rider:read   → GET riders, GET assignments
//   delivery:rider:write  → POST/PUT riders, PUT riders/{id}/status
//                            (dispatcher override), POST assignments
//                            (dispatch) — mirrors restaurant:table:write
//                            covering waiter-to-table assignment under
//                            one code rather than a separate one.
// IMPORTANT: this screen's ROUTE is gated by delivery:rider:write (per
// the brief, to avoid exposing the full dispatch screen to Rider, who
// also holds delivery:order:read) — but the individual order-action
// buttons in DeliveryOrdersList.jsx are gated by delivery:order:write,
// the code that actually protects those endpoints server-side. These
// are two different, independent permission codes; only Admin currently
// holds both, but they're isolated from each other per §9's wildcard
// resolution — don't assume delivery:rider:write covers order writes.
//
// DeliveryOrder.status has NO confirmed enum in this phase's given slice
// (single example value "placed", no `enum` block) — see
// DeliveryOrdersList.jsx for the inferred colorMap + real-typed-field
// gating, and a flagged gap: there is no `preparing_at` field despite a
// real `preparing` transition endpoint existing.
//
// Rider.status: "available" appears as the schema's own real example
// value (stronger signal than a guess), but "busy"/"offline" have zero
// schema signal — still treated as inferred, non-exhaustive. See
// RidersList.jsx for the fallback-safe treatment.
//
// DeliveryAssignment.status: the given schema shows only the literal
// placeholder "status_example" — weaker signal than any other
// unconfirmed field in this codebase. Displayed via StatusBadge's
// graceful fallback only; never built into a dropdown.
//
// Backlog item 9, RESOLVED: cancelAssignment() below. Also fixed a real
// bug found along the way — dispatching a DIFFERENT rider to an
// already-assigned order previously left the bumped rider stuck "busy"
// forever (see rider_service.py's _release_assignment docstring). Both
// paths now correctly free the rider back to "available".

// ---- Orders -------------------------------------------------------------

export async function listOrders({ customerId, restaurantId, status } = {}) {
  const res = await staffClient.get('/delivery/orders', {
    params: {
      customer_id: customerId || undefined,
      restaurant_id: restaurantId || undefined,
      status: status || undefined,
    },
  })
  return res.data.data // [{ id, customer_id, delivery_address_id, restaurant_id, status, subtotal, delivery_fee, tax_amount, total_amount, currency, delivery_notes, cancelled_reason, confirmed_at, ready_at, out_for_delivery_at, delivered_at, cancelled_at, created_at }]
}

export async function getOrder(orderId) {
  // Returns DeliveryOrderDetailRead — same fields as listOrders rows
  // plus a nested items array: [{ id, menu_item_id, item_name, quantity,
  // unit_price, line_total, special_instructions }].
  const res = await staffClient.get(`/delivery/orders/${orderId}`)
  return res.data.data
}

export async function cancelOrder(orderId, reason) {
  // Entire request body is optional per the real schema — same shape as
  // hotel's cancelBooking() (Phase 14) and restaurant's
  // cancelReservation() (Phase 17). Staff-initiated cancel has no
  // pre-preparation restriction, unlike the customer-facing cancel path
  // (RBAC_MATRIX §6.8) — that distinction lives entirely server-side.
  const res = await staffClient.post(
    `/delivery/orders/${orderId}/cancel`,
    reason ? { reason } : {}
  )
  return res.data.data
}

// ---- Order tracking (staff-side transitions only) ------------------------
// pickup/deliver are deliberately NOT here — those are gated by
// delivery:order:update_status (Rider + Admin only) and belong to
// Phase 22's rider-facing screen.

export async function confirmOrder(orderId) {
  const res = await staffClient.post(`/delivery/tracking/${orderId}/confirm`)
  return res.data.data
}

export async function markOrderPreparing(orderId) {
  const res = await staffClient.post(`/delivery/tracking/${orderId}/preparing`)
  return res.data.data
}

export async function markOrderReady(orderId) {
  const res = await staffClient.post(`/delivery/tracking/${orderId}/ready`)
  return res.data.data
}

// ---- Riders ---------------------------------------------------------------

export async function createRider(values) {
  // Required: staff_id. vehicle_type/license_plate/phone all optional
  // per the real request schema.
  const res = await staffClient.post('/delivery/riders', values)
  return res.data.data
}

export async function listRiders({ status, isActive } = {}) {
  const res = await staffClient.get('/delivery/riders', {
    params: {
      status: status || undefined,
      is_active: isActive === undefined ? undefined : isActive,
    },
  })
  return res.data.data // [{ id, staff_id, vehicle_type, license_plate, phone, status, is_active }]
}

export async function getRider(riderId) {
  const res = await staffClient.get(`/delivery/riders/${riderId}`)
  return res.data.data
}

export async function updateRider(riderId, values) {
  // Entire body optional/partial per the real schema (vehicle_type,
  // license_plate, phone, is_active) — NOT staff_id, which has no
  // general-edit path (mirrors iamStaffApi's edit-mode email exclusion).
  // is_active being a plain partial-update field (not a separate
  // deactivate-only endpoint like iam:staff) means a rider CAN be
  // reactivated here, unlike Phase 7/9's role/department delete gaps.
  const res = await staffClient.put(`/delivery/riders/${riderId}`, values)
  return res.data.data
}

export async function setRiderStatus(riderId, status) {
  // Dispatcher-driven manual override (RBAC_MATRIX §6.8) — Rider does
  // NOT hold delivery:rider:write, so this action is Admin-only from
  // this screen; Rider's own self-service status toggle (if any) would
  // be separate, out-of-scope-here Phase 22 territory.
  const res = await staffClient.put(`/delivery/riders/${riderId}/status`, { status })
  return res.data.data
}

// ---- Assignments (dispatch) ------------------------------------------------

export async function createAssignment({ orderId, riderId }) {
  const res = await staffClient.post('/delivery/assignments', {
    order_id: orderId,
    rider_id: riderId,
  })
  return res.data.data
}

export async function listAssignments({ orderId, riderId, isActive } = {}) {
  const res = await staffClient.get('/delivery/assignments', {
    params: {
      order_id: orderId || undefined,
      rider_id: riderId || undefined,
      is_active: isActive === undefined ? undefined : isActive,
    },
  })
  return res.data.data // [{ id, order_id, rider_id, status, assigned_at, picked_up_at, delivered_at, cancelled_at, is_active, assigned_by_staff_id }]
}

export async function getAssignment(assignmentId) {
  const res = await staffClient.get(`/delivery/assignments/${assignmentId}`)
  return res.data.data
}

// Frees the rider back to "available" and reverts the order back to
// "ready_for_pickup" server-side (rider_service.cancel_assignment) —
// DispatchPanel.jsx invalidates both assignments AND riders queries on
// success for this reason, same as the existing assign mutation does.
export async function cancelAssignment(assignmentId) {
  const res = await staffClient.post(`/delivery/assignments/${assignmentId}/cancel`)
  return res.data.data
}

// ---- Rider self-service (Phase 22) -----------------------------------------
// Gated by delivery:rider:read — CONFIRMED from the source comment on
// GET /delivery/riders/me: still the real grantable permission code, not
// a hardcoded ownership shortcut (RBAC_MATRIX §6.8). Rider holds this
// code, so this call succeeds for a logged-in Rider.

export async function getMyRiderProfile() {
  // { id, staff_id, vehicle_type, license_plate, phone, status, is_active }
  const res = await staffClient.get('/delivery/riders/me')
  return res.data.data
}

// ---- Order tracking — rider-side transitions (Phase 22) --------------------
// Gated by delivery:order:update_status — the narrow named-exception code
// only Rider + Admin hold (RBAC_MATRIX §4.10). Holding this code is
// necessary but NOT sufficient: delivery_tracking_service's
// _get_active_assignment_for_rider() additionally verifies the calling
// rider holds the order's actual active assignment server-side — a
// Rider cannot progress a delivery assigned to someone else even though
// every Rider holds the identical permission code. This screen only
// ever calls these against orders already filtered to the caller's own
// active assignments, but the server-side check is the real boundary,
// not this client-side filtering.

export async function pickupDeliveryOrder(orderId) {
  const res = await staffClient.post(`/delivery/tracking/${orderId}/pickup`)
  return res.data.data
}

export async function deliverDeliveryOrder(orderId) {
  const res = await staffClient.post(`/delivery/tracking/${orderId}/deliver`)
  return res.data.data
}