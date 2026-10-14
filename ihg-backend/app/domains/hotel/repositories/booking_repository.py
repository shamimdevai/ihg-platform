"""Raw database queries for the bookings table."""
from datetime import date
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.hotel.models.booking import Booking

_ACTIVE_STATUSES = ("reserved", "checked_in")


async def get_by_id(db: AsyncSession, booking_id: UUID) -> Optional[Booking]:
    result = await db.execute(select(Booking).where(Booking.id == booking_id, Booking.is_deleted.is_(False)))
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession,
    *,
    hotel_id: Optional[UUID] = None,
    room_id: Optional[UUID] = None,
    guest_id: Optional[UUID] = None,
    status: Optional[str] = None,
) -> List[Booking]:
    stmt = select(Booking).where(Booking.is_deleted.is_(False))
    if hotel_id is not None:
        stmt = stmt.where(Booking.hotel_id == hotel_id)
    if room_id is not None:
        stmt = stmt.where(Booking.room_id == room_id)
    if guest_id is not None:
        stmt = stmt.where(Booking.guest_id == guest_id)
    if status is not None:
        stmt = stmt.where(Booking.status == status)
    stmt = stmt.order_by(Booking.check_in_date.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def find_overlapping(
    db: AsyncSession,
    *,
    room_id: UUID,
    check_in_date: date,
    check_out_date: date,
    exclude_booking_id: Optional[UUID] = None,
) -> List[Booking]:
    """Find active (reserved/checked_in) bookings for a room whose date range
    overlaps [check_in_date, check_out_date). Used to enforce no double-booking.
    """
    stmt = select(Booking).where(
        Booking.room_id == room_id,
        Booking.is_deleted.is_(False),
        Booking.status.in_(_ACTIVE_STATUSES),
        Booking.check_in_date < check_out_date,
        Booking.check_out_date > check_in_date,
    )
    if exclude_booking_id is not None:
        stmt = stmt.where(Booking.id != exclude_booking_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> Booking:
    booking = Booking(**kwargs)
    db.add(booking)
    await db.flush()
    await db.refresh(booking)
    return booking


async def save(db: AsyncSession, booking: Booking) -> Booking:
    await db.flush()
    await db.refresh(booking)
    return booking


async def find_booked_room_ids(
    db: AsyncSession,
    *,
    hotel_id: UUID,
    check_in_date: date,
    check_out_date: date,
) -> set:
    """IDs of every room in a hotel that has an active (reserved/checked_in)
    booking overlapping [check_in_date, check_out_date). One query for the
    whole hotel, used by the public availability search.
    """
    stmt = select(Booking.room_id).where(
        Booking.hotel_id == hotel_id,
        Booking.is_deleted.is_(False),
        Booking.status.in_(_ACTIVE_STATUSES),
        Booking.check_in_date < check_out_date,
        Booking.check_out_date > check_in_date,
    )
    result = await db.execute(stmt)
    return set(result.scalars().all())