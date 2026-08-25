"""Raw database queries for the inventory_items table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.inventory.models.inventory_item import InventoryItem


async def get_by_id(db: AsyncSession, item_id: UUID) -> Optional[InventoryItem]:
    """Fetch a single inventory item by id, excluding soft-deleted rows."""
    result = await db.execute(
        select(InventoryItem).where(InventoryItem.id == item_id, InventoryItem.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def get_by_sku(db: AsyncSession, sku: str) -> Optional[InventoryItem]:
    """Fetch a single inventory item by its SKU, excluding soft-deleted rows."""
    result = await db.execute(
        select(InventoryItem).where(InventoryItem.sku == sku, InventoryItem.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> List[InventoryItem]:
    """List every non-soft-deleted inventory item."""
    result = await db.execute(select(InventoryItem).where(InventoryItem.is_deleted.is_(False)))
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    *,
    name: str,
    unit: str,
    sku: Optional[str] = None,
    description: Optional[str] = None,
    category: Optional[str] = None,
    reorder_threshold: Optional[float] = None,
    default_supplier_id: Optional[UUID] = None,
    is_active: bool = True,
) -> InventoryItem:
    """Insert a new inventory item row."""
    item = InventoryItem(
        name=name,
        unit=unit,
        sku=sku,
        description=description,
        category=category,
        reorder_threshold=reorder_threshold,
        default_supplier_id=default_supplier_id,
        is_active=is_active,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def save(db: AsyncSession, item: InventoryItem) -> InventoryItem:
    """Persist changes made to an already-fetched InventoryItem instance."""
    await db.flush()
    await db.refresh(item)
    return item


async def soft_delete(db: AsyncSession, item: InventoryItem, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete an inventory item. Never hard-delete business records."""
    from datetime import datetime, timezone

    item.is_deleted = True
    item.deleted_at = datetime.now(timezone.utc)
    item.deleted_by_staff_id = deleted_by_staff_id
    await db.flush()