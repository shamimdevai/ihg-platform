import staffClient from '../staffClient'

// payments-refund-admin — the request/review half of the dual-refund
// architecture (RBAC_MATRIX §4.7 Path B), gated by payments:refund:review.
// Filing a NEW refund request (POST /payments/{id}/refund-requests, gated
// payments:refund:request) is a distinct staff action from reviewing one
// and is NOT built this phase — every seeded role that holds
// payments:refund:request today also holds payments:refund:direct
// (Admin, via "*", is the only real grant — RBAC_MATRIX §5.1), so no
// real staff user exists yet who would use a "file a request" screen
// instead of just refunding directly via paymentsApi.refundPayment().
// Flagged in docs/PROGRESS.md rather than built speculatively.

export async function listRefundRequests(status) {
  const res = await staffClient.get('/admin/refund-requests', {
    params: status ? { status } : undefined,
  })
  return res.data.data
}

export async function approveRefundRequest(requestId, { review_reason } = {}) {
  const res = await staffClient.post(`/admin/refund-requests/${requestId}/approve`, {
    review_reason: review_reason || null,
  })
  return res.data.data
}

export async function rejectRefundRequest(requestId, { reason }) {
  const res = await staffClient.post(`/admin/refund-requests/${requestId}/reject`, {
    reason,
  })
  return res.data.data
}