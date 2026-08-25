"""Shared FastAPI dependencies for API v1 routers.

`get_current_staff_user` / `require_permission` (staff) and `get_current_customer` /
`require_verified_customer` (customer) are the dependencies every protected endpoint,
in ANY domain, imports.

PRINCIPAL TYPES: JWT `principal_type` claim is "staff" or "customer" today.
"guest" is a reserved value (see PROJECT_STATE.md §7.1) but NOT issued by any flow
built so far — hotel guests have no login/password by design (Part A of the
architecture doc) and are managed exclusively by staff via customers.api.guests. If a
future phase introduces guest self-service (e.g. a lightweight booking-reference-based
token for in-room requests), it should mint a token with principal_type="guest" and
extend get_current_customer (or add a sibling dependency) accordingly — not silently
overload principal_type="customer" for that case.

MODULE TOGGLES: `require_module_enabled` (Phase 10) is a THIRD kind of gate, distinct
from both of the above — it doesn't check who's calling, it checks whether the
business-line module they're calling into is turned on for this deployment at all.
Applied once per domain at router-mount time in app/api/v1/api.py, never inside an
individual domain's own api/*.py files.
"""
from typing import Callable

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, PermissionDeniedError, UnauthorizedError
from app.db.connection import get_db  # noqa: F401  (re-exported for convenience)
from app.domains.customers.models.customer import Customer
from app.domains.iam.models.staff_user import StaffUser

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_staff_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> StaffUser:
    """Resolve the currently authenticated staff member from the Authorization header.

    Raises:
        UnauthorizedError: header missing, token invalid/expired, or account inactive.
    """
    from app.domains.iam.services import auth_service

    if credentials is None:
        raise UnauthorizedError("Missing bearer token.")
    return await auth_service.get_current_staff(db, credentials.credentials)


def require_permission(permission_code: str) -> Callable:
    """Dependency factory: gates an endpoint behind a specific staff permission code.

    Superadmins bypass the check entirely but remain subject to audit logging via
    AuditMiddleware.
    """

    async def _dependency(
        staff: StaffUser = Depends(get_current_staff_user),
        db: AsyncSession = Depends(get_db),
    ) -> StaffUser:
        from app.domains.iam.services import rbac_service

        if not await rbac_service.has_permission(db, staff, permission_code):
            raise PermissionDeniedError(f"Missing required permission: {permission_code}")
        return staff

    return _dependency


async def get_current_customer(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Customer:
    """Resolve the currently authenticated customer from the Authorization header.

    Completely separate from get_current_staff_user — a staff token and a customer
    token are never interchangeable (different principal_type claim, different tables).

    Raises:
        UnauthorizedError: header missing, token invalid/expired, wrong principal_type,
            or account inactive.
    """
    from app.domains.customers.services import customer_auth_service

    if credentials is None:
        raise UnauthorizedError("Missing bearer token.")
    return await customer_auth_service.get_current_customer(db, credentials.credentials)


async def require_verified_customer(
    customer: Customer = Depends(get_current_customer),
) -> Customer:
    """Gates an endpoint behind a verified email address.

    First wired into a live endpoint at Phase 9 (`POST /delivery/orders`).

    Raises:
        PermissionDeniedError: the customer's email is not yet verified.
    """
    if customer.email_verified_at is None:
        raise PermissionDeniedError("Please verify your email address before placing an order.")
    return customer


def require_module_enabled(module_key: str) -> Callable:
    """Dependency factory: 404s every route in a domain's router when that module's
    toggle (`<module_key>_module_enabled` in system_settings) is off.

    Applied ONCE per domain, at router-mount time in app/api/v1/api.py, via:
        api_router.include_router(
            some_hotel_router,
            dependencies=[Depends(require_module_enabled("hotel"))],
        )
    NOT added to individual domain route files — hotel/restaurant/delivery's own
    api/*.py files need zero changes for this to work.

    Checked fresh on every request via settings_service.get_setting(), which itself
    is cached in-process and invalidated on every write (settings_service.set_setting).
    Toggling the setting via `PUT /settings/{key}` takes effect on the very next
    request — no restart/redeploy required, consistent with the system_settings
    "no redeploy" design (PROJECT_STATE.md §3 rule 11 / §11).

    Returns 404, not 403 — a disabled module should look like it doesn't exist to a
    caller, not like a permission boundary an admin could be asked to lift.

    Args:
        module_key: e.g. "hotel", "restaurant", "delivery" — the setting checked is
            "<module_key>_module_enabled".
    """
    setting_key = f"{module_key}_module_enabled"

    async def _dependency(db: AsyncSession = Depends(get_db)) -> None:
        from app.domains.settings.services import settings_service

        enabled = await settings_service.get_setting(db, setting_key, default=True)
        if not enabled:
            raise NotFoundError(
                f"This module ('{module_key}') is not enabled for this deployment."
            )

    return _dependency