"""Raw database queries for the staff_sessions table. No business logic here."""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.iam.models.staff_session import StaffSession


async def create(
    db: AsyncSession,
    *,
    staff_user_id: UUID,
    refresh_token_hash: str,
    expires_at: datetime,
    device_info: Optional[str] = None,
) -> StaffSession:
    """Insert a new staff session row."""
    session = StaffSession(
        staff_user_id=staff_user_id,
        refresh_token_hash=refresh_token_hash,
        device_info=device_info,
        expires_at=expires_at,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


async def get_by_token_hash(db: AsyncSession, refresh_token_hash: str) -> Optional[StaffSession]:
    """Look up a session by its refresh token hash — the only way sessions are queried
    for authentication purposes.
    """
    result = await db.execute(
        select(StaffSession).where(
            StaffSession.refresh_token_hash == refresh_token_hash, StaffSession.is_deleted.is_(False)
        )
    )
    return result.scalar_one_or_none()


async def list_active_by_staff(db: AsyncSession, staff_user_id: UUID) -> List[StaffSession]:
    """List a staff user's currently active (non-revoked, non-expired) sessions."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(StaffSession).where(
            StaffSession.staff_user_id == staff_user_id,
            StaffSession.is_deleted.is_(False),
            StaffSession.revoked_at.is_(None),
            StaffSession.expires_at > now,
        )
    )
    return list(result.scalars().all())


async def revoke(db: AsyncSession, session: StaffSession) -> StaffSession:
    """Mark a single session as revoked."""
    session.revoked_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(session)
    return session


async def revoke_all_for_staff(db: AsyncSession, staff_user_id: UUID) -> int:
    """Revoke every active session for a staff user ("logout everywhere"). Returns the
    number of sessions revoked.
    """
    active = await list_active_by_staff(db, staff_user_id)
    for session in active:
        session.revoked_at = datetime.now(timezone.utc)
    await db.flush()
    return len(active)