"""Business logic for hotels, room types, and rooms."""
from datetime import date
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.domains.hotel.models.hotel import Hotel
from app.domains.hotel.models.room import Room
from app.domains.hotel.models.room_type import RoomType
from app.domains.hotel.repositories import booking_repository, hotel_repository, room_repository, room_type_repository

_VALID_ROOM_STATUSES = {"available", "occupied", "cleaning", "maintenance"}


# --- Hotels ----------------------------------------------------------------------

async def create_hotel(db: AsyncSession, **kwargs) -> Hotel:
    return await hotel_repository.create(db, **kwargs)


async def list_hotels(db: AsyncSession) -> List[Hotel]:
    return await hotel_repository.list_all(db)


async def get_hotel(db: AsyncSession, hotel_id: UUID) -> Hotel:
    hotel = await hotel_repository.get_by_id(db, hotel_id)
    if hotel is None:
        raise NotFoundError("Hotel not found.")
    return hotel


async def update_hotel(db: AsyncSession, hotel_id: UUID, **fields) -> Hotel:
    hotel = await get_hotel(db, hotel_id)
    for key, value in fields.items():
        if value is not None:
            setattr(hotel, key, value)
    return await hotel_repository.save(db, hotel)


# --- Room types --------------------------------------------------------------------

async def create_room_type(db: AsyncSession, *, hotel_id: UUID, **kwargs) -> RoomType:
    await get_hotel(db, hotel_id)  # raises NotFoundError if missing
    return await room_type_repository.create(db, hotel_id=hotel_id, **kwargs)


async def list_room_types(db: AsyncSession, hotel_id: UUID) -> List[RoomType]:
    await get_hotel(db, hotel_id)
    return await room_type_repository.list_by_hotel(db, hotel_id)


async def get_room_type(db: AsyncSession, room_type_id: UUID) -> RoomType:
    room_type = await room_type_repository.get_by_id(db, room_type_id)
    if room_type is None:
        raise NotFoundError("Room type not found.")
    return room_type


# --- Rooms ---------------------------------------------------------------------------

async def create_room(db: AsyncSession, *, hotel_id: UUID, room_type_id: UUID, room_number: str, **kwargs) -> Room:
    await get_hotel(db, hotel_id)
    await get_room_type(db, room_type_id)
    if await room_repository.get_by_hotel_and_number(db, hotel_id, room_number) is not None:
        raise ConflictError(f"Room number '{room_number}' already exists for this hotel.")
    return await room_repository.create(
        db, hotel_id=hotel_id, room_type_id=room_type_id, room_number=room_number, **kwargs
    )


async def list_rooms(db: AsyncSession, *, hotel_id: Optional[UUID] = None, status: Optional[str] = None) -> List[Room]:
    return await room_repository.list_all(db, hotel_id=hotel_id, status=status)


async def get_room(db: AsyncSession, room_id: UUID) -> Room:
    room = await room_repository.get_by_id(db, room_id)
    if room is None:
        raise NotFoundError("Room not found.")
    return room


async def update_room_status(db: AsyncSession, room_id: UUID, status: str) -> Room:
    if status not in _VALID_ROOM_STATUSES:
        raise ValidationError(f"status must be one of {sorted(_VALID_ROOM_STATUSES)}.")
    room = await get_room(db, room_id)
    room.status = status
    return await room_repository.save(db, room)


async def is_room_available(
    db: AsyncSession,
    *,
    room_id: UUID,
    check_in_date: date,
    check_out_date: date,
    exclude_booking_id: Optional[UUID] = None,
) -> bool:
    """True if no active (reserved/checked_in) booking overlaps the given range."""
    overlapping = await booking_repository.find_overlapping(
        db,
        room_id=room_id,
        check_in_date=check_in_date,
        check_out_date=check_out_date,
        exclude_booking_id=exclude_booking_id,
    )
    return len(overlapping) == 0