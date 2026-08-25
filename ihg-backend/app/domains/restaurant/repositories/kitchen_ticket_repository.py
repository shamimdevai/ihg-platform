"""Raw database queries for the kitchen_tickets table."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.restaurant.models.kitchen_ticket import KitchenTicket


async def get_by_id(db: AsyncSession, ticket_id: UUID) -> Optional[KitchenTicket]:
    result = await db.execute(
        select(KitchenTicket).where(KitchenTicket.id == ticket_id, KitchenTicket.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def get_by_order_id(db: AsyncSession, order_id: UUID) -> Optional[KitchenTicket]:
    result = await db.execute(
        select(KitchenTicket).where(KitchenTicket.order_id == order_id, KitchenTicket.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession, *, status: Optional[str] = None) -> List[KitchenTicket]:
    stmt = select(KitchenTicket).where(KitchenTicket.is_deleted.is_(False))
    if status is not None:
        stmt = stmt.where(KitchenTicket.status == status)
    stmt = stmt.order_by(KitchenTicket.created_at)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> KitchenTicket:
    ticket = KitchenTicket(**kwargs)
    db.add(ticket)
    await db.flush()
    await db.refresh(ticket)
    return ticket


async def save(db: AsyncSession, ticket: KitchenTicket) -> KitchenTicket:
    await db.flush()
    await db.refresh(ticket)
    return ticket