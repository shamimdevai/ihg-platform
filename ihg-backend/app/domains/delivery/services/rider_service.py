"""Business logic for delivery rider profiles and rider-to-order dispatch
(DeliveryAssignment creation). Verifies staff_id via
iam.services.staff_service — delivery never imports iam.models or
iam.repositories directly, per the cross-domain service-only rule (mirrors
hotel.services.booking_service._verify_guest_exists()'s precedent for a
different peer domain).

Rider self-service availability toggling (a Rider marking themselves
"available"/"offline" outside of an active delivery) is deliberately NOT
built this phase — DeliveryRider.status is instead maintained automatically
as a side effect of dispatch (assign_rider_to_order() sets "busy") and
delivery completion (delivery_tracking_service.mark_delivered() sets
"available" again); a dispatcher/admin can still force a status via
set_rider_status() below (gated by delivery:rider:write). Building a
dedicated Rider self-service endpoint would need its own permission code
beyond the task spec's explicit minimum (delivery:order:read/write,
delivery:rider:read/write, plus delivery:order:update_status) — flagged as a
real, open gap for a future phase to pick up explicitly, not silently added
here (same practice as PaymentMethod "set-default" being explicitly skipped
in Phase 6.5, or hotel's minibar stock consumption being flagged as not wired
in Phase 7).
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.domains.delivery.models.delivery_assignment import DeliveryAssignment
from app.domains.delivery.models.delivery_rider import DeliveryRider
from app.domains.delivery.repositories import (
    delivery_assignment_repository,
    delivery_order_repository,
    delivery_rider_repository,
)
from app.domains.delivery.services import delivery_order_service

_VALID_RIDER_STATUSES = {"available", "busy", "offline"}


async def _verify_staff_exists(db: AsyncSession, staff_id: UUID) -> None:
    """Cross-domain existence check via iam's own service layer.

    Raises:
        NotFoundError: bubbled from staff_service.get_staff() if no such
            staff account exists.
    """
    from app.domains.iam.services import staff_service

    await staff_service.get_staff(db, staff_id)


async def create_rider(
    db: AsyncSession,
    *,
    staff_id: UUID,
    vehicle_type: Optional[str] = None,
    license_plate: Optional[str] = None,
    phone: Optional[str] = None,
) -> DeliveryRider:
    """Create a rider profile for a staff account.

    Raises:
        NotFoundError: staff_id doesn't exist.
        ConflictError: staff_id already has a rider profile.
    """
    await _verify_staff_exists(db, staff_id)
    if await delivery_rider_repository.get_by_staff_id(db, staff_id) is not None:
        raise ConflictError("This staff member already has a rider profile.")
    return await delivery_rider_repository.create(
        db,
        staff_id=staff_id,
        vehicle_type=vehicle_type,
        license_plate=license_plate,
        phone=phone,
        status="offline",
        is_active=True,
    )


async def get_rider(db: AsyncSession, rider_id: UUID) -> DeliveryRider:
    rider = await delivery_rider_repository.get_by_id(db, rider_id)
    if rider is None:
        raise NotFoundError("Delivery rider not found.")
    return rider


async def get_rider_by_staff_id(db: AsyncSession, staff_id: UUID) -> DeliveryRider:
    rider = await delivery_rider_repository.get_by_staff_id(db, staff_id)
    if rider is None:
        raise NotFoundError("No delivery rider profile exists for this staff account.")
    return rider


async def list_riders(
    db: AsyncSession, *, status: Optional[str] = None, is_active: Optional[bool] = None
) -> List[DeliveryRider]:
    return await delivery_rider_repository.list_all(db, status=status, is_active=is_active)


async def update_rider(db: AsyncSession, rider_id: UUID, **fields) -> DeliveryRider:
    rider = await get_rider(db, rider_id)
    for key, value in fields.items():
        if value is not None:
            setattr(rider, key, value)
    return await delivery_rider_repository.save(db, rider)


async def set_rider_status(db: AsyncSession, rider_id: UUID, status: str) -> DeliveryRider:
    """Staff/dispatcher-driven manual status override (e.g. clocking a rider
    out at end of shift). Gated by delivery:rider:write — not a Rider
    self-service action this phase, see module docstring.

    Raises:
        ValidationError: `status` isn't a recognized value.
    """
    if status not in _VALID_RIDER_STATUSES:
        raise ValidationError(f"status must be one of {sorted(_VALID_RIDER_STATUSES)}.")
    rider = await get_rider(db, rider_id)
    rider.status = status
    return await delivery_rider_repository.save(db, rider)


async def assign_rider_to_order(
    db: AsyncSession, *, order_id: UUID, rider_id: UUID, assigned_by_staff_id: Optional[UUID] = None
) -> DeliveryAssignment:
    """Dispatch a rider to a ready-for-pickup order. Deactivates any existing
    active assignment for the same order first (mirrors
    restaurant.services.waiter_service.assign_waiter()'s one-active-per-target
    precedent), then advances the order to "assigned" and the rider to "busy".

    Raises:
        NotFoundError: order or rider doesn't exist.
        ConflictError: order is not currently "ready_for_pickup", or the rider
            is not currently "available".
    """
    order = await delivery_order_service.get_order(db, order_id)
    if order.status != "ready_for_pickup":
        raise ConflictError(
            f"Cannot assign a rider to an order in '{order.status}' status; must be 'ready_for_pickup'."
        )
    rider = await get_rider(db, rider_id)
    if rider.status != "available":
        raise ConflictError(f"Rider is currently '{rider.status}', not 'available'.")

    existing = await delivery_assignment_repository.get_active_for_order(db, order_id)
    if existing is not None:
        existing.is_active = False
        existing.cancelled_at = datetime.now(timezone.utc)
        existing.status = "cancelled"
        await delivery_assignment_repository.save(db, existing)

    assignment = await delivery_assignment_repository.create(
        db,
        order_id=order_id,
        rider_id=rider_id,
        status="assigned",
        assigned_at=datetime.now(timezone.utc),
        is_active=True,
        assigned_by_staff_id=assigned_by_staff_id,
    )

    rider.status = "busy"
    await delivery_rider_repository.save(db, rider)

    order.status = "assigned"
    await delivery_order_repository.save(db, order)

    return assignment


async def get_assignment(db: AsyncSession, assignment_id: UUID) -> DeliveryAssignment:
    assignment = await delivery_assignment_repository.get_by_id(db, assignment_id)
    if assignment is None:
        raise NotFoundError("Delivery assignment not found.")
    return assignment


async def list_assignments(
    db: AsyncSession,
    *,
    order_id: Optional[UUID] = None,
    rider_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
) -> List[DeliveryAssignment]:
    return await delivery_assignment_repository.list_all(
        db, order_id=order_id, rider_id=rider_id, is_active=is_active
    )