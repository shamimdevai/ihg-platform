"""Business logic for the check-in / check-out steps of a booking's lifecycle."""
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.domains.hotel.models.booking import Booking
from app.domains.hotel.repositories import booking_repository
from app.domains.hotel.services import booking_service, housekeeping_service, room_service


async def check_in_booking(db: AsyncSession, booking_id: UUID) -> Booking:
    """Transition a booking reserved -> checked_in, and mark its room occupied.

    Raises:
        ConflictError: booking is not currently "reserved".
    """
    booking = await booking_service.get_booking(db, booking_id)
    if booking.status != "reserved":
        raise ConflictError(f"Cannot check in a booking in '{booking.status}' status; must be 'reserved'.")

    booking.status = "checked_in"
    booking.actual_check_in_at = datetime.now(timezone.utc)
    booking = await booking_repository.save(db, booking)

    await room_service.update_room_status(db, booking.room_id, "occupied")
    return booking


async def check_out_booking(db: AsyncSession, booking_id: UUID) -> Booking:
    """Transition a booking checked_in -> checked_out, compute total_amount, free
    the room into "cleaning" status, and automatically create a housekeeping
    cleaning task for it. Does NOT generate the invoice — that's a separate
    explicit step (POST /hotel/invoices/generate/{booking_id}), matching this
    codebase's existing pattern of granular, explicit actions (payment intent
    creation vs. confirm, refund request vs. approval, etc.).

    Raises:
        ConflictError: booking is not currently "checked_in".
    """
    booking = await booking_service.get_booking(db, booking_id)
    if booking.status != "checked_in":
        raise ConflictError(f"Cannot check out a booking in '{booking.status}' status; must be 'checked_in'.")

    nights = (booking.check_out_date - booking.check_in_date).days
    booking.status = "checked_out"
    booking.actual_check_out_at = datetime.now(timezone.utc)
    booking.total_amount = float(booking.rate_per_night) * max(nights, 1)
    booking = await booking_repository.save(db, booking)

    await room_service.update_room_status(db, booking.room_id, "cleaning")
    await housekeeping_service.create_task(
        db, room_id=booking.room_id, booking_id=booking.id, task_type="cleaning"
    )
    return booking