"""Business logic for kitchen tickets — the Kitchen role's own scoped view of
"what's next", deliberately independent of restaurant:table/restaurant:order
permissions (RBAC_MATRIX.md's named-exception governance rule, same reasoning
as hotel.services.housekeeping_service being isolated from booking/invoice).
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.domains.restaurant.models.kitchen_ticket import KitchenTicket
from app.domains.restaurant.repositories import dine_in_order_repository, kitchen_ticket_repository
from app.domains.restaurant.services import dine_in_order_service

_VALID_STATUSES = {"pending", "preparing", "ready", "served", "cancelled"}
_TERMINAL_STATUSES = {"served", "cancelled"}


async def create_ticket_for_order(db: AsyncSession, order_id: UUID) -> KitchenTicket:
    """Create the (single) kitchen ticket for a just-placed order. Called by
    dine_in_orders.py's create-order endpoint immediately after
    dine_in_order_service.place_order() succeeds.

    Raises:
        ConflictError: a ticket already exists for this order.
    """
    if await kitchen_ticket_repository.get_by_order_id(db, order_id) is not None:
        raise ConflictError("A kitchen ticket already exists for this order.")
    return await kitchen_ticket_repository.create(db, order_id=order_id, status="pending")


async def get_ticket(db: AsyncSession, ticket_id: UUID) -> KitchenTicket:
    ticket = await kitchen_ticket_repository.get_by_id(db, ticket_id)
    if ticket is None:
        raise NotFoundError("Kitchen ticket not found.")
    return ticket


async def list_tickets(db: AsyncSession, *, status: Optional[str] = None) -> List[KitchenTicket]:
    return await kitchen_ticket_repository.list_all(db, status=status)


async def update_ticket_status(
    db: AsyncSession, ticket_id: UUID, status: str, *, notes: Optional[str] = None
) -> KitchenTicket:
    """Advance a ticket's status. On "preparing"/"ready"/"served", also
    advances the underlying DineInOrder directly via dine_in_order_repository
    (same domain, so this is an ordinary same-domain repository call, not a
    cross-domain violation — mirrors hotel.services.checkin_checkout_service
    calling booking_repository directly rather than routing through
    booking_service) — so the two stay in sync without the Kitchen role ever
    needing restaurant:order:* to do this; the sync happens server-side.

    Raises:
        ValidationError: `status` isn't a recognized value.
        ConflictError: ticket is already in a terminal status ("served"/"cancelled").
    """
    if status not in _VALID_STATUSES:
        raise ValidationError(f"status must be one of {sorted(_VALID_STATUSES)}.")
    ticket = await get_ticket(db, ticket_id)
    if ticket.status in _TERMINAL_STATUSES:
        raise ConflictError(f"Cannot update a ticket already in terminal status '{ticket.status}'.")

    ticket.status = status
    if notes is not None:
        ticket.notes = notes
    now = datetime.now(timezone.utc)
    if status == "preparing" and ticket.started_at is None:
        ticket.started_at = now
    elif status == "ready":
        ticket.ready_at = now
    elif status == "served":
        ticket.served_at = now
    ticket = await kitchen_ticket_repository.save(db, ticket)

    order = await dine_in_order_service.get_order(db, ticket.order_id)
    if status == "preparing" and order.status == "placed":
        order.status = "preparing"
        await dine_in_order_repository.save(db, order)
    elif status == "ready" and order.status == "preparing":
        order.status = "ready"
        await dine_in_order_repository.save(db, order)
    elif status == "served" and order.status == "ready":
        order.status = "served"
        await dine_in_order_repository.save(db, order)

    return ticket