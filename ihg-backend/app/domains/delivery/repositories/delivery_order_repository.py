"""Raw database queries for the delivery_orders and delivery_order_items
tables — combined per task instructions, since an order item is always
accessed in the context of its parent order (mirrors
restaurant.repositories.dine_in_order_repository.py /
hotel.repositories.invoice_repository.py's precedent).
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.delivery.models.delivery_order import DeliveryOrder
from app.domains.delivery.models.delivery_order_item import DeliveryOrderItem


async def get_by_id(db: AsyncSession, order_id: UUID) -> Optional[DeliveryOrder]:
    result = await db.execute(
        select(DeliveryOrder).where(DeliveryOrder.id == order_id, DeliveryOrder.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession,
    *,
    customer_id: Optional[UUID] = None,
    restaurant_id: Optional[UUID] = None,
    status: Optional[str] = None,
) -> List[DeliveryOrder]:
    stmt = select(DeliveryOrder).where(DeliveryOrder.is_deleted.is_(False))
    if customer_id is not None:
        stmt = stmt.where(DeliveryOrder.customer_id == customer_id)
    if restaurant_id is not None:
        stmt = stmt.where(DeliveryOrder.restaurant_id == restaurant_id)
    if status is not None:
        stmt = stmt.where(DeliveryOrder.status == status)
    stmt = stmt.order_by(DeliveryOrder.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> DeliveryOrder:
    order = DeliveryOrder(**kwargs)
    db.add(order)
    await db.flush()
    await db.refresh(order)
    return order


async def save(db: AsyncSession, order: DeliveryOrder) -> DeliveryOrder:
    await db.flush()
    await db.refresh(order)
    return order


async def add_item(db: AsyncSession, **kwargs) -> DeliveryOrderItem:
    item = DeliveryOrderItem(**kwargs)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def list_items(db: AsyncSession, order_id: UUID) -> List[DeliveryOrderItem]:
    result = await db.execute(
        select(DeliveryOrderItem)
        .where(DeliveryOrderItem.order_id == order_id, DeliveryOrderItem.is_deleted.is_(False))
        .order_by(DeliveryOrderItem.created_at)
    )
    return list(result.scalars().all())