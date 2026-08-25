"""Raw database queries for the customer_favorites table. No business logic here."""
from typing import List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.customers.models.customer_favorite import CustomerFavorite


async def list_by_customer(db: AsyncSession, customer_id: UUID) -> List[CustomerFavorite]:
    """List every non-soft-deleted favorite belonging to a customer."""
    result = await db.execute(
        select(CustomerFavorite).where(
            CustomerFavorite.customer_id == customer_id, CustomerFavorite.is_deleted.is_(False)
        )
    )
    return list(result.scalars().all())


async def create(db: AsyncSession, *, customer_id: UUID, menu_item_id: UUID) -> CustomerFavorite:
    """Insert a new favorite row."""
    favorite = CustomerFavorite(customer_id=customer_id, menu_item_id=menu_item_id)
    db.add(favorite)
    await db.flush()
    await db.refresh(favorite)
    return favorite