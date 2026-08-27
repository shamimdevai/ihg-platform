// Mirrors the backend's hierarchical wildcard resolution exactly
// (RBAC_MATRIX.md §9.2): exact code match → <domain>:<resource>:*
// → <domain>:* → * (platform wildcard). Also short-circuits for
// is_superadmin, matching the backend's separate, faster check ahead
// of normal role resolution (§1, §7 — superadmin is a boolean flag,
// NOT the same mechanism as a role holding "*").
//
// `user` shape expected: the object returned by GET /iam/auth/me —
// { is_superadmin, role: { permissions: [{ code, ... }] } }

export function hasPermission(user, requiredCode) {
  if (!user) return false
  if (user.is_superadmin) return true

  const codes = (user.role?.permissions || []).map((p) => p.code)
  if (codes.length === 0) return false

  // 1. Platform wildcard (Admin's real seeded grant)
  if (codes.includes('*')) return true

  // 2. Exact match
  if (codes.includes(requiredCode)) return true

  // 3/4. Resource wildcard, then domain wildcard — only applies to
  // 3-part codes (<domain>:<resource>:<action>). 2-part codes like
  // settings:read have no resource segment to wildcard against,
  // matching the backend's own collapse rule (RBAC_MATRIX §2).
  const parts = requiredCode.split(':')
  if (parts.length === 3) {
    const [domain, resource] = parts
    if (codes.includes(`${domain}:${resource}:*`)) return true
    if (codes.includes(`${domain}:*`)) return true
  } else if (parts.length === 2) {
    const [domain] = parts
    if (codes.includes(`${domain}:*`)) return true
  }

  return false
}