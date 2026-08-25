"""Raw database queries for the system_settings table. No business logic here."""
from typing import Any, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.settings.models.system_setting import SystemSetting


async def get_by_key(db: AsyncSession, key: str) -> Optional[SystemSetting]:
    """Fetch a single setting by its unique key, excluding soft-deleted rows."""
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == key, SystemSetting.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> List[SystemSetting]:
    """Return every non-soft-deleted setting."""
    result = await db.execute(select(SystemSetting).where(SystemSetting.is_deleted.is_(False)))
    return list(result.scalars().all())


async def list_public(db: AsyncSession) -> List[SystemSetting]:
    """Return every non-soft-deleted setting flagged as public."""
    result = await db.execute(
        select(SystemSetting).where(
            SystemSetting.is_deleted.is_(False), SystemSetting.is_public.is_(True)
        )
    )
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    *,
    key: str,
    value: Any,
    value_type: str,
    description: Optional[str] = None,
    is_public: bool = False,
    updated_by_staff_id: Optional[UUID] = None,
) -> SystemSetting:
    """Insert a new system setting row."""
    setting = SystemSetting(
        key=key,
        value=value,
        value_type=value_type,
        description=description,
        is_public=is_public,
        updated_by_staff_id=updated_by_staff_id,
    )
    db.add(setting)
    await db.flush()
    await db.refresh(setting)
    return setting


async def upsert(
    db: AsyncSession,
    *,
    key: str,
    value: Any,
    value_type: str,
    description: Optional[str] = None,
    is_public: bool = False,
    updated_by_staff_id: Optional[UUID] = None,
) -> SystemSetting:
    """Create the setting if it doesn't exist, otherwise update its value in place."""
    existing = await get_by_key(db, key)
    if existing is None:
        return await create(
            db,
            key=key,
            value=value,
            value_type=value_type,
            description=description,
            is_public=is_public,
            updated_by_staff_id=updated_by_staff_id,
        )

    existing.value = value
    existing.value_type = value_type
    if description is not None:
        existing.description = description
    existing.is_public = is_public
    if updated_by_staff_id is not None:
        existing.updated_by_staff_id = updated_by_staff_id

    await db.flush()
    await db.refresh(existing)
    return existing