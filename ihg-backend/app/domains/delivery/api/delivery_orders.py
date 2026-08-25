"""Delivery order placement (customer-facing, gated by
require_verified_customer — Phase 4's stub finally wired to a live endpoint,
per the task spec) plus staff-facing lookup/listing/cancellation.

Route-ordering note (Architecture Principle #13/#19): the static "/mine" and
"/mine/{order_id}" customer routes are registered BEFORE the dynamic
"/{order_id}" staff route, so a request to GET /delivery/orders/mine can
never be swallowed by an attempt to parse "mine" as a UUID path parameter.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_customer, get_db, require_permission, require_verified_customer
from app.core.exceptions import ConflictError
from app.domains.customers.models.customer import Customer
from app.domains.delivery.schemas.delivery_order import (
    DeliveryOrderCancelRequest,
    DeliveryOrderCreate,
    DeliveryOrderDetailRead,
    DeliveryOrderItemRead,
    DeliveryOrderRead,
)
from app.domains.delivery.services import delivery_order_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/delivery/orders", tags=["delivery"])


# --- Customer self-service (static paths — registered before "/{order_id}") ----------


@router.post("")
async def place_order(
    payload: DeliveryOrderCreate,
    customer: Customer = Depends(require_verified_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Place a new delivery order. Requires a verified customer email — the
    first live use of app.api.v1.deps.require_verified_customer() anywhere in
    the codebase (stubbed since Phase 4, never wired to an endpoint until now).
    """
    order = await delivery_order_service.place_order(
        db,
        customer_id=customer.id,
        restaurant_id=payload.restaurant_id,
        delivery_address_id=payload.delivery_address_id,
        delivery_notes=payload.delivery_notes,
        items=[item.model_dump() for item in payload.items],
    )
    return envelope(data=DeliveryOrderRead.model_validate(order), message="Order placed.")


@router.get("/mine")
async def list_my_orders(
    status: Optional[str] = None,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List every delivery order placed by the current customer."""
    orders = await delivery_order_service.list_orders(db, customer_id=customer.id, status=status)
    return envelope(data=[DeliveryOrderRead.model_validate(o) for o in orders])


@router.get("/mine/{order_id}")
async def get_my_order(
    order_id: UUID,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get a single delivery order's detail (incl. line items), verifying it
    belongs to the current customer.
    """
    order = await delivery_order_service.get_order_for_customer(db, customer_id=customer.id, order_id=order_id)
    items = await delivery_order_service.get_order_items(db, order_id)
    detail = DeliveryOrderDetailRead.model_validate(order)
    detail.items = [DeliveryOrderItemRead.model_validate(i) for i in items]
    return envelope(data=detail)


@router.post("/mine/{order_id}/cancel")
async def cancel_my_order(
    order_id: UUID,
    payload: DeliveryOrderCancelRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Cancel the current customer's own order — only while it's still
    "placed" or "confirmed" (before the restaurant starts preparing it).
    """
    order = await delivery_order_service.get_order_for_customer(db, customer_id=customer.id, order_id=order_id)
    if not delivery_order_service.is_customer_cancellable(order):
        raise ConflictError(
            f"Cannot cancel an order in '{order.status}' status yourself; please contact support."
        )
    order = await delivery_order_service.cancel_order(db, order_id, reason=payload.reason)
    return envelope(data=DeliveryOrderRead.model_validate(order), message="Order cancelled.")


# --- Staff-facing (dynamic "/{order_id}" — registered after the static paths above) --


@router.get("", dependencies=[Depends(require_permission("delivery:order:read"))])
async def list_orders(
    customer_id: Optional[UUID] = None,
    restaurant_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    orders = await delivery_order_service.list_orders(
        db, customer_id=customer_id, restaurant_id=restaurant_id, status=status
    )
    return envelope(data=[DeliveryOrderRead.model_validate(o) for o in orders])


@router.get("/{order_id}", dependencies=[Depends(require_permission("delivery:order:read"))])
async def get_order(order_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    order = await delivery_order_service.get_order(db, order_id)
    items = await delivery_order_service.get_order_items(db, order_id)
    detail = DeliveryOrderDetailRead.model_validate(order)
    detail.items = [DeliveryOrderItemRead.model_validate(i) for i in items]
    return envelope(data=detail)


@router.post("/{order_id}/cancel", dependencies=[Depends(require_permission("delivery:order:write"))])
async def cancel_order(
    order_id: UUID, payload: DeliveryOrderCancelRequest, db: AsyncSession = Depends(get_db)
) -> dict:
    order = await delivery_order_service.cancel_order(db, order_id, reason=payload.reason)
    return envelope(data=DeliveryOrderRead.model_validate(order), message="Order cancelled.")