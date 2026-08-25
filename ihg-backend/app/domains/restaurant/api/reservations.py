"""Table reservation management. Gated by restaurant:table:* (reservations are
part of the "table" resource group, mirroring hotel.api.bookings.py being
gated by hotel:booking:* as its own resource — here reservations share the
table resource since RBAC_MATRIX.md's minimum-split instruction for this
domain lists only 4 resource groups, not a separate one for reservations).
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.iam.models.staff_user import StaffUser
from app.domains.restaurant.schemas.table_reservation import (
    TableReservationCancelRequest,
    TableReservationCreate,
    TableReservationRead,
)
from app.domains.restaurant.services import table_reservation_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/restaurant/reservations", tags=["restaurant"])


@router.post("", dependencies=[Depends(require_permission("restaurant:table:write"))])
async def create_reservation(
    payload: TableReservationCreate,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    reservation = await table_reservation_service.create_reservation(
        db, booked_by_staff_id=staff.id, **payload.model_dump()
    )
    return envelope(data=TableReservationRead.model_validate(reservation), message="Table reserved.")


@router.get("", dependencies=[Depends(require_permission("restaurant:table:read"))])
async def list_reservations(
    restaurant_id: Optional[UUID] = None,
    table_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    reservations = await table_reservation_service.list_reservations(
        db, restaurant_id=restaurant_id, table_id=table_id, status=status
    )
    return envelope(data=[TableReservationRead.model_validate(r) for r in reservations])


@router.get("/{reservation_id}", dependencies=[Depends(require_permission("restaurant:table:read"))])
async def get_reservation(reservation_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    reservation = await table_reservation_service.get_reservation(db, reservation_id)
    return envelope(data=TableReservationRead.model_validate(reservation))


@router.post("/{reservation_id}/seat", dependencies=[Depends(require_permission("restaurant:table:write"))])
async def seat_reservation(reservation_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    reservation = await table_reservation_service.seat_reservation(db, reservation_id)
    return envelope(data=TableReservationRead.model_validate(reservation), message="Guests seated.")


@router.post("/{reservation_id}/complete", dependencies=[Depends(require_permission("restaurant:table:write"))])
async def complete_reservation(reservation_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    reservation = await table_reservation_service.complete_reservation(db, reservation_id)
    return envelope(data=TableReservationRead.model_validate(reservation), message="Reservation completed.")


@router.post("/{reservation_id}/cancel", dependencies=[Depends(require_permission("restaurant:table:write"))])
async def cancel_reservation(
    reservation_id: UUID, payload: TableReservationCancelRequest, db: AsyncSession = Depends(get_db)
) -> dict:
    reservation = await table_reservation_service.cancel_reservation(db, reservation_id, reason=payload.reason)
    return envelope(data=TableReservationRead.model_validate(reservation), message="Reservation cancelled.")