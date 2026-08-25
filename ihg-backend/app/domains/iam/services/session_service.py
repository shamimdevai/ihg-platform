"""List/revoke staff sessions ("logout everywhere")."""
from typing import List
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.domains.iam.models.staff_session import StaffSession
from app.domains.iam.repositories import staff_session_repository


async def list_sessions(db: AsyncSession, staff_user_id: UUID) -> List[StaffSession]:
    """List a staff user's active sessions."""
    return await staff_session_repository.list_active_by_staff(db, staff_user_id)


async def revoke_session(db: AsyncSession, *, staff_user_id: UUID, session_id: UUID) -> None:
    """Revoke a single session, verifying it belongs to the requesting staff member.

    Raises:
        NotFoundError: session does not exist.
        PermissionDeniedError: session belongs to a different staff member.
    """
    sessions = await staff_session_repository.list_active_by_staff(db, staff_user_id)
    target = next((s for s in sessions if s.id == session_id), None)
    if target is None:
        raise NotFoundError("Session not found.")
    if target.staff_user_id != staff_user_id:
        raise PermissionDeniedError("Cannot revoke another staff member's session.")
    await staff_session_repository.revoke(db, target)


async def revoke_all_sessions(db: AsyncSession, staff_user_id: UUID) -> int:
    """Revoke every active session for a staff user. Returns the count revoked."""
    return await staff_session_repository.revoke_all_for_staff(db, staff_user_id)