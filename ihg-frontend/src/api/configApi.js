import axios from 'axios'

// GET /config is explicitly public/unauthenticated (confirmed via RBAC_MATRIX
// §6.1 and the openapi.json description: "safe to call with no authentication").
// Deliberately NOT using staffClient or customerClient — this call must never
// carry either token, and using a shared client risks an interceptor someday
// attaching one by accident. Same relative baseURL convention as the other two
// clients — nginx makes this same-origin in every environment.
const configClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Fetches the merged branding + public-settings config.
 * Real, confirmed response shape (via live call, not the spec — /config's
 * response is documented as untyped `{"type": "object"}` in openapi.json):
 *   { success, message, data: { company_name, logo_url, primary_color,
 *     secondary_color, currency, timezone, locale, footer_text, ...more
 *     may appear later as public settings rows are added }, meta }
 *
 * Returns the unwrapped `data` object as-is — callers should NOT assume a
 * fixed key set beyond what's documented above, since /config is a dynamic
 * merge (branding + whatever settings rows currently have is_public: true).
 */
export async function fetchPublicConfig() {
  const response = await configClient.get('/config')
  return response.data.data
}