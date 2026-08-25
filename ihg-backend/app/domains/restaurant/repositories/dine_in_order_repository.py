"""Raw database queries for the dine_in_orders and dine_in_order_items tables —
combined per task instructions, since an order item is always accessed in the
context of its parent order (mirrors hotel.repositories.invoice_repository.py).
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.restaurant.models.dine_in_order import DineInOrder
from app.domains.restaurant.models.dine_in_order_item import DineInOrderItem


async def get_by_id(db: AsyncSession, order_id: UUID) -> Optional[DineInOrder]:
    result = await db.execute(
        select(DineInOrder).where(DineInOrder.id == order_id, DineInOrder.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession,
    *,
    restaurant_id: Optional[UUID] = None,
    table_id: Optional[UUID] = None,
    status: Optional[str] = None,
) -> List[DineInOrder]:
    stmt = select(DineInOrder).where(DineInOrder.is_deleted.is_(False))
    if restaurant_id is not None:
        stmt = stmt.where(DineInOrder.restaurant_id == restaurant_id)
    if table_id is not None:
        stmt = stmt.where(DineInOrder.table_id == table_id)
    if status is not None:
        stmt = stmt.where(DineInOrder.status == status)
    stmt = stmt.order_by(DineInOrder.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> DineInOrder:
    order = DineInOrder(**kwargs)
    db.add(order)
    await db.flush()
    await db.refresh(order)
    return order


async def save(db: AsyncSession, order: DineInOrder) -> DineInOrder:
    await db.flush()
    await db.refresh(order)
    return order


async def add_item(db: AsyncSession, **kwargs) -> DineInOrderItem:
    item = DineInOrderItem(**kwargs)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def list_items(db: AsyncSession, order_id: UUID) -> List[DineInOrderItem]:
    result = await db.execute(
        select(DineInOrderItem)
        .where(DineInOrderItem.order_id == order_id, DineInOrderItem.is_deleted.is_(False))
        .order_by(DineInOrderItem.created_at)
    )
    return list(result.scalars().all())