"""Business logic for table reservations."""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.domains.restaurant.models.table_reservation import TableReservation
from app.domains.restaurant.repositories import table_reservation_repository
from app.domains.restaurant.services import restaurant_service


async def create_reservation(
    db: AsyncSession,
    *,
    restaurant_id: UUID,
    table_id: UUID,
    customer_name: str,
    reservation_time: datetime,
    customer_id: Optional[UUID] = None,
    customer_phone: Optional[str] = None,
    party_size: int = 2,
    notes: Optional[str] = None,
    booked_by_staff_id: Optional[UUID] = None,
) -> TableReservation:
    """Reserve a table. Marks the table "reserved" as a real side effect.

    Raises:
        NotFoundError: restaurant or table doesn't exist.
        ValidationError: table_id does not belong to the given restaurant_id.
        ConflictError: the table already has an active (reserved/seated) reservation.
    """
    await restaurant_service.get_restaurant(db, restaurant_id)
    table = await restaurant_service.get_table(db, table_id)
    if table.restaurant_id != restaurant_id:
        raise ValidationError("table_id does not belong to the given restaurant_id.")

    if await table_reservation_repository.get_active_for_table(db, table_id) is not None:
        raise ConflictError("This table already has an active reservation.")

    reservation = await table_reservation_repository.create(
        db,
        restaurant_id=restaurant_id,
        table_id=table_id,
        customer_id=customer_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        reservation_time=reservation_time,
        party_size=party_size,
        notes=notes,
        status="reserved",
        booked_by_staff_id=booked_by_staff_id,
    )
    await restaurant_service.update_table_status(db, table_id, "reserved")
    return reservation


async def get_reservation(db: AsyncSession, reservation_id: UUID) -> TableReservation:
    reservation = await table_reservation_repository.get_by_id(db, reservation_id)
    if reservation is None:
        raise NotFoundError("Table reservation not found.")
    return reservation


async def list_reservations(
    db: AsyncSession,
    *,
    restaurant_id: Optional[UUID] = None,
    table_id: Optional[UUID] = None,
    status: Optional[str] = None,
) -> List[TableReservation]:
    return await table_reservation_repository.list_all(
        db, restaurant_id=restaurant_id, table_id=table_id, status=status
    )


async def seat_reservation(db: AsyncSession, reservation_id: UUID) -> TableReservation:
    """Transition reserved -> seated, and mark the table occupied.

    Raises:
        ConflictError: reservation is not currently "reserved".
    """
    reservation = await get_reservation(db, reservation_id)
    if reservation.status != "reserved":
        raise ConflictError(f"Cannot seat a reservation in '{reservation.status}' status; must be 'reserved'.")
    reservation.status = "seated"
    reservation = await table_reservation_repository.save(db, reservation)
    await restaurant_service.update_table_status(db, reservation.table_id, "occupied")
    return reservation


async def complete_reservation(db: AsyncSession, reservation_id: UUID) -> TableReservation:
    """Transition seated -> completed, and free the table back to "cleaning".

    Raises:
        ConflictError: reservation is not currently "seated".
    """
    reservation = await get_reservation(db, reservation_id)
    if reservation.status != "seated":
        raise ConflictError(f"Cannot complete a reservation in '{reservation.status}' status; must be 'seated'.")
    reservation.status = "completed"
    reservation = await table_reservation_repository.save(db, reservation)
    await restaurant_service.update_table_status(db, reservation.table_id, "cleaning")
    return reservation


async def cancel_reservation(
    db: AsyncSession, reservation_id: UUID, *, reason: Optional[str] = None
) -> TableReservation:
    """Cancel a reservation. Only permitted from "reserved" (once seated, use
    complete_reservation — or a future "walk-out" action, once a real need for
    that exists; not built speculatively here).

    Raises:
        ConflictError: reservation is not currently "reserved".
    """
    reservation = await get_reservation(db, reservation_id)
    if reservation.status != "reserved":
        raise ConflictError(f"Cannot cancel a reservation in '{reservation.status}' status; must be 'reserved'.")
    reservation.status = "cancelled"
    if reason is not None:
        reservation.notes = reason
    reservation = await table_reservation_repository.save(db, reservation)
    await restaurant_service.update_table_status(db, reservation.table_id, "available")
    return reservation