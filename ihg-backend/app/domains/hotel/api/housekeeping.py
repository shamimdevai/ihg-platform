"""Housekeeping task management — the endpoint the Housekeeping role's staff use
day to day, deliberately isolated from booking/invoice permissions
(RBAC_MATRIX.md §4.5-4.9).
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.hotel.schemas.housekeeping_task import (
    HousekeepingTaskAssignRequest,
    HousekeepingTaskCreate,
    HousekeepingTaskRead,
    HousekeepingTaskStatusUpdate,
)
from app.domains.hotel.services import housekeeping_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/hotel/housekeeping", tags=["hotel"])


@router.post("", dependencies=[Depends(require_permission("hotel:housekeeping:write"))])
async def create_task(payload: HousekeepingTaskCreate, db: AsyncSession = Depends(get_db)) -> dict:
    task = await housekeeping_service.create_task(db, **payload.model_dump())
    return envelope(data=HousekeepingTaskRead.model_validate(task), message="Housekeeping task created.")


@router.get("", dependencies=[Depends(require_permission("hotel:housekeeping:read"))])
async def list_tasks(
    room_id: Optional[UUID] = None,
    status: Optional[str] = None,
    assigned_to_staff_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    tasks = await housekeeping_service.list_tasks(
        db, room_id=room_id, status=status, assigned_to_staff_id=assigned_to_staff_id
    )
    return envelope(data=[HousekeepingTaskRead.model_validate(t) for t in tasks])


@router.get("/{task_id}", dependencies=[Depends(require_permission("hotel:housekeeping:read"))])
async def get_task(task_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    task = await housekeeping_service.get_task(db, task_id)
    return envelope(data=HousekeepingTaskRead.model_validate(task))


@router.put("/{task_id}/assign", dependencies=[Depends(require_permission("hotel:housekeeping:write"))])
async def assign_task(task_id: UUID, payload: HousekeepingTaskAssignRequest, db: AsyncSession = Depends(get_db)) -> dict:
    task = await housekeeping_service.assign_task(db, task_id, payload.assigned_to_staff_id)
    return envelope(data=HousekeepingTaskRead.model_validate(task), message="Task assigned.")


@router.put("/{task_id}/status", dependencies=[Depends(require_permission("hotel:housekeeping:write"))])
async def update_task_status(task_id: UUID, payload: HousekeepingTaskStatusUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    task = await housekeeping_service.update_task_status(db, task_id, payload.status, notes=payload.notes)
    return envelope(data=HousekeepingTaskRead.model_validate(task), message="Task status updated.")