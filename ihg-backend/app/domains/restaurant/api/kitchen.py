"""Kitchen ticket queue and status updates — the Kitchen role's own endpoint,
deliberately isolated from table/reservation/menu permissions (RBAC_MATRIX.md's
named-exception governance rule, same reasoning as hotel.api.housekeeping.py
being isolated from booking/invoice permissions).
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.restaurant.schemas.dine_in_order import DineInOrderItemRead
from app.domains.restaurant.schemas.kitchen_ticket import (
    KitchenTicketDetailRead,
    KitchenTicketRead,
    KitchenTicketStatusUpdate,
)
from app.domains.restaurant.services import dine_in_order_service, kitchen_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/restaurant/kitchen", tags=["restaurant"])


@router.get("", dependencies=[Depends(require_permission("restaurant:kitchen:read"))])
async def list_tickets(status: Optional[str] = None, db: AsyncSession = Depends(get_db)) -> dict:
    tickets = await kitchen_service.list_tickets(db, status=status)
    return envelope(data=[KitchenTicketRead.model_validate(t) for t in tickets])


@router.get("/{ticket_id}", dependencies=[Depends(require_permission("restaurant:kitchen:read"))])
async def get_ticket(ticket_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Returns the ticket WITH embedded order-item summaries and table id, so
    Kitchen staff never need restaurant:order:read to see what's on it.
    """
    ticket = await kitchen_service.get_ticket(db, ticket_id)
    order = await dine_in_order_service.get_order(db, ticket.order_id)
    items = await dine_in_order_service.get_order_items(db, ticket.order_id)
    detail = KitchenTicketDetailRead.model_validate(ticket)
    detail.table_id = order.table_id
    detail.items = [DineInOrderItemRead.model_validate(i) for i in items]
    return envelope(data=detail)


@router.put("/{ticket_id}/status", dependencies=[Depends(require_permission("restaurant:kitchen:write"))])
async def update_ticket_status(
    ticket_id: UUID, payload: KitchenTicketStatusUpdate, db: AsyncSession = Depends(get_db)
) -> dict:
    ticket = await kitchen_service.update_ticket_status(db, ticket_id, payload.status, notes=payload.notes)
    return envelope(data=KitchenTicketRead.model_validate(ticket), message="Ticket status updated.")