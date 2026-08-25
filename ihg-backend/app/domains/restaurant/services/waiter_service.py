"""Business logic for waiter-to-table assignments."""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.domains.restaurant.models.waiter_assignment import WaiterAssignment
from app.domains.restaurant.repositories import waiter_assignment_repository
from app.domains.restaurant.services import restaurant_service


async def assign_waiter(db: AsyncSession, *, table_id: UUID, staff_id: UUID) -> WaiterAssignment:
    """Assign a staff member to a table. Deactivates any existing active
    assignment for the same table first (only one active waiter per table at
    a time).

    Raises:
        NotFoundError: table doesn't exist.
    """
    await restaurant_service.get_table(db, table_id)

    existing = await waiter_assignment_repository.get_active_for_table(db, table_id)
    if existing is not None:
        existing.is_active = False
        existing.unassigned_at = datetime.now(timezone.utc)
        await waiter_assignment_repository.save(db, existing)

    return await waiter_assignment_repository.create(
        db,
        table_id=table_id,
        staff_id=staff_id,
        assigned_at=datetime.now(timezone.utc),
        is_active=True,
    )


async def get_assignment(db: AsyncSession, assignment_id: UUID) -> WaiterAssignment:
    assignment = await waiter_assignment_repository.get_by_id(db, assignment_id)
    if assignment is None:
        raise NotFoundError("Waiter assignment not found.")
    return assignment


async def list_assignments(
    db: AsyncSession,
    *,
    table_id: Optional[UUID] = None,
    staff_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
) -> List[WaiterAssignment]:
    return await waiter_assignment_repository.list_all(
        db, table_id=table_id, staff_id=staff_id, is_active=is_active
    )


async def unassign_waiter(db: AsyncSession, assignment_id: UUID) -> WaiterAssignment:
    """Manually end an active assignment (e.g. shift change) without assigning
    a replacement.

    Raises:
        ConflictError: assignment is already inactive.
    """
    assignment = await get_assignment(db, assignment_id)
    if not assignment.is_active:
        raise ConflictError("This assignment is already inactive.")
    assignment.is_active = False
    assignment.unassigned_at = datetime.now(timezone.utc)
    return await waiter_assignment_repository.save(db, assignment)