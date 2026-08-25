"""Raw database queries for the suppliers table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.inventory.models.supplier import Supplier


async def get_by_id(db: AsyncSession, supplier_id: UUID) -> Optional[Supplier]:
    """Fetch a single supplier by id, excluding soft-deleted rows."""
    result = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> List[Supplier]:
    """List every non-soft-deleted supplier."""
    result = await db.execute(select(Supplier).where(Supplier.is_deleted.is_(False)))
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    *,
    name: str,
    contact_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    is_active: bool = True,
) -> Supplier:
    """Insert a new supplier row."""
    supplier = Supplier(
        name=name,
        contact_name=contact_name,
        email=email,
        phone=phone,
        address=address,
        is_active=is_active,
    )
    db.add(supplier)
    await db.flush()
    await db.refresh(supplier)
    return supplier


async def save(db: AsyncSession, supplier: Supplier) -> Supplier:
    """Persist changes made to an already-fetched Supplier instance."""
    await db.flush()
    await db.refresh(supplier)
    return supplier


async def soft_delete(db: AsyncSession, supplier: Supplier, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a supplier. Never hard-delete business records."""
    from datetime import datetime, timezone

    supplier.is_deleted = True
    supplier.deleted_at = datetime.now(timezone.utc)
    supplier.deleted_by_staff_id = deleted_by_staff_id
    await db.flush()