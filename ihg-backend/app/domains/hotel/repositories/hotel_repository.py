"""Raw database queries for the hotels table."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.hotel.models.hotel import Hotel


async def get_by_id(db: AsyncSession, hotel_id: UUID) -> Optional[Hotel]:
    result = await db.execute(select(Hotel).where(Hotel.id == hotel_id, Hotel.is_deleted.is_(False)))
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> List[Hotel]:
    result = await db.execute(select(Hotel).where(Hotel.is_deleted.is_(False)).order_by(Hotel.name))
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> Hotel:
    hotel = Hotel(**kwargs)
    db.add(hotel)
    await db.flush()
    await db.refresh(hotel)
    return hotel


async def save(db: AsyncSession, hotel: Hotel) -> Hotel:
    await db.flush()
    await db.refresh(hotel)
    return hotel