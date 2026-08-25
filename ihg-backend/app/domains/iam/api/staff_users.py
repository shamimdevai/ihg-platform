"""CRUD endpoints for staff accounts + invite management."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.schemas.auth import InviteStaffRequest
from app.domains.iam.schemas.staff_user import StaffUserRead, StaffUserUpdate
from app.domains.iam.services import staff_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/iam/staff", tags=["iam-staff"])


@router.get("", dependencies=[Depends(require_permission("iam:staff:read"))])
async def list_staff(db: AsyncSession = Depends(get_db)) -> dict:
    """List every staff account."""
    staff_list = await staff_service.list_staff(db)
    return envelope(data=[StaffUserRead.model_validate(s) for s in staff_list])


@router.get("/{staff_id}", dependencies=[Depends(require_permission("iam:staff:read"))])
async def get_staff(staff_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Get a single staff account by id."""
    staff = await staff_service.get_staff(db, staff_id)
    return envelope(data=StaffUserRead.model_validate(staff))


@router.post("", dependencies=[Depends(require_permission("iam:staff:write"))])
async def create_staff(payload: InviteStaffRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Create a new (inactive) staff account and send the invite email."""
    staff = await staff_service.invite_staff(
        db,
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role_id=payload.role_id,
        department_id=payload.department_id,
    )
    return envelope(data=StaffUserRead.model_validate(staff), message="Staff account created and invite sent.")


@router.put("/{staff_id}", dependencies=[Depends(require_permission("iam:staff:write"))])
async def update_staff(staff_id: UUID, payload: StaffUserUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    """Update a staff account's editable fields."""
    staff = await staff_service.update_staff(
        db,
        staff_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role_id=payload.role_id,
        department_id=payload.department_id,
    )
    return envelope(data=StaffUserRead.model_validate(staff), message="Staff account updated.")


@router.delete("/{staff_id}", dependencies=[Depends(require_permission("iam:staff:write"))])
async def deactivate_staff(
    staff_id: UUID,
    current_staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Soft-delete a staff account and revoke its sessions."""
    await staff_service.deactivate_staff(db, staff_id, deleted_by_staff_id=current_staff.id)
    return envelope(message="Staff account deactivated.")


@router.post("/{staff_id}/invite", dependencies=[Depends(require_permission("iam:staff:write"))])
async def resend_invite(staff_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Resend the invite email for a not-yet-activated staff account."""
    await staff_service.resend_invite(db, staff_id)
    return envelope(message="Invite email resent.")