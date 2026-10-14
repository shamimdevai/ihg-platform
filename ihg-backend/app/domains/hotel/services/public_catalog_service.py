"""Public (no-login) hotel catalog + date-range availability search.

Reuses room_service / booking_repository — no new business rules, just a
read-only, aggregated view. A room counts as available for a date range if
it is active, not under maintenance, and has no reserved/checked_in booking
overlapping [check_in, check_out). Room.status values such as "occupied" or
"cleaning" describe the room RIGHT NOW and are ignored for future dates.
"""
from datetime import date
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.domains.hotel.models.hotel import Hotel
from app.domains.hotel.repositories import booking_repository
from app.domains.hotel.services import room_service

MAX_STAY_NIGHTS = 30


async def list_public_hotels(db: AsyncSession) -> List[Hotel]:
    hotels = await room_service.list_hotels(db)
    return [h for h in hotels if h.is_active]


async def _get_active_hotel(db: AsyncSession, hotel_id: UUID) -> Hotel:
    hotel = await room_service.get_hotel(db, hotel_id)
    if not hotel.is_active:
        raise NotFoundError("Hotel not found.")
    return hotel


async def list_public_room_types(db: AsyncSession, hotel_id: UUID):
    await _get_active_hotel(db, hotel_id)
    return await room_service.list_room_types(db, hotel_id)


async def search_availability(
    db: AsyncSession,
    *,
    hotel_id: UUID,
    check_in: date,
    check_out: date,
    guests: Optional[int] = None,
) -> dict:
    if check_out <= check_in:
        raise ValidationError("Check-out date must be after check-in date.")
    if check_in < date.today():
        raise ValidationError("Check-in date cannot be in the past.")
    nights = (check_out - check_in).days
    if nights > MAX_STAY_NIGHTS:
        raise ValidationError(f"Stays longer than {MAX_STAY_NIGHTS} nights must be arranged with the hotel.")

    await _get_active_hotel(db, hotel_id)
    room_types = await room_service.list_room_types(db, hotel_id)
    rooms = await room_service.list_rooms(db, hotel_id=hotel_id)
    booked_ids = await booking_repository.find_booked_room_ids(
        db, hotel_id=hotel_id, check_in_date=check_in, check_out_date=check_out
    )

    free_by_type: dict = {}
    for room in rooms:
        if not room.is_active or room.status == "maintenance" or room.id in booked_ids:
            continue
        free_by_type[room.room_type_id] = free_by_type.get(room.room_type_id, 0) + 1

    results = []
    for rt in room_types:
        if guests is not None and rt.capacity < guests:
            continue
        results.append(
            {
                "id": rt.id,
                "hotel_id": rt.hotel_id,
                "name": rt.name,
                "description": rt.description,
                "base_rate": float(rt.base_rate),
                "capacity": rt.capacity,
                "amenities": rt.amenities,
                "image_url": rt.image_url,
                "available_rooms": free_by_type.get(rt.id, 0),
                "nights": nights,
                "estimated_total": round(float(rt.base_rate) * nights, 2),
            }
        )
    return {
        "hotel_id": hotel_id,
        "check_in": check_in.isoformat(),
        "check_out": check_out.isoformat(),
        "nights": nights,
        "room_types": results,
    }