"""Raw database queries for the hotel_guests table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.customers.models.hotel_guest import HotelGuest


async def get_by_id(db: AsyncSession, guest_id: UUID) -> Optional[HotelGuest]:
    """Fetch a hotel guest by id, excluding soft-deleted rows."""
    result = await db.execute(
        select(HotelGuest).where(HotelGuest.id == guest_id, HotelGuest.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> List[HotelGuest]:
    """List every non-soft-deleted hotel guest."""
    result = await db.execute(select(HotelGuest).where(HotelGuest.is_deleted.is_(False)))
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    *,
    first_name: str,
    last_name: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    identification_number: Optional[str] = None,
    nationality: Optional[str] = None,
    is_vip: bool = False,
    created_by_staff_id: Optional[UUID] = None,
) -> HotelGuest:
    """Insert a new hotel guest row. No password/account required."""
    guest = HotelGuest(
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        identification_number=identification_number,
        nationality=nationality,
        is_vip=is_vip,
        created_by_staff_id=created_by_staff_id,
    )
    db.add(guest)
    await db.flush()
    await db.refresh(guest)
    return guest


async def save(db: AsyncSession, guest: HotelGuest) -> HotelGuest:
    """Persist changes made to an already-fetched HotelGuest instance."""
    await db.flush()
    await db.refresh(guest)
    return guest