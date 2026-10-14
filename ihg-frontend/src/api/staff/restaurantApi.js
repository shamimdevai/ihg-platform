import staffClient from '../staffClient'

// restaurant domain — this file grows further in Phases 18 (menu), 19
// (dine-in orders/billing), and 20 (kitchen). Phase 17 only builds the
// restaurants/tables/reservations/waiter-assignment portion below.
//
// Gating (RBAC_MATRIX v7 §4.9/§6.7): restaurant:table:read covers GET
// across ALL FOUR resources here — restaurants, tables, reservations,
// AND waiter assignments — they share one pair by explicit task
// instruction (a deliberate 4-router grouping, not a 1:1 router-to-code
// mapping). restaurant:table:write covers every POST/PUT below,
// including waiter assign/unassign — CONFIRMED from the endpoint's own
// source comment: waiter assignment is a supervisory/host action, gated
// by restaurant:table:write, NOT restaurant:order:*. Waiter (the role)
// holds neither code — confirmed Admin-only (RBAC_MATRIX §5.1,
// PROGRESS.md Resolved item 5).

// ---- Restaurants --------------------------------------------------------
// Not named in Phase 17's own deliverable list, but POST/GET/PUT
// /restaurant/restaurants are real endpoints in this phase's given
// slice, and tables/reservations both require a restaurant_id — added
// as a minimal, ahead-of-deliverable addition (flagged in chat), same
// precedent as Phase 13's hotels list/create. No restaurant-edit UI
// this phase even though PUT /restaurant/restaurants/{id} exists.

export async function listRestaurants() {
  const res = await staffClient.get('/restaurant/restaurants')
  return res.data.data // [{ id, name, address, phone, email, is_active }]
}

export async function createRestaurant(values) {
  const res = await staffClient.post('/restaurant/restaurants', values)
  return res.data.data
}

export async function getRestaurant(restaurantId) {
  const res = await staffClient.get(`/restaurant/restaurants/${restaurantId}`)
  return res.data.data
}

export async function updateRestaurant(restaurantId, values) {
  const res = await staffClient.put(`/restaurant/restaurants/${restaurantId}`, values)
  return res.data.data
}

// ---- Tables ---------------------------------------------------------------
// Table.status IS a confirmed, real enum — taken verbatim from the
// PUT /tables/{id}/status request schema's description field:
// "available" | "reserved" | "occupied" | "cleaning" — NOT inferred,
// same treatment as Phase 13's ROOM_STATUSES (which had its own real
// description-field enum). No general PUT exists for a table's other
// fields (table_number/capacity/is_active) — only this one
// status-transition endpoint, same shape as hotel rooms in Phase 13.

export async function listTables({ restaurantId, status } = {}) {
  const res = await staffClient.get('/restaurant/tables', {
    params: {
      restaurant_id: restaurantId || undefined,
      status: status || undefined,
    },
  })
  return res.data.data // [{ id, restaurant_id, table_number, capacity, status, is_active }]
}

export async function createTable(values) {
  // Required: restaurant_id, table_number. capacity defaults to 2,
  // is_active defaults to true per the real request schema.
  const res = await staffClient.post('/restaurant/tables', values)
  return res.data.data
}

export async function getTable(tableId) {
  const res = await staffClient.get(`/restaurant/tables/${tableId}`)
  return res.data.data
}

export async function updateTableStatus(tableId, status) {
  const res = await staffClient.put(`/restaurant/tables/${tableId}/status`, { status })
  return res.data.data
}

// ---- Reservations -----------------------------------------------------
// Flag #2 (Global Context Prompt §1 Bucket B): these endpoints are
// staff-authenticated only — no customer-token path to self-reserve a
// table exists anywhere in this slice, even though "customer reserves
// table" is literally step one of the proposal's Restaurant process.
// See ReservationForm.jsx for the in-app banner and PROGRESS.md Open
// Question (2).
//
// Reservation.status has NO confirmed enum in this phase's given slice
// (single example value "confirmed", no `enum` block) — same treatment
// as every other unconfirmed status field since Phase 11. UNLIKE
// Booking/Invoice/HousekeepingTask, though, there is no real typed
// field (no seated_at/completed_at/cancelled_reason) to gate action
// buttons off of instead — the three real actions below (seat/complete/
// cancel) are the only signal for what states exist at all. See
// ReservationsList.jsx for how this genuine gap (not a design choice)
// is handled — flagged there, not silently worked around.

export async function createReservation(values) {
  // Required: restaurant_id, table_id, customer_name, reservation_time.
  // customer_id intentionally omitted from the form — no staff-side
  // customer-lookup screen exists yet (mirrors Phase 10's
  // linkGuestToCustomer() precedent); server allows it to be null.
  const res = await staffClient.post('/restaurant/reservations', values)
  return res.data.data
}

export async function listReservations({ restaurantId, tableId, status } = {}) {
  const res = await staffClient.get('/restaurant/reservations', {
    params: {
      restaurant_id: restaurantId || undefined,
      table_id: tableId || undefined,
      status: status || undefined,
    },
  })
  return res.data.data // [{ id, restaurant_id, table_id, customer_id, customer_name, customer_phone, reservation_time, party_size, status, notes, created_at }]
}

export async function getReservation(reservationId) {
  const res = await staffClient.get(`/restaurant/reservations/${reservationId}`)
  return res.data.data
}

export async function cancelReservation(reservationId, reason) {
  // Entire request body is optional per the real schema — same shape
  // as hotel's cancelBooking() in Phase 14.
  const res = await staffClient.post(
    `/restaurant/reservations/${reservationId}/cancel`,
    reason ? { reason } : {}
  )
  return res.data.data
}

export async function completeReservation(reservationId) {
  const res = await staffClient.post(`/restaurant/reservations/${reservationId}/complete`)
  return res.data.data
}

export async function seatReservation(reservationId) {
  const res = await staffClient.post(`/restaurant/reservations/${reservationId}/seat`)
  return res.data.data
}

// ---- Waiter-to-table assignment ----------------------------------------
// CONFIRMED from source comment: gated by restaurant:table:write, NOT
// restaurant:order:* — waiter assignment is a supervisory/host action,
// distinct from a Waiter taking their own orders. No dedicated UI file
// was named for this in Phase 17's deliverable list — built inline into
// TablesList.jsx as a per-row action, flagged in chat before building.

export async function assignWaiter(values) {
  // Required: table_id, staff_id.
  const res = await staffClient.post('/restaurant/waiters', values)
  return res.data.data
}

export async function listWaiterAssignments({ tableId, staffId, isActive } = {}) {
  const res = await staffClient.get('/restaurant/waiters', {
    params: {
      table_id: tableId || undefined,
      staff_id: staffId || undefined,
      is_active: isActive === undefined ? undefined : isActive,
    },
  })
  return res.data.data // [{ id, table_id, staff_id, assigned_at, unassigned_at, is_active }]
}

export async function getWaiterAssignment(assignmentId) {
  const res = await staffClient.get(`/restaurant/waiters/${assignmentId}`)
  return res.data.data
}

export async function unassignWaiter(assignmentId) {
  const res = await staffClient.post(`/restaurant/waiters/${assignmentId}/unassign`)
  return res.data.data
}

// ---- Menu: Categories --------------------------------------------------
// Gating (RBAC_MATRIX v7 §4.9/§6.7): restaurant:menu:read covers GET
// (Admin + Waiter — the one code Waiter holds in this domain, so it can
// see the menu while taking an order); restaurant:menu:write covers
// every POST/PUT below, INCLUDING image upload — CONFIRMED Admin-only,
// Waiter explicitly does NOT hold it ("without menu-editing rights" per
// the task spec verbatim, PROGRESS.md Resolved item 6).
//
// Backlog item 8, RESOLVED: PUT and DELETE now both exist for
// categories (see updateMenuCategory/deleteMenuCategory below) — a real
// hard delete, unlike Hotel/Room's deactivate-only treatment, since
// MenuCategory has no is_active-equivalent column of its own... it
// actually does (is_active, used by the create/list functions below),
// but the explicit decision was still real delete + edit, mirroring
// RoomType's precedent rather than Hotel/Room's, since a category is a
// much lighter-weight grouping than a hotel/room.

export async function listMenuCategories(restaurantId) {
  const res = await staffClient.get('/restaurant/menu/categories', {
    params: { restaurant_id: restaurantId },
  })
  return res.data.data // [{ id, restaurant_id, name, display_order, is_active }]
}

export async function createMenuCategory(values) {
  // Required: restaurant_id, name. display_order defaults to 0,
  // is_active defaults to true per the real request schema.
  const res = await staffClient.post('/restaurant/menu/categories', values)
  return res.data.data
}

export async function updateMenuCategory(categoryId, values) {
  const res = await staffClient.put(`/restaurant/menu/categories/${categoryId}`, values)
  return res.data.data
}

// Errors are NOT swallowed — MenuCategoriesList.jsx reads
// err.response.data.message directly so a 409 ("still has N menu
// item(s) in it...") reaches the person instead of a generic failure.
export async function deleteMenuCategory(categoryId) {
  const res = await staffClient.delete(`/restaurant/menu/categories/${categoryId}`)
  return res.data
}

// ---- Menu: Items ---------------------------------------------------------

export async function listMenuItems({ restaurantId, categoryId, isAvailable } = {}) {
  const res = await staffClient.get('/restaurant/menu/items', {
    params: {
      restaurant_id: restaurantId || undefined,
      category_id: categoryId || undefined,
      is_available: isAvailable === undefined ? undefined : isAvailable,
    },
  })
  return res.data.data // [{ id, restaurant_id, category_id, name, description, price, image_url, is_available, inventory_item_id, inventory_qty_per_unit }]
}

export async function getMenuItem(itemId) {
  const res = await staffClient.get(`/restaurant/menu/items/${itemId}`)
  return res.data.data
}

export async function createMenuItem(values) {
  // Required: restaurant_id, category_id, name, price.
  const res = await staffClient.post('/restaurant/menu/items', values)
  return res.data.data
}

export async function updateMenuItem(itemId, values) {
  // Entire body is optional/partial per the real request schema — only
  // send the fields that actually changed if the caller wants that
  // behavior; this function itself just forwards whatever it's given.
  const res = await staffClient.put(`/restaurant/menu/items/${itemId}`, values)
  return res.data.data
}

export async function uploadMenuItemImage(itemId, file) {
  // multipart/form-data, not JSON — explicitly override the client's
  // default 'application/json' Content-Type header for this one call so
  // axios sets the correct multipart boundary itself.
  const formData = new FormData()
  formData.append('file', file)
  const res = await staffClient.post(`/restaurant/menu/items/${itemId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}


export async function clearMenuItemDiscount(itemId) {
  const res = await staffClient.post(`/restaurant/menu/items/${itemId}/discount/clear`)
  return res.data.data
}

// Backlog item 8, RESOLVED — real hard delete, explicitly added
// alongside the already-fully-working is_available toggle (for
// cleaning up genuinely mis-entered items, not for the "stop selling
// this" use case, which is_available already handled completely). No
// blocking condition server-side — order line items snapshot their own
// name/price, so this is always safe.
export async function deleteMenuItem(itemId) {
  const res = await staffClient.delete(`/restaurant/menu/items/${itemId}`)
  return res.data
}


// ---- Dine-in Orders (Phase 19) -----------------------------------------
// Gating (RBAC_MATRIX v7 §4.9/§6.7): restaurant:order:read covers GET
// below; restaurant:order:write covers create/bill/cancel. Waiter holds
// BOTH — this is the domain's most active Waiter permission (full
// read+write here, plus restaurant:menu:read only — no
// restaurant:table:*). Order placement also triggers
// kitchen_service.create_ticket_for_order() server-side with no separate
// permission check (RBAC_MATRIX §4.9) — nothing on the frontend needs to
// trigger that itself.
//
// DineInOrder.status has NO confirmed enum in this phase's given slice
// (single example value "open", no `enum` block) — see OrdersList.jsx
// for the inferred colorMap (open/billed/cancelled, derived from that
// one example value plus the two real transition actions below) and the
// same "gate directly off the inferred string, no real typed field
// exists to gate off of instead" treatment Reservation.status got in
// Phase 17.
//
// DineInOrderItemCreate's exact request shape was only referenced by
// $ref in this phase's given slice, never expanded/resolved. Built
// against the minimal, reasonable shape implied by the response's
// DineInOrderItemRead — { menu_item_id, quantity, special_instructions }
// — omitting item_name/unit_price/line_total since those are clearly
// server-computed (looked up from menu_item_id server-side). Flagged
// here rather than assumed silently correct — if order creation ever
// 422s, this is the first place to check.

export async function createOrder(values) {
  // Required: restaurant_id, table_id, items (min 1). reservation_id/
  // customer_id/notes optional — reservation_id/customer_id are
  // deliberately not collected by OrderCreate.jsx's form (no
  // reservation/customer lookup screen exists yet, same "real but no UI
  // to source it from" precedent as Phase 17's ReservationForm).
  const res = await staffClient.post('/restaurant/orders', values)
  return res.data.data
}

export async function listOrders({ restaurantId, tableId, status } = {}) {
  const res = await staffClient.get('/restaurant/orders', {
    params: {
      restaurant_id: restaurantId || undefined,
      table_id: tableId || undefined,
      status: status || undefined,
    },
  })
  return res.data.data // [{ id, restaurant_id, table_id, reservation_id, customer_id, status, subtotal, tax_amount, total_amount, currency, notes, placed_by_staff_id, created_at }]
}

export async function getOrder(orderId) {
  // Returns DineInOrderDetailRead — same fields as listOrders' rows plus
  // a nested `items` array: [{ id, menu_item_id, item_name, quantity,
  // unit_price, line_total, special_instructions }].
  const res = await staffClient.get(`/restaurant/orders/${orderId}`)
  return res.data.data
}

export async function billOrder(orderId) {
  // Flag #3 (Global Context Prompt §1 Bucket B): marks the order
  // "billed" only — does NOT create a real Payment record the way hotel
  // invoices do (Phase 16). See BillModal.jsx for the in-app note and
  // PROGRESS.md Open Question (3).
  const res = await staffClient.post(`/restaurant/orders/${orderId}/bill`)
  return res.data.data
}

export async function cancelOrder(orderId) {
  const res = await staffClient.post(`/restaurant/orders/${orderId}/cancel`)
  return res.data.data
}

// ---- Kitchen tickets (Phase 20) -----------------------------------------
// Gating (RBAC_MATRIX v7 §4.9/§6.7): restaurant:kitchen:read gates both
// GET endpoints below; restaurant:kitchen:write gates the status-update
// endpoint. Kitchen (the role) holds BOTH and NOTHING else in this
// domain — confirmed no restaurant:order:* grant exists for Kitchen,
// which is why GET /restaurant/kitchen/{id} returns order-item summaries
// AND table_id embedded directly on KitchenTicketDetailRead (RBAC_MATRIX
// §4.9). This file deliberately does NOT call any restaurant:order:*
// endpoint from these three functions, and KitchenTicketBoard.jsx (the
// only consumer) doesn't either.
//
// KitchenTicket.status IS a confirmed, real enum this phase — taken
// verbatim from the PUT /kitchen/{id}/status request schema's
// description field: "pending" | "preparing" | "ready" | "served" |
// "cancelled" — NOT inferred, same treatment as Phase 13's
// ROOM_STATUSES and Phase 17's Table.status. FLAGGED DISCREPANCY: the
// GET list/detail response's own example payload shows "queued" as its
// one example status value, which is not in the description-confirmed
// enum above. Treated the description field as authoritative (this
// project's standing precedent for confirmed enums) and "queued" as a
// stale/mismatched example rather than a real 6th value — but flagging
// here in case that assumption is wrong and needs re-checking against a
// live ticket.

export async function listKitchenTickets({ status } = {}) {
  const res = await staffClient.get('/restaurant/kitchen', {
    params: { status: status || undefined },
  })
  return res.data.data // [{ id, order_id, status, notes, started_at, ready_at, served_at, created_at }]
}

export async function getKitchenTicket(ticketId) {
  // Returns KitchenTicketDetailRead — same fields as listKitchenTickets'
  // rows plus table_id and a nested items array: [{ id, menu_item_id,
  // item_name, quantity, unit_price, line_total, special_instructions }].
  // Still the kitchen domain's own endpoint, not restaurant:order:* — see
  // header note above.
  const res = await staffClient.get(`/restaurant/kitchen/${ticketId}`)
  return res.data.data
}

export async function updateKitchenTicketStatus(ticketId, status, notes) {
  const res = await staffClient.put(`/restaurant/kitchen/${ticketId}/status`, {
    status,
    notes: notes || undefined,
  })
  return res.data.data
}

export async function uploadRestaurantImage(restaurantId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await staffClient.post(`/restaurant/restaurants/${restaurantId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}