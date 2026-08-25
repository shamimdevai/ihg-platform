"""Delivery rider profile CRUD (delivery:rider:read/write) plus rider-to-order
dispatch (assign_rider_to_order — also gated by delivery:rider:write; dispatch
is fundamentally a rider-management action, mirroring
restaurant.api.waiters.py's waiter-to-table assignment living under its own
resource's permission rather than restaurant:order:*).

Two routers in one file — `router` (/delivery/riders) and
`assignments_router` (/delivery/assignments) — mirroring
inventory.api.stock.py's `router` + `alerts_router` precedent for a single
API file that owns two related-but-distinct resources.

Route-ordering note (Architecture Principle #13/#19): the static "/me" path
on `router` is registered before the dynamic "/{rider_id}" path.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.delivery.schemas.delivery_assignment import DeliveryAssignmentCreate, DeliveryAssignmentRead
from app.domains.delivery.schemas.delivery_rider import (
    DeliveryRiderCreate,
    DeliveryRiderRead,
    DeliveryRiderStatusUpdate,
    DeliveryRiderUpdate,
)
from app.domains.delivery.services import rider_service
from app.domains.iam.models.staff_user import StaffUser
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/delivery/riders", tags=["delivery"])
assignments_router = APIRouter(prefix="/delivery/assignments", tags=["delivery"])


# --- Rider profile CRUD ----------------------------------------------------------------


@router.post("", dependencies=[Depends(require_permission("delivery:rider:write"))])
async def create_rider(payload: DeliveryRiderCreate, db: AsyncSession = Depends(get_db)) -> dict:
    rider = await rider_service.create_rider(db, **payload.model_dump())
    return envelope(data=DeliveryRiderRead.model_validate(rider), message="Rider profile created.")


@router.get("", dependencies=[Depends(require_permission("delivery:rider:read"))])
async def list_riders(
    status: Optional[str] = None, is_active: Optional[bool] = None, db: AsyncSession = Depends(get_db)
) -> dict:
    riders = await rider_service.list_riders(db, status=status, is_active=is_active)
    return envelope(data=[DeliveryRiderRead.model_validate(r) for r in riders])


@router.get("/me", dependencies=[Depends(require_permission("delivery:rider:read"))])
async def get_my_rider_profile(
    staff: StaffUser = Depends(get_current_staff_user), db: AsyncSession = Depends(get_db)
) -> dict:
    """A Rider's own profile lookup — still gated by delivery:rider:read (a
    permission the Rider role does hold, see scripts/seed_data.py), not an
    unauthenticated-ownership shortcut, keeping every access decision routed
    through the real permission system rather than a hardcoded role check.
    """
    rider = await rider_service.get_rider_by_staff_id(db, staff.id)
    return envelope(data=DeliveryRiderRead.model_validate(rider))


@router.get("/{rider_id}", dependencies=[Depends(require_permission("delivery:rider:read"))])
async def get_rider(rider_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    rider = await rider_service.get_rider(db, rider_id)
    return envelope(data=DeliveryRiderRead.model_validate(rider))


@router.put("/{rider_id}", dependencies=[Depends(require_permission("delivery:rider:write"))])
async def update_rider(rider_id: UUID, payload: DeliveryRiderUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    rider = await rider_service.update_rider(db, rider_id, **payload.model_dump(exclude_unset=True))
    return envelope(data=DeliveryRiderRead.model_validate(rider), message="Rider profile updated.")


@router.put("/{rider_id}/status", dependencies=[Depends(require_permission("delivery:rider:write"))])
async def set_rider_status(
    rider_id: UUID, payload: DeliveryRiderStatusUpdate, db: AsyncSession = Depends(get_db)
) -> dict:
    rider = await rider_service.set_rider_status(db, rider_id, payload.status)
    return envelope(data=DeliveryRiderRead.model_validate(rider), message="Rider status updated.")


# --- Rider-to-order dispatch (its own router/prefix) ------------------------------------


@assignments_router.post("", dependencies=[Depends(require_permission("delivery:rider:write"))])
async def assign_rider(
    payload: DeliveryAssignmentCreate,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    assignment = await rider_service.assign_rider_to_order(
        db, order_id=payload.order_id, rider_id=payload.rider_id, assigned_by_staff_id=staff.id
    )
    return envelope(data=DeliveryAssignmentRead.model_validate(assignment), message="Rider assigned.")


@assignments_router.get("", dependencies=[Depends(require_permission("delivery:rider:read"))])
async def list_assignments(
    order_id: Optional[UUID] = None,
    rider_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    assignments = await rider_service.list_assignments(
        db, order_id=order_id, rider_id=rider_id, is_active=is_active
    )
    return envelope(data=[DeliveryAssignmentRead.model_validate(a) for a in assignments])


@assignments_router.get("/{assignment_id}", dependencies=[Depends(require_permission("delivery:rider:read"))])
async def get_assignment(assignment_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    assignment = await rider_service.get_assignment(db, assignment_id)
    return envelope(data=DeliveryAssignmentRead.model_validate(assignment))