"""Role-based access control logic.

`has_permission` is the single source of truth every other domain's protected
endpoint depends on (via app.api.v1.deps.require_permission). Superadmins bypass the
permission check entirely but every action they take still passes through audit logging
(handled separately by AuditMiddleware) — this bypass is authorization-only.

WILDCARD RESOLUTION (added Phase 4.5, PROJECT_STATE.md Open Decision #24 /
RBAC_MATRIX.md §9): a role may hold a wildcard permission code instead of (or in
addition to) exact codes — "*" (everything, platform-wide), "<domain>:*" (everything
in one domain), or "<domain>:<resource>:*" (everything for one resource). This is a
SEPARATE mechanism from is_superadmin (PROJECT_STATE.md §7.3): is_superadmin is a
hardcoded, non-revocable-via-API flag checked before a role is even consulted; a role
holding "*" is a normal, auditable, API-manageable role like any other — it just
happens to match every permission check via the resolution below.
"""
from typing import Iterable, List
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.repositories import role_repository

WILDCARD_SEGMENT = "*"


def _wildcard_candidates(permission_code: str) -> List[str]:
    """Build the ordered list of codes that would satisfy `permission_code`.

    Order (most to least specific): the exact code itself, then progressively
    broader wildcards obtained by replacing trailing segments with "*", ending
    with the global "*". Works uniformly for both 2-part codes (e.g.
    "settings:write" -> ["settings:write", "settings:*", "*"]) and 3-part codes
    (e.g. "customers:guests:write" ->
    ["customers:guests:write", "customers:guests:*", "customers:*", "*"]) — a
    2-part code has no resource segment to wildcard independently, so it skips
    straight from the exact match to the domain-level wildcard, which is the
    correct behavior for single-resource domains like `settings`.
    """
    parts = permission_code.split(":")
    candidates = [permission_code]
    for i in range(len(parts) - 1, 0, -1):
        candidates.append(":".join(parts[:i]) + f":{WILDCARD_SEGMENT}")
    candidates.append(WILDCARD_SEGMENT)
    return candidates


def _role_holds_any(held_codes: Iterable[str], candidates: Iterable[str]) -> bool:
    held = set(held_codes)
    return any(candidate in held for candidate in candidates)


async def has_permission(db: AsyncSession, staff: StaffUser, permission_code: str) -> bool:
    """Return True if `staff` may perform the action gated by `permission_code`.

    Resolution order:
      1. is_superadmin short-circuit (PROJECT_STATE.md §7.3) — unchanged, checked
         first, does not require a role at all.
      2. Exact permission_code match against the staff's role's permissions.
      3. "<domain>:<resource>:*" — everything for that resource (3-part codes only).
      4. "<domain>:*" — everything for that domain.
      5. "*" — everything, platform-wide.
    Steps 2-5 are evaluated together via `_wildcard_candidates` / `_role_holds_any`;
    the first matching candidate (in specificity order) grants access.
    """
    if staff.is_superadmin:
        return True

    if staff.role is None:
        return False

    held_codes = {p.code for p in staff.role.permissions}
    candidates = _wildcard_candidates(permission_code)
    return _role_holds_any(held_codes, candidates)


async def assign_permission_to_role(db: AsyncSession, *, role_id: UUID, permission_id: UUID) -> None:
    """Grant a permission to a role.

    Raises:
        NotFoundError: role does not exist.
    """
    role = await role_repository.get_by_id(db, role_id)
    if role is None:
        raise NotFoundError("Role not found.")
    await role_repository.add_permission(db, role_id=role_id, permission_id=permission_id)


async def remove_permission_from_role(db: AsyncSession, *, role_id: UUID, permission_id: UUID) -> None:
    """Revoke a permission from a role."""
    await role_repository.remove_permission(db, role_id=role_id, permission_id=permission_id)