"""Business logic for dine-in orders. Consumes linked inventory items via
inventory.services.inventory_service.adjust_stock() when a menu item is
inventory-tracked — never touches inventory.models or inventory.repositories
directly, per the cross-domain service-only rule.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.company_config import get_company_config
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.domains.restaurant.models.dine_in_order import DineInOrder
from app.domains.restaurant.repositories import dine_in_order_repository
from app.domains.restaurant.services import menu_service, restaurant_service

_TERMINAL_STATUSES = ("billed", "cancelled")


async def _consume_inventory_for_item(
    db: AsyncSession, *, menu_item, quantity: int, order_id: UUID, performed_by_staff_id: Optional[UUID]
) -> None:
    """Deduct stock for a single order line, if (and only if) the menu item is
    linked to an inventory item. Skipped entirely for items with no
    inventory_item_id — not every menu item needs stock tracking in this
    phase's scope (see MenuItem's docstring). Raises ValidationError (bubbled
    from inventory_service.adjust_stock) if there isn't enough stock on hand.
    """
    if menu_item.inventory_item_id is None:
        return
    from app.domains.inventory.services import inventory_service

    qty_per_unit = float(menu_item.inventory_qty_per_unit or 1)
    await inventory_service.adjust_stock(
        db,
        inventory_item_id=menu_item.inventory_item_id,
        quantity_delta=-(qty_per_unit * quantity),
        transaction_type="consumption",
        reason=f"Dine-in order item: {menu_item.name} x{quantity}",
        reference_type="dine_in_order",
        reference_id=order_id,
        performed_by_staff_id=performed_by_staff_id,
    )


async def place_order(
    db: AsyncSession,
    *,
    restaurant_id: UUID,
    table_id: UUID,
    items: List[dict],
    reservation_id: Optional[UUID] = None,
    customer_id: Optional[UUID] = None,
    notes: Optional[str] = None,
    placed_by_staff_id: Optional[UUID] = None,
) -> DineInOrder:
    """Create a dine-in order with its line items in one call — this codebase
    has no separate "cart" concept, so order creation IS placing the order
    (status starts at "placed", not a draft state).

    Does NOT create the order's KitchenTicket — that's kitchen_service's job,
    called separately by the API layer immediately after this returns,
    matching this codebase's existing pattern of granular, explicit actions
    (hotel's checkout-then-generate-invoice split; payments' intent-then-
    confirm split).

    Raises:
        ValidationError: `items` is empty, or table_id doesn't belong to
            restaurant_id.
        NotFoundError: restaurant, table, or any menu_item_id doesn't exist.
        ValidationError (bubbled from inventory_service.adjust_stock): an
            inventory-linked item doesn't have enough stock on hand.
    """
    if not items:
        raise ValidationError("An order must contain at least one item.")

    await restaurant_service.get_restaurant(db, restaurant_id)
    table = await restaurant_service.get_table(db, table_id)
    if table.restaurant_id != restaurant_id:
        raise ValidationError("table_id does not belong to the given restaurant_id.")

    currency = get_company_config().currency
    order = await dine_in_order_repository.create(
        db,
        restaurant_id=restaurant_id,
        table_id=table_id,
        reservation_id=reservation_id,
        customer_id=customer_id,
        notes=notes,
        status="placed",
        subtotal=0,
        tax_amount=0,
        total_amount=0,
        currency=currency,
        placed_by_staff_id=placed_by_staff_id,
    )

    subtotal = 0.0
    for line in items:
        menu_item = await menu_service.get_item(db, line["menu_item_id"])
        quantity = int(line["quantity"])
        line_total = float(menu_item.price) * quantity
        subtotal += line_total
        await dine_in_order_repository.add_item(
            db,
            order_id=order.id,
            menu_item_id=menu_item.id,
            item_name=menu_item.name,
            quantity=quantity,
            unit_price=menu_item.price,
            line_total=line_total,
            special_instructions=line.get("special_instructions"),
        )
        await _consume_inventory_for_item(
            db,
            menu_item=menu_item,
            quantity=quantity,
            order_id=order.id,
            performed_by_staff_id=placed_by_staff_id,
        )

    order.subtotal = subtotal
    order.total_amount = subtotal  # tax_amount left at 0 until billing — see generate_bill()
    return await dine_in_order_repository.save(db, order)


async def get_order(db: AsyncSession, order_id: UUID) -> DineInOrder:
    order = await dine_in_order_repository.get_by_id(db, order_id)
    if order is None:
        raise NotFoundError("Dine-in order not found.")
    return order


async def get_order_items(db: AsyncSession, order_id: UUID):
    await get_order(db, order_id)
    return await dine_in_order_repository.list_items(db, order_id)


async def list_orders(
    db: AsyncSession,
    *,
    restaurant_id: Optional[UUID] = None,
    table_id: Optional[UUID] = None,
    status: Optional[str] = None,
) -> List[DineInOrder]:
    return await dine_in_order_repository.list_all(db, restaurant_id=restaurant_id, table_id=table_id, status=status)


async def mark_served(db: AsyncSession, order_id: UUID) -> DineInOrder:
    """Transition an order to "served". Called by kitchen_service once the
    kitchen ticket itself reaches "served", keeping the two tables in sync
    without the Kitchen role needing restaurant:order:write.

    Raises:
        ConflictError: order is not currently "ready".
    """
    order = await get_order(db, order_id)
    if order.status != "ready":
        raise ConflictError(f"Cannot serve an order in '{order.status}' status; must be 'ready'.")
    order.status = "served"
    return await dine_in_order_repository.save(db, order)


async def generate_bill(db: AsyncSession, order_id: UUID) -> DineInOrder:
    """Finalize the order's bill: recompute totals (no configurable tax rate
    wired up yet — same open TODO as
    hotel.services.invoice_service.generate_invoice_for_booking, deferred until
    system_settings exposes one) and transition to "billed".

    Raises:
        ConflictError: order is not currently "served".
    """
    order = await get_order(db, order_id)
    if order.status != "served":
        raise ConflictError(f"Cannot bill an order in '{order.status}' status; must be 'served'.")
    # TODO: wire to a configurable tax rate once system_settings exposes one.
    order.tax_amount = 0
    order.total_amount = float(order.subtotal) + float(order.tax_amount)
    order.status = "billed"
    return await dine_in_order_repository.save(db, order)


async def cancel_order(db: AsyncSession, order_id: UUID) -> DineInOrder:
    """Cancel an order.

    NOTE: does NOT reverse any inventory already consumed for this order — no
    domain in this codebase currently supports a stock "return" tied to an
    order cancellation. Flagged as a real, open gap rather than silently
    ignored (consistent with this codebase's practice of flagging rather than
    papering over open items — see PROJECT_STATE.md's Open Decisions log).

    Raises:
        ConflictError: order is already "billed" or "cancelled".
    """
    order = await get_order(db, order_id)
    if order.status in _TERMINAL_STATUSES:
        raise ConflictError(f"Cannot cancel an order in '{order.status}' status.")
    order.status = "cancelled"
    return await dine_in_order_repository.save(db, order)