import staffClient from '../staffClient';

// Hotel guest records — created/managed by staff only (Reception + Admin).
// Guests never authenticate themselves; there is no guest-token concept.
// See RBAC_MATRIX v7 §4.3 / §6.3.

export async function listGuests() {
  const { data } = await staffClient.get('/customers/guests');
  return data.data;
}

export async function getGuest(guestId) {
  const { data } = await staffClient.get(`/customers/guests/${guestId}`);
  return data.data;
}

export async function createGuest(payload) {
  const { data } = await staffClient.post('/customers/guests', payload);
  return data.data;
}

export async function updateGuest(guestId, payload) {
  const { data } = await staffClient.put(`/customers/guests/${guestId}`, payload);
  return data.data;
}

// Exists on the backend (POST /customers/guests/{guest_id}/link-customer/{customer_id})
// but deliberately not wired into any UI this phase — no staff-side customer-search
// screen exists yet to source a customer_id from. Exported for a future phase to use
// once that lookup exists; do not build a UI against this speculatively.
export async function linkGuestToCustomer(guestId, customerId) {
  const { data } = await staffClient.post(
    `/customers/guests/${guestId}/link-customer/${customerId}`
  );
  return data.data;
}