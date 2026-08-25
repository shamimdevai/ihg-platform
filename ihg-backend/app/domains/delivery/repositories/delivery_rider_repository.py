"""Raw database queries for the delivery_riders table."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.delivery.models.delivery_rider import DeliveryRider


async def get_by_id(db: AsyncSession, rider_id: UUID) -> Optional[DeliveryRider]:
    result = await db.execute(
        select(DeliveryRider).where(DeliveryRider.id == rider_id, DeliveryRider.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def get_by_staff_id(db: AsyncSession, staff_id: UUID) -> Optional[DeliveryRider]:
    result = await db.execute(
        select(DeliveryRider).where(
            DeliveryRider.staff_id == staff_id, DeliveryRider.is_deleted.is_(False)
        )
    )
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession, *, status: Optional[str] = None, is_active: Optional[bool] = None
) -> List[DeliveryRider]:
    stmt = select(DeliveryRider).where(DeliveryRider.is_deleted.is_(False))
    if status is not None:
        stmt = stmt.where(DeliveryRider.status == status)
    if is_active is not None:
        stmt = stmt.where(DeliveryRider.is_active == is_active)
    stmt = stmt.order_by(DeliveryRider.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> DeliveryRider:
    rider = DeliveryRider(**kwargs)
    db.add(rider)
    await db.flush()
    await db.refresh(rider)
    return rider


async def save(db: AsyncSession, rider: DeliveryRider) -> DeliveryRider:
    await db.flush()
    await db.refresh(rider)
    return rider