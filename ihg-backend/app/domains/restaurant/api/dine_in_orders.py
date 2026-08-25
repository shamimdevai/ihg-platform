"""Dine-in order placement, lookup, listing, billing, and cancellation.
Automatically creates the order's kitchen ticket right after placement — a
separate, explicit follow-up call (see dine_in_order_service.place_order()'s
docstring for why), not folded into dine_in_order_service itself.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.iam.models.staff_user import StaffUser
from app.domains.restaurant.schemas.dine_in_order import (
    DineInOrderCreate,
    DineInOrderDetailRead,
    DineInOrderItemRead,
    DineInOrderRead,
)
from app.domains.restaurant.services import dine_in_order_service, kitchen_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/restaurant/orders", tags=["restaurant"])


@router.post("", dependencies=[Depends(require_permission("restaurant:order:write"))])
async def place_order(
    payload: DineInOrderCreate,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    order = await dine_in_order_service.place_order(
        db,
        restaurant_id=payload.restaurant_id,
        table_id=payload.table_id,
        reservation_id=payload.reservation_id,
        customer_id=payload.customer_id,
        notes=payload.notes,
        items=[item.model_dump() for item in payload.items],
        placed_by_staff_id=staff.id,
    )
    await kitchen_service.create_ticket_for_order(db, order.id)
    return envelope(data=DineInOrderRead.model_validate(order), message="Order placed; kitchen ticket created.")


@router.get("", dependencies=[Depends(require_permission("restaurant:order:read"))])
async def list_orders(
    restaurant_id: Optional[UUID] = None,
    table_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    orders = await dine_in_order_service.list_orders(db, restaurant_id=restaurant_id, table_id=table_id, status=status)
    return envelope(data=[DineInOrderRead.model_validate(o) for o in orders])


@router.get("/{order_id}", dependencies=[Depends(require_permission("restaurant:order:read"))])
async def get_order(order_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    order = await dine_in_order_service.get_order(db, order_id)
    items = await dine_in_order_service.get_order_items(db, order_id)
    detail = DineInOrderDetailRead.model_validate(order)
    detail.items = [DineInOrderItemRead.model_validate(i) for i in items]
    return envelope(data=detail)


@router.post("/{order_id}/bill", dependencies=[Depends(require_permission("restaurant:order:write"))])
async def generate_bill(order_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    order = await dine_in_order_service.generate_bill(db, order_id)
    return envelope(data=DineInOrderRead.model_validate(order), message="Bill generated.")


@router.post("/{order_id}/cancel", dependencies=[Depends(require_permission("restaurant:order:write"))])
async def cancel_order(order_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    order = await dine_in_order_service.cancel_order(db, order_id)
    return envelope(data=DineInOrderRead.model_validate(order), message="Order cancelled.")