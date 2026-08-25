"""Staff account CRUD + the invite flow. Staff never self-register — accounts are
created by an admin and staff set their own password via an emailed invite link
(PROJECT_STATE.md §3 rule 1 / Open Decisions #7).
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.repositories import staff_session_repository, staff_user_repository
from app.shared_kernel.services import email_service, password_reset_service


async def _send_invite_email(db: AsyncSession, staff: StaffUser) -> None:
    """Generate a fresh "invite" token and email the staff-invite template."""
    raw_token = await password_reset_service.generate_token(
        db, principal_type="staff", principal_id=staff.id, purpose="invite"
    )
    invite_link = f"{settings.APP_BASE_URL}/staff/accept-invite?token={raw_token}"
    await email_service.send_email(
        to_email=staff.email,
        subject="You've been invited to join the team",
        template_name="staff_invite.html",
        context={"recipient_name": staff.first_name, "invite_link": invite_link},
    )


async def invite_staff(
    db: AsyncSession,
    *,
    email: str,
    first_name: str,
    last_name: str,
    role_id: UUID,
    department_id: Optional[UUID] = None,
) -> StaffUser:
    """Create a new, inactive staff account and immediately send the invite email.

    Raises:
        ConflictError: a staff account with this email already exists.
    """
    existing = await staff_user_repository.get_by_email(db, email)
    if existing is not None:
        raise ConflictError(f"A staff account with email '{email}' already exists.")

    staff = await staff_user_repository.create(
        db,
        email=email,
        first_name=first_name,
        last_name=last_name,
        role_id=role_id,
        department_id=department_id,
        password_hash=None,
        is_active=False,
    )
    await _send_invite_email(db, staff)
    return staff


async def resend_invite(db: AsyncSession, staff_id: UUID) -> None:
    """Resend the invite email for an existing, not-yet-activated staff account.

    Raises:
        NotFoundError: staff account does not exist.
        ConflictError: staff account is already active.
    """
    staff = await staff_user_repository.get_by_id(db, staff_id)
    if staff is None:
        raise NotFoundError("Staff account not found.")
    if staff.is_active:
        raise ConflictError("This staff account has already accepted its invite.")
    await _send_invite_email(db, staff)


async def accept_invite(db: AsyncSession, *, token: str, new_password: str) -> StaffUser:
    """Consume an "invite" token, set the staff member's password, and activate the account.

    Raises:
        NotFoundError / ConflictError / ValidationError: from password_reset_service.
    """
    from app.domains.iam.services.auth_service import validate_password_policy

    await validate_password_policy(db, new_password)
    consumed = await password_reset_service.consume_token(db, raw_token=token, purpose="invite")

    staff = await staff_user_repository.get_by_id(db, consumed.principal_id)
    if staff is None:
        raise NotFoundError("Associated staff account no longer exists.")

    staff.password_hash = hash_password(new_password)
    staff.is_active = True
    return await staff_user_repository.save(db, staff)


async def list_staff(db: AsyncSession) -> List[StaffUser]:
    """List every staff account."""
    return await staff_user_repository.list_all(db)


async def get_staff(db: AsyncSession, staff_id: UUID) -> StaffUser:
    """Fetch a single staff account by id.

    Raises:
        NotFoundError: no staff account with that id exists.
    """
    staff = await staff_user_repository.get_by_id(db, staff_id)
    if staff is None:
        raise NotFoundError("Staff account not found.")
    return staff


async def update_staff(
    db: AsyncSession,
    staff_id: UUID,
    *,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    role_id: Optional[UUID] = None,
    department_id: Optional[UUID] = None,
) -> StaffUser:
    """Update a staff account's editable fields."""
    staff = await get_staff(db, staff_id)
    if first_name is not None:
        staff.first_name = first_name
    if last_name is not None:
        staff.last_name = last_name
    if role_id is not None:
        staff.role_id = role_id
    if department_id is not None:
        staff.department_id = department_id
    return await staff_user_repository.save(db, staff)


async def deactivate_staff(db: AsyncSession, staff_id: UUID, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a staff account and revoke all of its active sessions."""
    staff = await get_staff(db, staff_id)
    await staff_session_repository.revoke_all_for_staff(db, staff.id)
    await staff_user_repository.soft_delete(db, staff, deleted_by_staff_id=deleted_by_staff_id)