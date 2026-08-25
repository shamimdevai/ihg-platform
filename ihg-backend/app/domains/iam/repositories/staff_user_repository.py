"""Raw database queries for the staff_users table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.iam.models.staff_user import StaffUser


async def get_by_id(db: AsyncSession, staff_id: UUID) -> Optional[StaffUser]:
    """Fetch a staff user by id, excluding soft-deleted rows."""
    result = await db.execute(
        select(StaffUser).where(StaffUser.id == staff_id, StaffUser.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def get_by_email(db: AsyncSession, email: str) -> Optional[StaffUser]:
    """Fetch a staff user by email, excluding soft-deleted rows."""
    result = await db.execute(
        select(StaffUser).where(StaffUser.email == email, StaffUser.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> List[StaffUser]:
    """List every non-soft-deleted staff user."""
    result = await db.execute(select(StaffUser).where(StaffUser.is_deleted.is_(False)))
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    *,
    email: str,
    first_name: str,
    last_name: str,
    role_id: UUID,
    department_id: Optional[UUID] = None,
    password_hash: Optional[str] = None,
    is_active: bool = False,
    is_superadmin: bool = False,
) -> StaffUser:
    """Insert a new staff user row."""
    staff = StaffUser(
        email=email,
        first_name=first_name,
        last_name=last_name,
        role_id=role_id,
        department_id=department_id,
        password_hash=password_hash,
        is_active=is_active,
        is_superadmin=is_superadmin,
    )
    db.add(staff)
    await db.flush()
    await db.refresh(staff)
    return staff


async def save(db: AsyncSession, staff: StaffUser) -> StaffUser:
    """Persist changes made to an already-fetched StaffUser instance."""
    await db.flush()
    await db.refresh(staff)
    return staff


async def soft_delete(db: AsyncSession, staff: StaffUser, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a staff user. Never hard-delete business records."""
    from datetime import datetime, timezone

    staff.is_deleted = True
    staff.deleted_at = datetime.now(timezone.utc)
    staff.deleted_by_staff_id = deleted_by_staff_id
    await db.flush()