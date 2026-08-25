"""Raw database queries for the stock_alerts table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.inventory.models.stock_alert import StockAlert


async def get_by_id(db: AsyncSession, alert_id: UUID) -> Optional[StockAlert]:
    """Fetch a single stock alert by id, excluding soft-deleted rows."""
    result = await db.execute(
        select(StockAlert).where(StockAlert.id == alert_id, StockAlert.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def get_open_alert_for_item(db: AsyncSession, inventory_item_id: UUID) -> Optional[StockAlert]:
    """Fetch the current open alert for an item, if one exists. Used to avoid creating
    a duplicate alert (and duplicate notifications) while one is already unresolved.
    """
    result = await db.execute(
        select(StockAlert).where(
            StockAlert.inventory_item_id == inventory_item_id,
            StockAlert.status == "open",
            StockAlert.is_deleted.is_(False),
        )
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession, *, status: Optional[str] = None) -> List[StockAlert]:
    """List stock alerts, optionally filtered by status ('open' or 'resolved')."""
    stmt = select(StockAlert).where(StockAlert.is_deleted.is_(False))
    if status is not None:
        stmt = stmt.where(StockAlert.status == status)
    stmt = stmt.order_by(StockAlert.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    *,
    inventory_item_id: UUID,
    threshold_at_trigger: float,
    quantity_at_trigger: float,
    status: str = "open",
) -> StockAlert:
    """Insert a new stock alert row."""
    alert = StockAlert(
        inventory_item_id=inventory_item_id,
        threshold_at_trigger=threshold_at_trigger,
        quantity_at_trigger=quantity_at_trigger,
        status=status,
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert)
    return alert


async def save(db: AsyncSession, alert: StockAlert) -> StockAlert:
    """Persist changes made to an already-fetched StockAlert instance."""
    await db.flush()
    await db.refresh(alert)
    return alert