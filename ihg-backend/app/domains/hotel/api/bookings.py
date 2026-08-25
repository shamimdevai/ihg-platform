"""Booking creation, lookup, listing, and cancellation."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.hotel.schemas.booking import BookingCancelRequest, BookingCreate, BookingRead
from app.domains.hotel.services import booking_service
from app.domains.iam.models.staff_user import StaffUser
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/hotel/bookings", tags=["hotel"])


@router.post("", dependencies=[Depends(require_permission("hotel:booking:write"))])
async def create_booking(
    payload: BookingCreate,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    booking = await booking_service.create_booking(db, booked_by_staff_id=staff.id, **payload.model_dump())
    return envelope(data=BookingRead.model_validate(booking), message="Booking created.")


@router.get("", dependencies=[Depends(require_permission("hotel:booking:read"))])
async def list_bookings(
    hotel_id: Optional[UUID] = None,
    room_id: Optional[UUID] = None,
    guest_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    bookings = await booking_service.list_bookings(
        db, hotel_id=hotel_id, room_id=room_id, guest_id=guest_id, status=status
    )
    return envelope(data=[BookingRead.model_validate(b) for b in bookings])


@router.get("/{booking_id}", dependencies=[Depends(require_permission("hotel:booking:read"))])
async def get_booking(booking_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    booking = await booking_service.get_booking(db, booking_id)
    return envelope(data=BookingRead.model_validate(booking))


@router.post("/{booking_id}/cancel", dependencies=[Depends(require_permission("hotel:booking:write"))])
async def cancel_booking(booking_id: UUID, payload: BookingCancelRequest, db: AsyncSession = Depends(get_db)) -> dict:
    booking = await booking_service.cancel_booking(db, booking_id, reason=payload.reason)
    return envelope(data=BookingRead.model_validate(booking), message="Booking cancelled.")