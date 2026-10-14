import staffClient from '../staffClient'

// payments — base lifecycle browsing + direct refund only (RBAC_MATRIX
// §4.5/§4.7). Payment INITIATION (POST /payments/intents,
// POST /{id}/confirm) is deliberately NOT included here — that's Phase
// 16, tied specifically to hotel invoices (the only domain with a real
// "pay now" flow this platform has). Payment METHODS endpoints
// (/payments/methods*) are also real but out of scope this phase — see
// docs/PROGRESS.md "Notes for next session" (mirrors the Phase 10
// linkGuestToCustomer() precedent: real function, no UI to call it yet).

export async function listPayments({ reference_type, reference_id } = {}) {
  const params = {}
  if (reference_type) params.reference_type = reference_type
  if (reference_id) params.reference_id = reference_id
  const res = await staffClient.get('/payments', { params })
  return res.data.data
}

export async function getPayment(paymentId) {
  const res = await staffClient.get(`/payments/${paymentId}`)
  return res.data.data
}

// Direct refund — gated by payments:refund:direct, distinct from the
// request/review flow in paymentsRefundAdminApi.js. Applies immediately,
// no approval step (RBAC_MATRIX §4.7 Path A).
export async function refundPayment(paymentId, { reason } = {}) {
  const res = await staffClient.post(`/payments/${paymentId}/refund`, {
    reason: reason || null,
  })
  return res.data.data
}

// ---- Payment intent / confirm (Phase 16) -------------------------------
// Real endpoints, included per this phase's given slice — gated by
// payments:write (RBAC_MATRIX §4.5/§6.5), Admin-only like every other
// payments:* code. NOT currently called from PayInvoiceForm.jsx — see
// that file's header comment: POST /hotel/invoices/{id}/pay
// (hotelApi.js's payInvoice()) is the endpoint that actually updates an
// Invoice's own status/payment_id fields, and RBAC_MATRIX §4.8/§6.6
// documents it as internally calling create_payment_intent()/
// confirm_payment() itself, server-side. Orchestrating these two calls
// directly from this screen instead would create a real Payment row
// (reference_type="hotel_invoice") but leave the Invoice's own
// status/payment_id untouched — a real design conflict, flagged rather
// than silently resolved. Kept here, real and unwired, same treatment
// as Phase 10's linkGuestToCustomer() and Phase 12's Payment Methods
// functions — in case a future decision prefers manual orchestration.

export async function createPaymentIntent(values) {
  // Required: reference_type, reference_id, amount. Optional: currency,
  // method_id.
  const res = await staffClient.post('/payments/intents', values)
  return res.data.data
}

export async function confirmPayment(paymentId, { methodId, simulateOutcome, failureReason } = {}) {
  const res = await staffClient.post(`/payments/${paymentId}/confirm`, {
    method_id: methodId || null,
    ...(simulateOutcome ? { simulate_outcome: simulateOutcome } : {}),
    ...(failureReason ? { failure_reason: failureReason } : {}),
  })
  return res.data.data
}