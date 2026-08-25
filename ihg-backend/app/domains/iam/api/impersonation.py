"""Superadmin-only impersonation endpoint."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.services import impersonation_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/iam", tags=["iam-impersonation"])


@router.post("/staff/{staff_id}/impersonate/{target_type}/{target_id}")
async def impersonate(
    staff_id: UUID,
    target_type: str,
    target_id: UUID,
    current_staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Impersonate `target_id` (of `target_type`) on behalf of the current superadmin.

    `staff_id` in the path must match the authenticated caller's own id — this
    confirms the caller is impersonating *as* themselves, matching
    PROJECT_STATE.md's documented route shape `/iam/staff/{id}/impersonate/...`.
    """
    from app.core.exceptions import PermissionDeniedError

    if staff_id != current_staff.id:
        raise PermissionDeniedError("You may only initiate impersonation as yourself.")

    tokens = await impersonation_service.impersonate(
        db, superadmin=current_staff, target_type=target_type, target_id=target_id
    )
    return envelope(data=tokens, message=f"Now impersonating {target_type} {target_id}.")