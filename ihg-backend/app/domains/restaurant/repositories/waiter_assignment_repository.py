"""Raw database queries for the waiter_assignments table."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.restaurant.models.waiter_assignment import WaiterAssignment


async def get_by_id(db: AsyncSession, assignment_id: UUID) -> Optional[WaiterAssignment]:
    result = await db.execute(
        select(WaiterAssignment).where(
            WaiterAssignment.id == assignment_id, WaiterAssignment.is_deleted.is_(False)
        )
    )
    return result.scalar_one_or_none()


async def get_active_for_table(db: AsyncSession, table_id: UUID) -> Optional[WaiterAssignment]:
    result = await db.execute(
        select(WaiterAssignment).where(
            WaiterAssignment.table_id == table_id,
            WaiterAssignment.is_active.is_(True),
            WaiterAssignment.is_deleted.is_(False),
        )
    )
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession,
    *,
    table_id: Optional[UUID] = None,
    staff_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
) -> List[WaiterAssignment]:
    stmt = select(WaiterAssignment).where(WaiterAssignment.is_deleted.is_(False))
    if table_id is not None:
        stmt = stmt.where(WaiterAssignment.table_id == table_id)
    if staff_id is not None:
        stmt = stmt.where(WaiterAssignment.staff_id == staff_id)
    if is_active is not None:
        stmt = stmt.where(WaiterAssignment.is_active == is_active)
    stmt = stmt.order_by(WaiterAssignment.assigned_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> WaiterAssignment:
    assignment = WaiterAssignment(**kwargs)
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment)
    return assignment


async def save(db: AsyncSession, assignment: WaiterAssignment) -> WaiterAssignment:
    await db.flush()
    await db.refresh(assignment)
    return assignment