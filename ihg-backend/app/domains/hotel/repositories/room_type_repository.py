"""Raw database queries for the room_types table."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.hotel.models.room_type import RoomType


async def get_by_id(db: AsyncSession, room_type_id: UUID) -> Optional[RoomType]:
    result = await db.execute(
        select(RoomType).where(RoomType.id == room_type_id, RoomType.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_by_hotel(db: AsyncSession, hotel_id: UUID) -> List[RoomType]:
    result = await db.execute(
        select(RoomType)
        .where(RoomType.hotel_id == hotel_id, RoomType.is_deleted.is_(False))
        .order_by(RoomType.name)
    )
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> RoomType:
    room_type = RoomType(**kwargs)
    db.add(room_type)
    await db.flush()
    await db.refresh(room_type)
    return room_type


async def save(db: AsyncSession, room_type: RoomType) -> RoomType:
    await db.flush()
    await db.refresh(room_type)
    return room_type

async def soft_delete(db: AsyncSession, room_type: RoomType, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a room type. Never hard-delete business records."""
    from datetime import datetime, timezone

    room_type.is_deleted = True
    room_type.deleted_at = datetime.now(timezone.utc)
    room_type.deleted_by_staff_id = deleted_by_staff_id
    await db.flush()