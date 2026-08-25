"""Raw database queries for the customer_addresses table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.customers.models.customer_address import CustomerAddress


async def get_by_id(db: AsyncSession, address_id: UUID) -> Optional[CustomerAddress]:
    """Fetch a single address by id, excluding soft-deleted rows."""
    result = await db.execute(
        select(CustomerAddress).where(
            CustomerAddress.id == address_id, CustomerAddress.is_deleted.is_(False)
        )
    )
    return result.scalar_one_or_none()


async def list_by_customer(db: AsyncSession, customer_id: UUID) -> List[CustomerAddress]:
    """List every non-soft-deleted address belonging to a customer."""
    result = await db.execute(
        select(CustomerAddress).where(
            CustomerAddress.customer_id == customer_id, CustomerAddress.is_deleted.is_(False)
        )
    )
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    *,
    customer_id: UUID,
    label: str,
    address_line1: str,
    city: str,
    country: str,
    address_line2: Optional[str] = None,
    state: Optional[str] = None,
    postal_code: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    is_default: bool = False,
) -> CustomerAddress:
    """Insert a new customer address row."""
    address = CustomerAddress(
        customer_id=customer_id,
        label=label,
        address_line1=address_line1,
        address_line2=address_line2,
        city=city,
        state=state,
        postal_code=postal_code,
        country=country,
        latitude=latitude,
        longitude=longitude,
        is_default=is_default,
    )
    db.add(address)
    await db.flush()
    await db.refresh(address)
    return address


async def save(db: AsyncSession, address: CustomerAddress) -> CustomerAddress:
    """Persist changes made to an already-fetched CustomerAddress instance."""
    await db.flush()
    await db.refresh(address)
    return address


async def soft_delete(db: AsyncSession, address: CustomerAddress) -> None:
    """Soft-delete an address. Never hard-delete business records."""
    from datetime import datetime, timezone

    address.is_deleted = True
    address.deleted_at = datetime.now(timezone.utc)
    await db.flush()