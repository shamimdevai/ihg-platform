"""Raw database queries for the restaurants table."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.restaurant.models.restaurant import Restaurant


async def get_by_id(db: AsyncSession, restaurant_id: UUID) -> Optional[Restaurant]:
    result = await db.execute(
        select(Restaurant).where(Restaurant.id == restaurant_id, Restaurant.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> List[Restaurant]:
    result = await db.execute(
        select(Restaurant).where(Restaurant.is_deleted.is_(False)).order_by(Restaurant.name)
    )
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> Restaurant:
    restaurant = Restaurant(**kwargs)
    db.add(restaurant)
    await db.flush()
    await db.refresh(restaurant)
    return restaurant


async def save(db: AsyncSession, restaurant: Restaurant) -> Restaurant:
    await db.flush()
    await db.refresh(restaurant)
    return restaurant