"""Business logic for delivery order status progression: staff-driven
confirm/preparing/ready transitions, plus rider-driven pickup/delivered
transitions (ownership-enforced — a rider may only progress deliveries
actually assigned to them). Mirrors
restaurant.services.kitchen_service.py's status-machine pattern and
hotel.services.checkin_checkout_service.py's staff-driven-transition pattern,
extended with delivery's rider-ownership check since (unlike hotel checkin/
checkout, which is staff-only end to end) delivery hands off part of the
status machine to a non-staff-supervised actor's own actions.
"""
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.domains.delivery.models.delivery_order import DeliveryOrder
from app.domains.delivery.repositories import delivery_assignment_repository, delivery_order_repository
from app.domains.delivery.services import delivery_order_service


async def confirm_order(db: AsyncSession, order_id: UUID) -> DeliveryOrder:
    """placed -> confirmed (the restaurant/staff accepts the order).

    Raises:
        ConflictError: order is not currently "placed".
    """
    order = await delivery_order_service.get_order(db, order_id)
    if order.status != "placed":
        raise ConflictError(f"Cannot confirm an order in '{order.status}' status; must be 'placed'.")
    order.status = "confirmed"
    order.confirmed_at = datetime.now(timezone.utc)
    return await delivery_order_repository.save(db, order)


async def mark_preparing(db: AsyncSession, order_id: UUID) -> DeliveryOrder:
    """confirmed -> preparing.

    Raises:
        ConflictError: order is not currently "confirmed".
    """
    order = await delivery_order_service.get_order(db, order_id)
    if order.status != "confirmed":
        raise ConflictError(f"Cannot start preparing an order in '{order.status}' status; must be 'confirmed'.")
    order.status = "preparing"
    return await delivery_order_repository.save(db, order)


async def mark_ready(db: AsyncSession, order_id: UUID) -> DeliveryOrder:
    """preparing -> ready_for_pickup.

    Raises:
        ConflictError: order is not currently "preparing".
    """
    order = await delivery_order_service.get_order(db, order_id)
    if order.status != "preparing":
        raise ConflictError(f"Cannot mark ready an order in '{order.status}' status; must be 'preparing'.")
    order.status = "ready_for_pickup"
    order.ready_at = datetime.now(timezone.utc)
    return await delivery_order_repository.save(db, order)


async def _get_active_assignment_for_rider(db: AsyncSession, *, order_id: UUID, rider_staff_id: UUID):
    """Fetch the order's active assignment and verify it belongs to the rider
    identified by `rider_staff_id` — the ownership check backing
    delivery:order:update_status's narrower scope (a Rider may only progress
    deliveries actually assigned to them, never anyone else's).

    Raises:
        NotFoundError: no active assignment exists for this order.
        PermissionDeniedError: the active assignment belongs to a different rider.
    """
    from app.domains.delivery.repositories import delivery_rider_repository

    assignment = await delivery_assignment_repository.get_active_for_order(db, order_id)
    if assignment is None:
        raise NotFoundError("No active rider assignment exists for this order.")
    rider = await delivery_rider_repository.get_by_id(db, assignment.rider_id)
    if rider is None or rider.staff_id != rider_staff_id:
        raise PermissionDeniedError("This delivery is not assigned to you.")
    return assignment


async def mark_picked_up(db: AsyncSession, order_id: UUID, *, rider_staff_id: UUID) -> DeliveryOrder:
    """assigned -> out_for_delivery, only by the rider actually holding the
    active assignment for this order.

    Raises:
        ConflictError: order is not currently "assigned".
        NotFoundError / PermissionDeniedError: bubbled from the ownership check.
    """
    order = await delivery_order_service.get_order(db, order_id)
    if order.status != "assigned":
        raise ConflictError(f"Cannot mark picked up an order in '{order.status}' status; must be 'assigned'.")
    assignment = await _get_active_assignment_for_rider(db, order_id=order_id, rider_staff_id=rider_staff_id)

    now = datetime.now(timezone.utc)
    assignment.status = "picked_up"
    assignment.picked_up_at = now
    await delivery_assignment_repository.save(db, assignment)

    order.status = "out_for_delivery"
    order.out_for_delivery_at = now
    return await delivery_order_repository.save(db, order)


async def mark_delivered(db: AsyncSession, order_id: UUID, *, rider_staff_id: UUID) -> DeliveryOrder:
    """out_for_delivery -> delivered, only by the rider actually holding the
    active assignment for this order. Also frees the rider back to
    "available" — the one place in this phase a rider's status is updated
    automatically as a side effect, rather than via a dedicated self-service
    permission (see rider_service.py's module docstring for why that's
    deliberately out of scope this phase).

    Raises:
        ConflictError: order is not currently "out_for_delivery".
        NotFoundError / PermissionDeniedError: bubbled from the ownership check.
    """
    from app.domains.delivery.repositories import delivery_rider_repository

    order = await delivery_order_service.get_order(db, order_id)
    if order.status != "out_for_delivery":
        raise ConflictError(
            f"Cannot mark delivered an order in '{order.status}' status; must be 'out_for_delivery'."
        )
    assignment = await _get_active_assignment_for_rider(db, order_id=order_id, rider_staff_id=rider_staff_id)

    now = datetime.now(timezone.utc)
    assignment.status = "delivered"
    assignment.delivered_at = now
    assignment.is_active = False
    await delivery_assignment_repository.save(db, assignment)

    rider = await delivery_rider_repository.get_by_id(db, assignment.rider_id)
    if rider is not None:
        rider.status = "available"
        await delivery_rider_repository.save(db, rider)

    order.status = "delivered"
    order.delivered_at = now
    return await delivery_order_repository.save(db, order)


async def get_status_for_customer(db: AsyncSession, *, customer_id: UUID, order_id: UUID) -> DeliveryOrder:
    """Lightweight ownership-checked status lookup for the owning customer —
    delegates entirely to delivery_order_service.get_order_for_customer().
    """
    return await delivery_order_service.get_order_for_customer(db, customer_id=customer_id, order_id=order_id)