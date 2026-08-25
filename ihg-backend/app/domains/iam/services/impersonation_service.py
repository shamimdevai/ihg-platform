"""Superadmin-only impersonation. Every impersonation is unconditionally audit-logged
(PROJECT_STATE.md §7.3).
"""
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from app.core.security import create_access_token
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.repositories import staff_user_repository
from app.domains.iam.schemas.auth import TokenResponse
from app.domains.iam.services import audit_service


async def impersonate(
    db: AsyncSession, *, superadmin: StaffUser, target_type: str, target_id: UUID
) -> TokenResponse:
    """Issue a short-lived access token acting as `target_id`, on behalf of `superadmin`.

    Raises:
        PermissionDeniedError: caller is not a superadmin.
        NotFoundError: target staff account does not exist.
        ValidationError: target_type is not "staff" (customer impersonation is not
            available until the Customers domain exists — Phase 4).
    """
    if not superadmin.is_superadmin:
        raise PermissionDeniedError("Only superadmins may impersonate other accounts.")

    if target_type != "staff":
        if target_type == "customer":
            raise ValidationError(
                "Customer impersonation is not available until the Customers domain (Phase 4) is built."
            )
        raise ValidationError(f"Unknown target_type: {target_type}")

    target = await staff_user_repository.get_by_id(db, target_id)
    if target is None:
        raise NotFoundError("Target staff account not found.")

    access_token = create_access_token(
        subject=target.id,
        principal_type="staff",
        extra_claims={"impersonated_by": str(superadmin.id), "is_superadmin": target.is_superadmin},
    )

    await audit_service.log_action(
        db,
        staff_user_id=target.id,
        action="impersonation_started",
        entity_type="staff_user",
        entity_id=target.id,
        impersonated_by_staff_id=superadmin.id,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=None,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )