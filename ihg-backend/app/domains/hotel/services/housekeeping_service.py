"""Business logic for housekeeping tasks."""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.domains.hotel.models.housekeeping_task import HousekeepingTask
from app.domains.hotel.repositories import housekeeping_task_repository
from app.domains.hotel.services import room_service

_VALID_STATUSES = {"pending", "in_progress", "completed", "cancelled"}
_TERMINAL_STATUSES = {"completed", "cancelled"}


async def create_task(
    db: AsyncSession,
    *,
    room_id: UUID,
    booking_id: Optional[UUID] = None,
    task_type: str = "cleaning",
    notes: Optional[str] = None,
    assigned_to_staff_id: Optional[UUID] = None,
) -> HousekeepingTask:
    await room_service.get_room(db, room_id)  # raises NotFoundError if missing
    return await housekeeping_task_repository.create(
        db,
        room_id=room_id,
        booking_id=booking_id,
        task_type=task_type,
        notes=notes,
        assigned_to_staff_id=assigned_to_staff_id,
        status="pending",
    )


async def get_task(db: AsyncSession, task_id: UUID) -> HousekeepingTask:
    task = await housekeeping_task_repository.get_by_id(db, task_id)
    if task is None:
        raise NotFoundError("Housekeeping task not found.")
    return task


async def list_tasks(
    db: AsyncSession,
    *,
    room_id: Optional[UUID] = None,
    status: Optional[str] = None,
    assigned_to_staff_id: Optional[UUID] = None,
) -> List[HousekeepingTask]:
    return await housekeeping_task_repository.list_all(
        db, room_id=room_id, status=status, assigned_to_staff_id=assigned_to_staff_id
    )


async def assign_task(db: AsyncSession, task_id: UUID, assigned_to_staff_id: UUID) -> HousekeepingTask:
    task = await get_task(db, task_id)
    if task.status in _TERMINAL_STATUSES:
        raise ConflictError(f"Cannot reassign a task in terminal status '{task.status}'.")
    task.assigned_to_staff_id = assigned_to_staff_id
    return await housekeeping_task_repository.save(db, task)


async def update_task_status(
    db: AsyncSession, task_id: UUID, status: str, *, notes: Optional[str] = None
) -> HousekeepingTask:
    """Update a task's status. On "completed", also marks the room "available"
    again — this domain owns the room/task lifecycle end-to-end.
    """
    if status not in _VALID_STATUSES:
        raise ValidationError(f"status must be one of {sorted(_VALID_STATUSES)}.")
    task = await get_task(db, task_id)
    if task.status in _TERMINAL_STATUSES:
        raise ConflictError(f"Cannot update a task already in terminal status '{task.status}'.")

    task.status = status
    if notes is not None:
        task.notes = notes
    if status == "completed":
        task.completed_at = datetime.now(timezone.utc)
    task = await housekeeping_task_repository.save(db, task)

    if status == "completed":
        await room_service.update_room_status(db, task.room_id, "available")
    return task