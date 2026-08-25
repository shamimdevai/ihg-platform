"""Raw database queries for the delivery_assignments table."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.delivery.models.delivery_assignment import DeliveryAssignment


async def get_by_id(db: AsyncSession, assignment_id: UUID) -> Optional[DeliveryAssignment]:
    result = await db.execute(
        select(DeliveryAssignment).where(
            DeliveryAssignment.id == assignment_id, DeliveryAssignment.is_deleted.is_(False)
        )
    )
    return result.scalar_one_or_none()


async def get_active_for_order(db: AsyncSession, order_id: UUID) -> Optional[DeliveryAssignment]:
    result = await db.execute(
        select(DeliveryAssignment).where(
            DeliveryAssignment.order_id == order_id,
            DeliveryAssignment.is_active.is_(True),
            DeliveryAssignment.is_deleted.is_(False),
        )
    )
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession,
    *,
    order_id: Optional[UUID] = None,
    rider_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
) -> List[DeliveryAssignment]:
    stmt = select(DeliveryAssignment).where(DeliveryAssignment.is_deleted.is_(False))
    if order_id is not None:
        stmt = stmt.where(DeliveryAssignment.order_id == order_id)
    if rider_id is not None:
        stmt = stmt.where(DeliveryAssignment.rider_id == rider_id)
    if is_active is not None:
        stmt = stmt.where(DeliveryAssignment.is_active == is_active)
    stmt = stmt.order_by(DeliveryAssignment.assigned_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> DeliveryAssignment:
    assignment = DeliveryAssignment(**kwargs)
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment)
    return assignment


async def save(db: AsyncSession, assignment: DeliveryAssignment) -> DeliveryAssignment:
    await db.flush()
    await db.refresh(assignment)
    return assignment