"""Business logic for creating and managing bookings."""
from datetime import date
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.domains.hotel.models.booking import Booking
from app.domains.hotel.repositories import booking_repository
from app.domains.hotel.services import room_service


async def _verify_guest_exists(db: AsyncSession, guest_id: UUID) -> None:
    """Cross-domain existence check via customers' own service layer — hotel never
    imports customers.models or customers.repositories directly (architecture rule
    3/4).

    ASSUMPTION FLAGGED: this calls `guest_service.get_guest(db, guest_id)`, which
    is assumed to raise NotFoundError on a missing guest, matching every other
    domain's get_* convention seen so far (payment_service.get_payment,
    room_service.get_hotel, etc.). I have not seen the real
    app/domains/customers/services/guest_service.py — send it if the function name
    or signature differs and I'll correct this.
    """
    from app.domains.customers.services import guest_service

    await guest_service.get_guest(db, guest_id)


async def create_booking(
    db: AsyncSession,
    *,
    hotel_id: UUID,
    room_id: UUID,
    guest_id: UUID,
    check_in_date: date,
    check_out_date: date,
    num_guests: Optional[int] = None,
    notes: Optional[str] = None,
    booked_by_staff_id: Optional[UUID] = None,
) -> Booking:
    """Create a new reservation.

    Raises:
        ValidationError: check_out_date <= check_in_date.
        NotFoundError: hotel, room, or guest doesn't exist.
        ConflictError: the room is already booked for an overlapping range.
    """
    if check_out_date <= check_in_date:
        raise ValidationError("check_out_date must be after check_in_date.")

    await room_service.get_hotel(db, hotel_id)
    room = await room_service.get_room(db, room_id)
    if room.hotel_id != hotel_id:
        raise ValidationError("room_id does not belong to the given hotel_id.")
    await _verify_guest_exists(db, guest_id)

    if not await room_service.is_room_available(
        db, room_id=room_id, check_in_date=check_in_date, check_out_date=check_out_date
    ):
        raise ConflictError("Room is not available for the requested date range.")

    room_type = await room_service.get_room_type(db, room.room_type_id)

    return await booking_repository.create(
        db,
        hotel_id=hotel_id,
        room_id=room_id,
        guest_id=guest_id,
        check_in_date=check_in_date,
        check_out_date=check_out_date,
        num_guests=num_guests,
        notes=notes,
        rate_per_night=room_type.base_rate,
        status="reserved",
        booked_by_staff_id=booked_by_staff_id,
    )


async def get_booking(db: AsyncSession, booking_id: UUID) -> Booking:
    booking = await booking_repository.get_by_id(db, booking_id)
    if booking is None:
        raise NotFoundError("Booking not found.")
    return booking


async def list_bookings(
    db: AsyncSession,
    *,
    hotel_id: Optional[UUID] = None,
    room_id: Optional[UUID] = None,
    guest_id: Optional[UUID] = None,
    status: Optional[str] = None,
) -> List[Booking]:
    return await booking_repository.list_all(
        db, hotel_id=hotel_id, room_id=room_id, guest_id=guest_id, status=status
    )


async def cancel_booking(db: AsyncSession, booking_id: UUID, *, reason: Optional[str] = None) -> Booking:
    """Cancel a reservation.

    Raises:
        ConflictError: booking is not currently "reserved" (already checked in,
            checked out, or already cancelled).
    """
    booking = await get_booking(db, booking_id)
    if booking.status != "reserved":
        raise ConflictError(f"Cannot cancel a booking in '{booking.status}' status; must be 'reserved'.")
    booking.status = "cancelled"
    booking.cancelled_reason = reason
    return await booking_repository.save(db, booking)