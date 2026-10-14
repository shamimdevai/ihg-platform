"""Business logic for hotels, room types, and rooms."""
from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.shared_kernel.services import upload_service
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


# --- Room types (continued) -----------------------------------------------------

async def update_room_type(db: AsyncSession, room_type_id: UUID, **fields) -> RoomType:
    room_type = await get_room_type(db, room_type_id)
    for key, value in fields.items():
        if value is not None:
            setattr(room_type, key, value)
    return await room_type_repository.save(db, room_type)


async def delete_room_type(db: AsyncSession, room_type_id: UUID, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a room type.

    Raises:
        NotFoundError: no room type with that id exists (via get_room_type).
        ConflictError: any active (non-soft-deleted) room still uses this
            room type — Room.room_type_id is NOT NULL, so those rooms
            must be reassigned to a different room type first.
    """
    room_type = await get_room_type(db, room_type_id)
    in_use_count = await room_repository.count_by_room_type_id(db, room_type_id)
    if in_use_count > 0:
        raise ConflictError(
            f"This room type is still used by {in_use_count} room(s). "
            "Reassign them to a different room type before deleting it."
        )
    await room_type_repository.soft_delete(db, room_type, deleted_by_staff_id=deleted_by_staff_id)


# --- Rooms (continued) ------------------------------------------------------------

async def update_room(db: AsyncSession, room_id: UUID, **fields) -> Room:
    """General room edit — room_number, floor, room_type_id, is_active.
    Deliberately separate from update_room_status (status stays its own
    narrower, single-purpose endpoint/permission-usage pattern already
    established).

    Room_type reassignment is NOT blocked by any active booking on this
    room: a Booking snapshots rate_per_night at creation time (see
    booking.py's own docstring), so changing room_type_id afterwards can
    never retroactively corrupt an existing booking's already-recorded
    rate.

    DEACTIVATION (is_active -> False) IS blocked, by explicit request, if
    a guest is currently checked in — see the ConflictError below.

    Raises:
        NotFoundError: room, or (if provided) the new room_type_id,
            doesn't exist.
        ConflictError: the new room_number already exists for this hotel,
            OR is_active is being explicitly set to False while a guest
            is currently checked into this room.
    """
    room = await get_room(db, room_id)

    if fields.get("is_active") is False:
        # Strict `is False`, not a falsy check — fields.get() returns
        # None (via RoomUpdate's Optional[bool] = None) when is_active
        # wasn't part of this update at all, which must NOT trigger this
        # check. Only an EXPLICIT "turn this off" does.
        active_checkins = await booking_repository.list_all(db, room_id=room_id, status="checked_in")
        if active_checkins:
            raise ConflictError(
                "Cannot deactivate this room — a guest is currently checked in. Check them out first."
            )

    new_room_number = fields.get("room_number")
    if new_room_number is not None and new_room_number != room.room_number:
        existing = await room_repository.get_by_hotel_and_number(db, room.hotel_id, new_room_number)
        if existing is not None and existing.id != room.id:
            raise ConflictError(f"Room number '{new_room_number}' already exists for this hotel.")

    new_room_type_id = fields.get("room_type_id")
    if new_room_type_id is not None:
        await get_room_type(db, new_room_type_id)  # raises NotFoundError if missing

    for key, value in fields.items():
        if value is not None:
            setattr(room, key, value)
    return await room_repository.save(db, room)


async def upload_room_type_image(db: AsyncSession, room_type_id: UUID, file: UploadFile) -> RoomType:
    """Save an uploaded photo and store its URL on RoomType.image_url
    (same approach as menu_service.upload_item_image)."""
    room_type = await get_room_type(db, room_type_id)
    result = await upload_service.save_upload(file, subfolder="room_types")
    room_type.image_url = result.url
    return await room_type_repository.save(db, room_type)


async def upload_hotel_image(db: AsyncSession, hotel_id: UUID, file: UploadFile) -> Hotel:
    """Save an uploaded photo and store its URL on Hotel.image_url."""
    hotel = await get_hotel(db, hotel_id)
    result = await upload_service.save_upload(file, subfolder="hotels")
    hotel.image_url = result.url
    return await hotel_repository.save(db, hotel)