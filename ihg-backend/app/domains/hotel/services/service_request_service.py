"""Business logic for in-room service requests."""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.domains.hotel.models.service_request import ServiceRequest
from app.domains.hotel.repositories import service_request_repository
from app.domains.hotel.services import booking_service, room_service

_VALID_STATUSES = {"pending", "in_progress", "completed", "cancelled"}
_TERMINAL_STATUSES = {"completed", "cancelled"}


async def create_request(
    db: AsyncSession, *, booking_id: UUID, room_id: UUID, request_type: str, description: Optional[str] = None
) -> ServiceRequest:
    """Design decision: requests are only accepted for a currently checked-in
    booking (a guest must actually be in-house to request in-room service) — not
    specified explicitly in the task, flag if you want this relaxed.
    """
    booking = await booking_service.get_booking(db, booking_id)
    if booking.status != "checked_in":
        raise ConflictError("Service requests can only be created for a checked-in booking.")
    await room_service.get_room(db, room_id)
    return await service_request_repository.create(
        db, booking_id=booking_id, room_id=room_id, request_type=request_type, description=description, status="pending"
    )


async def get_request(db: AsyncSession, request_id: UUID) -> ServiceRequest:
    req = await service_request_repository.get_by_id(db, request_id)
    if req is None:
        raise NotFoundError("Service request not found.")
    return req


async def list_requests(
    db: AsyncSession, *, booking_id: Optional[UUID] = None, status: Optional[str] = None
) -> List[ServiceRequest]:
    return await service_request_repository.list_all(db, booking_id=booking_id, status=status)


async def assign_request(db: AsyncSession, request_id: UUID, assigned_to_staff_id: UUID) -> ServiceRequest:
    req = await get_request(db, request_id)
    if req.status in _TERMINAL_STATUSES:
        raise ConflictError(f"Cannot reassign a request in terminal status '{req.status}'.")
    req.assigned_to_staff_id = assigned_to_staff_id
    return await service_request_repository.save(db, req)


async def update_request_status(db: AsyncSession, request_id: UUID, status: str) -> ServiceRequest:
    if status not in _VALID_STATUSES:
        raise ValidationError(f"status must be one of {sorted(_VALID_STATUSES)}.")
    req = await get_request(db, request_id)
    if req.status in _TERMINAL_STATUSES:
        raise ConflictError(f"Cannot update a request already in terminal status '{req.status}'.")
    req.status = status
    if status == "completed":
        req.completed_at = datetime.now(timezone.utc)
    return await service_request_repository.save(db, req)