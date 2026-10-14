"""Raw database queries for the departments table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.iam.models.department import Department


async def get_by_id(db: AsyncSession, department_id: UUID) -> Optional[Department]:
    """Fetch a department by id, excluding soft-deleted rows."""
    result = await db.execute(
        select(Department).where(Department.id == department_id, Department.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def get_by_name(db: AsyncSession, name: str) -> Optional[Department]:
    """Fetch a department by name, excluding soft-deleted rows."""
    result = await db.execute(
        select(Department).where(Department.name == name, Department.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> List[Department]:
    """List every non-soft-deleted department."""
    result = await db.execute(select(Department).where(Department.is_deleted.is_(False)))
    return list(result.scalars().all())


async def create(db: AsyncSession, *, name: str, description: Optional[str] = None) -> Department:
    """Insert a new department row."""
    department = Department(name=name, description=description)
    db.add(department)
    await db.flush()
    await db.refresh(department)
    return department


async def save(db: AsyncSession, department: Department) -> Department:
    """Persist changes made to an already-fetched Department instance."""
    await db.flush()
    await db.refresh(department)
    return department


async def soft_delete(db: AsyncSession, department: Department, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a department. Never hard-delete business records
    (mirrors role_repository.soft_delete's own convention).
    """
    from datetime import datetime, timezone

    department.is_deleted = True
    department.deleted_at = datetime.now(timezone.utc)
    department.deleted_by_staff_id = deleted_by_staff_id
    await db.flush()