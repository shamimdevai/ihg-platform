"""Waiter-to-table assignment management. Gated by restaurant:table:* — this is
a table-management action (who's covering which table), analogous to
hotel:room:* covering hotels/room-types/rooms. It is deliberately NOT
restaurant:order:* — the Waiter role's own restaurant:order:* grant is about
taking/managing orders once assigned, not about who gets assigned where
(that's a supervisory/host action, same reasoning as hotel:housekeeping:write
being about task status, not about who can create the department itself).
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.restaurant.schemas.waiter import WaiterAssignmentCreate, WaiterAssignmentRead
from app.domains.restaurant.services import waiter_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/restaurant/waiters", tags=["restaurant"])


@router.post("", dependencies=[Depends(require_permission("restaurant:table:write"))])
async def assign_waiter(payload: WaiterAssignmentCreate, db: AsyncSession = Depends(get_db)) -> dict:
    assignment = await waiter_service.assign_waiter(db, **payload.model_dump())
    return envelope(data=WaiterAssignmentRead.model_validate(assignment), message="Waiter assigned.")


@router.get("", dependencies=[Depends(require_permission("restaurant:table:read"))])
async def list_assignments(
    table_id: Optional[UUID] = None,
    staff_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    assignments = await waiter_service.list_assignments(db, table_id=table_id, staff_id=staff_id, is_active=is_active)
    return envelope(data=[WaiterAssignmentRead.model_validate(a) for a in assignments])


@router.get("/{assignment_id}", dependencies=[Depends(require_permission("restaurant:table:read"))])
async def get_assignment(assignment_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    assignment = await waiter_service.get_assignment(db, assignment_id)
    return envelope(data=WaiterAssignmentRead.model_validate(assignment))


@router.post("/{assignment_id}/unassign", dependencies=[Depends(require_permission("restaurant:table:write"))])
async def unassign_waiter(assignment_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    assignment = await waiter_service.unassign_waiter(db, assignment_id)
    return envelope(data=WaiterAssignmentRead.model_validate(assignment), message="Waiter unassigned.")