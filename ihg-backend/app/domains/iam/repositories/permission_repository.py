"""Raw database queries for the permissions table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.iam.models.permission import Permission


async def get_by_id(db: AsyncSession, permission_id: UUID) -> Optional[Permission]:
    """Fetch a permission by id, excluding soft-deleted rows."""
    result = await db.execute(
        select(Permission).where(Permission.id == permission_id, Permission.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def get_by_code(db: AsyncSession, code: str) -> Optional[Permission]:
    """Fetch a permission by its code, excluding soft-deleted rows."""
    result = await db.execute(
        select(Permission).where(Permission.code == code, Permission.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> List[Permission]:
    """List every non-soft-deleted permission."""
    result = await db.execute(select(Permission).where(Permission.is_deleted.is_(False)))
    return list(result.scalars().all())


async def create(db: AsyncSession, *, code: str, description: Optional[str] = None) -> Permission:
    """Insert a new permission row."""
    permission = Permission(code=code, description=description)
    db.add(permission)
    await db.flush()
    await db.refresh(permission)
    return permission