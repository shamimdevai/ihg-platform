"""Raw database queries for the table_reservations table."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.restaurant.models.table_reservation import TableReservation

_ACTIVE_STATUSES = ("reserved", "seated")


async def get_by_id(db: AsyncSession, reservation_id: UUID) -> Optional[TableReservation]:
    result = await db.execute(
        select(TableReservation).where(
            TableReservation.id == reservation_id, TableReservation.is_deleted.is_(False)
        )
    )
    return result.scalar_one_or_none()


async def get_active_for_table(db: AsyncSession, table_id: UUID) -> Optional[TableReservation]:
    """The current active (reserved/seated) reservation for a table, if any —
    used to prevent double-booking a table that's already reserved or occupied.
    """
    result = await db.execute(
        select(TableReservation).where(
            TableReservation.table_id == table_id,
            TableReservation.status.in_(_ACTIVE_STATUSES),
            TableReservation.is_deleted.is_(False),
        )
    )
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession,
    *,
    restaurant_id: Optional[UUID] = None,
    table_id: Optional[UUID] = None,
    status: Optional[str] = None,
) -> List[TableReservation]:
    stmt = select(TableReservation).where(TableReservation.is_deleted.is_(False))
    if restaurant_id is not None:
        stmt = stmt.where(TableReservation.restaurant_id == restaurant_id)
    if table_id is not None:
        stmt = stmt.where(TableReservation.table_id == table_id)
    if status is not None:
        stmt = stmt.where(TableReservation.status == status)
    stmt = stmt.order_by(TableReservation.reservation_time.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> TableReservation:
    reservation = TableReservation(**kwargs)
    db.add(reservation)
    await db.flush()
    await db.refresh(reservation)
    return reservation


async def save(db: AsyncSession, reservation: TableReservation) -> TableReservation:
    await db.flush()
    await db.refresh(reservation)
    return reservation