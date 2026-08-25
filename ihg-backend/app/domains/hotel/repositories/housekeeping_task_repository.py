"""Raw database queries for the housekeeping_tasks table."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.hotel.models.housekeeping_task import HousekeepingTask


async def get_by_id(db: AsyncSession, task_id: UUID) -> Optional[HousekeepingTask]:
    result = await db.execute(
        select(HousekeepingTask).where(HousekeepingTask.id == task_id, HousekeepingTask.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession,
    *,
    room_id: Optional[UUID] = None,
    status: Optional[str] = None,
    assigned_to_staff_id: Optional[UUID] = None,
) -> List[HousekeepingTask]:
    stmt = select(HousekeepingTask).where(HousekeepingTask.is_deleted.is_(False))
    if room_id is not None:
        stmt = stmt.where(HousekeepingTask.room_id == room_id)
    if status is not None:
        stmt = stmt.where(HousekeepingTask.status == status)
    if assigned_to_staff_id is not None:
        stmt = stmt.where(HousekeepingTask.assigned_to_staff_id == assigned_to_staff_id)
    stmt = stmt.order_by(HousekeepingTask.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> HousekeepingTask:
    task = HousekeepingTask(**kwargs)
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return task


async def save(db: AsyncSession, task: HousekeepingTask) -> HousekeepingTask:
    await db.flush()
    await db.refresh(task)
    return task