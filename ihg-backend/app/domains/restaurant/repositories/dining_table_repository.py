"""Raw database queries for the dining_tables table."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.restaurant.models.dining_table import DiningTable


async def get_by_id(db: AsyncSession, table_id: UUID) -> Optional[DiningTable]:
    result = await db.execute(
        select(DiningTable).where(DiningTable.id == table_id, DiningTable.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession, *, restaurant_id: Optional[UUID] = None, status: Optional[str] = None
) -> List[DiningTable]:
    stmt = select(DiningTable).where(DiningTable.is_deleted.is_(False))
    if restaurant_id is not None:
        stmt = stmt.where(DiningTable.restaurant_id == restaurant_id)
    if status is not None:
        stmt = stmt.where(DiningTable.status == status)
    stmt = stmt.order_by(DiningTable.table_number)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_restaurant_and_number(
    db: AsyncSession, restaurant_id: UUID, table_number: str
) -> Optional[DiningTable]:
    result = await db.execute(
        select(DiningTable).where(
            DiningTable.restaurant_id == restaurant_id,
            DiningTable.table_number == table_number,
            DiningTable.is_deleted.is_(False),
        )
    )
    return result.scalar_one_or_none()


async def create(db: AsyncSession, **kwargs) -> DiningTable:
    table = DiningTable(**kwargs)
    db.add(table)
    await db.flush()
    await db.refresh(table)
    return table


async def save(db: AsyncSession, table: DiningTable) -> DiningTable:
    await db.flush()
    await db.refresh(table)
    return table