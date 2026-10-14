"""Raw database queries for the rooms table."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.hotel.models.room import Room


async def get_by_id(db: AsyncSession, room_id: UUID) -> Optional[Room]:
    result = await db.execute(select(Room).where(Room.id == room_id, Room.is_deleted.is_(False)))
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession, *, hotel_id: Optional[UUID] = None, status: Optional[str] = None
) -> List[Room]:
    stmt = select(Room).where(Room.is_deleted.is_(False))
    if hotel_id is not None:
        stmt = stmt.where(Room.hotel_id == hotel_id)
    if status is not None:
        stmt = stmt.where(Room.status == status)
    stmt = stmt.order_by(Room.room_number)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_hotel_and_number(db: AsyncSession, hotel_id: UUID, room_number: str) -> Optional[Room]:
    result = await db.execute(
        select(Room).where(
            Room.hotel_id == hotel_id, Room.room_number == room_number, Room.is_deleted.is_(False)
        )
    )
    return result.scalar_one_or_none()


async def create(db: AsyncSession, **kwargs) -> Room:
    room = Room(**kwargs)
    db.add(room)
    await db.flush()
    await db.refresh(room)
    return room


async def save(db: AsyncSession, room: Room) -> Room:
    await db.flush()
    await db.refresh(room)
    return room


async def count_by_room_type_id(db: AsyncSession, room_type_id: UUID) -> int:
    """Count active (non-soft-deleted) rooms currently using a room type.

    Used by DELETE .../room-types/{room_type_id} to block deleting a room
    type still in use — Room.room_type_id is NOT NULL, so those rooms
    must be reassigned to a different room type first (via the new
    general room edit endpoint, PUT /hotel/rooms/{room_id}).
    """
    from sqlalchemy import func

    result = await db.execute(
        select(func.count())
        .select_from(Room)
        .where(Room.room_type_id == room_type_id, Room.is_deleted.is_(False))
    )
    return result.scalar_one()