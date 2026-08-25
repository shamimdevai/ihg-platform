"""Raw database queries for the stock table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.inventory.models.stock import Stock


async def get_by_item_id(db: AsyncSession, inventory_item_id: UUID) -> Optional[Stock]:
    """Fetch the (single) stock row for an inventory item, excluding soft-deleted rows."""
    result = await db.execute(
        select(Stock).where(Stock.inventory_item_id == inventory_item_id, Stock.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> List[Stock]:
    """List every non-soft-deleted stock row."""
    result = await db.execute(select(Stock).where(Stock.is_deleted.is_(False)))
    return list(result.scalars().all())


async def create(db: AsyncSession, *, inventory_item_id: UUID, quantity_on_hand: float = 0) -> Stock:
    """Insert a new stock row, lazily initialized the first time an item is adjusted."""
    stock = Stock(inventory_item_id=inventory_item_id, quantity_on_hand=quantity_on_hand)
    db.add(stock)
    await db.flush()
    await db.refresh(stock)
    return stock


async def save(db: AsyncSession, stock: Stock) -> Stock:
    """Persist changes made to an already-fetched Stock instance."""
    await db.flush()
    await db.refresh(stock)
    return stock