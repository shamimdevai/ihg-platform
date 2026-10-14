import staffClient from '../staffClient'

// hotel domain — this file grows further in Phases 14 (bookings/check-in/
// out), 15 (housekeeping), and 16 (invoices). Phase 13 only builds the
// hotels/room-types/rooms portion below.
//
// Gating (RBAC_MATRIX v7 §4.8/§6.6): hotel:room:read covers GET on
// hotels, room-types, AND rooms (they share one pair — a Hotel is the
// top of the room/room-type hierarchy, not a distinct resource).
// hotel:room:write covers POST/PUT on all three. Reception holds
// hotel:room:read only (not write) — Reception's own write grant is
// hotel:booking:write, a separate code (§3.2).
//
// Backlog item 7, RESOLVED: room-type edit+delete and general room edit
// now exist on the backend (see updateRoomType/deleteRoomType/updateRoom
// below). Hotel and Room deliberately still have NO hard-delete
// endpoint — both already carry a real is_active column, and the
// decision was to use that (deactivate) rather than add true delete,
// given Hotel → RoomType → Room → Booking is a real, meaningful
// dependency chain. RoomType DOES get real hard delete (blocked with a
// 409 if any active room still uses it) since it has no is_active
// column of its own.

// ---- Hotels -----------------------------------------------------------
// Not named in Phase 13's own deliverable list, but POST/GET/PUT
// /hotel/hotels are real endpoints in this phase's given tag/slice, and
// room-types/rooms can't be created without a hotel_id to attach to —
// added as a minimal, ahead-of-deliverable addition (flagged in chat),
// kept deliberately small: create + list only, no hotel-edit UI this
// phase even though PUT exists.

export async function listHotels() {
  const res = await staffClient.get('/hotel/hotels')
  return res.data.data // [{ id, name, address, phone, email, is_active }]
}

export async function createHotel(values) {
  const res = await staffClient.post('/hotel/hotels', values)
  return res.data.data
}

export async function getHotel(hotelId) {
  const res = await staffClient.get(`/hotel/hotels/${hotelId}`)
  return res.data.data
}

export async function updateHotel(hotelId, values) {
  const res = await staffClient.put(`/hotel/hotels/${hotelId}`, values)
  return res.data.data
}

// ---- Room types -----------------------------------------------------------

export async function listRoomTypes(hotelId) {
  const res = await staffClient.get(`/hotel/hotels/${hotelId}/room-types`)
  return res.data.data // [{ id, hotel_id, name, description, base_rate, capacity, amenities }]
}

export async function createRoomType(hotelId, values) {
  // Schema requires hotel_id in the body too, even though it's also in
  // the path — sending both, per the real request schema given.
  const res = await staffClient.post(`/hotel/hotels/${hotelId}/room-types`, {
    hotel_id: hotelId,
    ...values,
  })
  return res.data.data
}

export async function updateRoomType(hotelId, roomTypeId, values) {
  const res = await staffClient.put(`/hotel/hotels/${hotelId}/room-types/${roomTypeId}`, values)
  return res.data.data
}

// Errors are NOT swallowed — RoomTypesList.jsx reads
// err.response.data.message directly so a 409 ("still used by N
// room(s)...") reaches the person instead of a generic failure toast.
export async function deleteRoomType(hotelId, roomTypeId) {
  const res = await staffClient.delete(`/hotel/hotels/${hotelId}/room-types/${roomTypeId}`)
  return res.data
}

// ---- Rooms ------------------------------------------------------------------

export async function listRooms({ hotelId, status } = {}) {
  const res = await staffClient.get('/hotel/rooms', {
    params: {
      hotel_id: hotelId || undefined,
      status: status || undefined,
    },
  })
  return res.data.data // [{ id, hotel_id, room_type_id, room_number, floor, status, is_active }]
}

export async function createRoom(values) {
  const res = await staffClient.post('/hotel/rooms', values)
  return res.data.data
}

export async function getRoom(roomId) {
  const res = await staffClient.get(`/hotel/rooms/${roomId}`)
  return res.data.data
}

// General edit — room_number/floor/room_type_id/is_active — separate
// from updateRoomStatus below (status keeps its own single-purpose
// endpoint/UI, unchanged).
export async function updateRoom(roomId, values) {
  const res = await staffClient.put(`/hotel/rooms/${roomId}`, values)
  return res.data.data
}

export async function updateRoomStatus(roomId, status) {
  const res = await staffClient.put(`/hotel/rooms/${roomId}/status`, { status })
  return res.data.data
}

// ---- Bookings / check-in / check-out ---------------------------------
// Phase 14. Gating (RBAC_MATRIX v7 §4.8/§6.6): hotel:booking:read covers
// GET (list/get); hotel:booking:write covers create/cancel/checkin/
// checkout — all four POST-shaped actions share this one code, matching
// this codebase's confirmed-live scope-verification note that
// hotel:booking:write has zero reachable path into invoice/payment
// logic. Reception holds BOTH codes for this resource (unlike
// hotel:room:write, which Reception does not hold).
//
// Booking.status has no confirmed enum block anywhere in this phase's
// given OpenAPI slice — only a single example value ("confirmed") is
// shown, and the Global Context Prompt's own "reserved → checked_in →
// checked_out/cancelled" wording is explicitly flagged as a paraphrase,
// not a guaranteed literal. Same treatment as Phase 11's alert `status`
// and Phase 12's Payment/RefundRequest `status`: NOT hardcoded into a
// dropdown of assumed values here. See BookingsList.jsx for how this is
// handled (free-text filter + action buttons gated off real typed
// fields — actual_check_in_at / actual_check_out_at / cancelled_reason
// — rather than off the unconfirmed status string).

export async function listBookings({ hotelId, roomId, guestId, status } = {}) {
  const res = await staffClient.get('/hotel/bookings', {
    params: {
      hotel_id: hotelId || undefined,
      room_id: roomId || undefined,
      guest_id: guestId || undefined,
      status: status || undefined,
    },
  })
  return res.data.data // [{ id, hotel_id, room_id, guest_id, check_in_date, check_out_date, actual_check_in_at, actual_check_out_at, num_guests, rate_per_night, total_amount, status, notes, cancelled_reason, created_at }]
}

export async function getBooking(bookingId) {
  const res = await staffClient.get(`/hotel/bookings/${bookingId}`)
  return res.data.data
}

export async function createBooking(values) {
  // Required: hotel_id, room_id, guest_id, check_in_date, check_out_date.
  // num_guests/notes optional per the real request schema.
  const res = await staffClient.post('/hotel/bookings', values)
  return res.data.data
}

export async function cancelBooking(bookingId, reason) {
  // Entire request body is optional per the real schema — `reason` may
  // be omitted entirely, not just sent as an empty string.
  const res = await staffClient.post(`/hotel/bookings/${bookingId}/cancel`, reason ? { reason } : {})
  return res.data.data
}

export async function checkInBooking(bookingId) {
  const res = await staffClient.post(`/hotel/checkin/${bookingId}`)
  return res.data.data
}

export async function checkOutBooking(bookingId) {
  // CONFIRMED from source: this does NOT auto-generate an invoice.
  // Invoice generation is an explicit separate call
  // (POST /hotel/invoices/generate/{booking_id}), Phase 16's own scope
  // — not wired up from here.
  const res = await staffClient.post(`/hotel/checkout/${bookingId}`)
  return res.data.data
}

// ---- Housekeeping tasks -------------------------------------------------
// Phase 15. Gating (RBAC_MATRIX v7 §4.8/§6.6): hotel:housekeeping:read
// covers GET (list/get); hotel:housekeeping:write covers create/assign/
// status-update — all three share this one code. This is Housekeeping's
// ONLY granted screen in the entire app (no hotel:room:*, hotel:booking:*,
// or iam:staff:read at all) — TaskBoard.jsx must never assume any other
// domain's read access is available and must degrade gracefully if it
// isn't (same defensive pattern Phase 14's guest dropdown used).
//
// HousekeepingTask.status has NO confirmed enum anywhere in this phase's
// given OpenAPI slice — both the task's own `status` field and the
// PUT .../status request body are plain `{"type": "string"}`, with only
// a single example value ("pending"). NOT hardcoded as a closed enum
// here — see TaskBoard.jsx for how this is handled (inferred, flagged
// colorMap + free-text status filter, same treatment Booking/Payment/
// RefundRequest got in Phases 12/14).
//
// createHousekeepingTask / assignHousekeepingTask are included below
// because they're real endpoints in this phase's given slice, but
// NEITHER is called from anywhere in TaskBoard.jsx this phase — the
// brief scopes this screen to "view assigned tasks, update status" only.
// Flagged in chat, not silently built speculatively or silently omitted.

export async function listHousekeepingTasks({ roomId, status, assignedToStaffId } = {}) {
  const res = await staffClient.get('/hotel/housekeeping', {
    params: {
      room_id: roomId || undefined,
      status: status || undefined,
      assigned_to_staff_id: assignedToStaffId || undefined,
    },
  })
  return res.data.data // [{ id, room_id, booking_id, task_type, status, notes, assigned_to_staff_id, completed_at, created_at }]
}

export async function getHousekeepingTask(taskId) {
  const res = await staffClient.get(`/hotel/housekeeping/${taskId}`)
  return res.data.data
}

export async function createHousekeepingTask(values) {
  // Required: room_id. Optional: booking_id, task_type (server defaults
  // "cleaning"), notes, assigned_to_staff_id. Not called this phase.
  const res = await staffClient.post('/hotel/housekeeping', values)
  return res.data.data
}

export async function assignHousekeepingTask(taskId, assignedToStaffId) {
  // Not called this phase — see note above.
  const res = await staffClient.put(`/hotel/housekeeping/${taskId}/assign`, {
    assigned_to_staff_id: assignedToStaffId,
  })
  return res.data.data
}

export async function updateHousekeepingTaskStatus(taskId, status, notes) {
  const res = await staffClient.put(`/hotel/housekeeping/${taskId}/status`, {
    status,
    ...(notes !== undefined && notes !== '' ? { notes } : {}),
  })
  return res.data.data
}

// ---- Invoices --------------------------------------------------------
// Phase 16. Gating (RBAC_MATRIX v7 §4.8/§5.1/§6.6): hotel:invoice:read
// covers GET (list/get/pdf); hotel:invoice:write covers generate/issue/
// pay — all three share this one code. CONFIRMED Admin-only via a real
// HTTP test rejecting Reception (403, RBAC_MATRIX §6.6/§9.4a) — neither
// Reception nor Housekeeping holds either code, unlike every other
// hotel resource built so far in this app.
//
// Invoice.status has no confirmed enum in this phase's given slice
// (single example value "draft", no `enum` block) — same treatment as
// Booking/HousekeepingTask before it. See InvoiceList.jsx for the
// inferred, flagged colorMap.

export async function listInvoices({ status } = {}) {
  const res = await staffClient.get('/hotel/invoices', {
    params: { status: status || undefined },
  })
  return res.data.data // [{ id, booking_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, payment_id, issued_at, notes, created_at }]
}

export async function generateInvoice(bookingId) {
  const res = await staffClient.post(`/hotel/invoices/generate/${bookingId}`)
  return res.data.data
}

export async function getInvoice(invoiceId) {
  // Returns InvoiceDetailRead — same fields as the list shape plus a
  // nested `items` array (id, description, item_type, quantity,
  // unit_price, line_total), confirmed from source.
  const res = await staffClient.get(`/hotel/invoices/${invoiceId}`)
  return res.data.data
}

export async function issueInvoice(invoiceId) {
  const res = await staffClient.post(`/hotel/invoices/${invoiceId}/issue`)
  return res.data.data
}

export async function payInvoice(invoiceId, methodId) {
  // The one endpoint that actually reaches into payments AND updates
  // this invoice's own status/payment_id — see PayInvoiceForm.jsx's
  // header comment (and the chat message this phase was delivered in)
  // for the flagged design conflict on why this is used instead of
  // orchestrating POST /payments/intents + /confirm directly here.
  const res = await staffClient.post(`/hotel/invoices/${invoiceId}/pay`, {
    method_id: methodId || null,
  })
  return res.data.data
}

export async function getInvoicePdf(invoiceId) {
  // Binary PDF stream, NOT the {success,message,data} envelope — same
  // precedent as reporting's revenue/export endpoint (RBAC_MATRIX §6.9).
  // Request as a blob; caller triggers the browser download.
  const res = await staffClient.get(`/hotel/invoices/${invoiceId}/pdf`, {
    responseType: 'blob',
  })
  return res.data
}

// ---- Service requests ---------------------------------------------------
// Phase 16. Gating (RBAC_MATRIX v7 §4.8/§5.1/§6.6): hotel:service_request:read
// covers GET; hotel:service_request:write covers create/assign/status-
// update. CONFIRMED Admin-only, by explicit backend design (§4.8: "the
// one resource in this domain that follows the Phase 5/6/6.5 pattern
// rather than breaking it") — no Reception/Housekeeping grant exists.
// This is a SEPARATE permission code from hotel:invoice:* — currently
// indistinguishable in practice since only Admin's "*" holds either,
// but ServiceRequestsList.jsx gates on this code specifically, not on
// hotel:invoice:read, in case a future custom role ever splits them.
//
// ServiceRequest.status has no confirmed enum in this phase's given
// slice (single example value "pending", no `enum` block) — same
// inferred-colorMap treatment as every other unconfirmed status field.
//
// createServiceRequest / assignServiceRequest / updateServiceRequestStatus
// are real endpoints in this phase's given slice but are NOT called from
// anywhere in ServiceRequestsList.jsx this phase — the acceptance
// checklist scopes that screen to "viewable" only, same discipline
// Phase 15 applied to createHousekeepingTask/assignHousekeepingTask.
// Flagged here, not silently built speculatively.

export async function createServiceRequest(values) {
  // Required: booking_id, room_id, request_type. Optional: description.
  // Not called this phase.
  const res = await staffClient.post('/hotel/service-requests', values)
  return res.data.data
}

export async function listServiceRequests({ bookingId, status } = {}) {
  const res = await staffClient.get('/hotel/service-requests', {
    params: {
      booking_id: bookingId || undefined,
      status: status || undefined,
    },
  })
  return res.data.data // [{ id, booking_id, room_id, request_type, description, status, assigned_to_staff_id, completed_at, created_at }]
}

export async function getServiceRequest(requestId) {
  const res = await staffClient.get(`/hotel/service-requests/${requestId}`)
  return res.data.data
}

export async function assignServiceRequest(requestId, assignedToStaffId) {
  // Not called this phase — see note above.
  const res = await staffClient.put(`/hotel/service-requests/${requestId}/assign`, {
    assigned_to_staff_id: assignedToStaffId,
  })
  return res.data.data
}

export async function updateServiceRequestStatus(requestId, status) {
  // Not called this phase — see note above.
  const res = await staffClient.put(`/hotel/service-requests/${requestId}/status`, { status })
  return res.data.data
}

// Photo uploads — multipart, not JSON (same approach as uploadMenuItemImage).
export async function uploadHotelImage(hotelId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await staffClient.post(`/hotel/hotels/${hotelId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}

export async function uploadRoomTypeImage(hotelId, roomTypeId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await staffClient.post(`/hotel/hotels/${hotelId}/room-types/${roomTypeId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}