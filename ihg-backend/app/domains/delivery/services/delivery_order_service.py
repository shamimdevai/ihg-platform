"""Business logic for delivery orders. Places orders on behalf of a verified
customer, snapshotting menu item data via restaurant.services.menu_service /
restaurant_service and consuming linked inventory via
inventory.services.inventory_service.adjust_stock() — mirrors
restaurant.services.dine_in_order_service.place_order()'s pattern almost
exactly, but for the delivery domain's own DeliveryOrder/DeliveryOrderItem
tables and with a customer (not staff) as the actor placing the order. Never
touches restaurant/inventory/customers models or repositories directly, per
the cross-domain service-only rule (PROJECT_STATE.md §3 rule 4 / Global
Context Rule 3) — every cross-domain call below goes through that domain's
own service layer, deferred (imported inline) to avoid any import-order
coupling between peer domains, matching menu_service.py's own precedent for
calling into inventory.
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.company_config import get_company_config
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from app.domains.delivery.models.delivery_order import DeliveryOrder
from app.domains.delivery.repositories import delivery_order_repository

_TERMINAL_STATUSES = ("delivered", "cancelled")
# Once the restaurant has started preparing food, a customer can no longer
# cancel it themselves — from that point on it's staff-only (delivery:order:write
# via the /delivery/orders/{id}/cancel staff endpoint), mirroring the
# hotel/restaurant precedent of separating self-service from staff-driven
# cancellation once real preparation work is underway.
_CUSTOMER_CANCELLABLE_STATUSES = ("placed", "confirmed")


async def _verify_delivery_address(db: AsyncSession, *, customer_id: UUID, address_id: UUID) -> None:
    """Cross-domain ownership check via customers' own service layer — delivery
    never imports customers.models or customers.repositories directly.

    Raises:
        NotFoundError: address doesn't exist.
        PermissionDeniedError: address belongs to a different customer
            (bubbled from address_service._get_owned_address()).
    """
    from app.domains.customers.services import address_service

    await address_service.get_address(db, customer_id=customer_id, address_id=address_id)


async def _consume_inventory_for_item(db: AsyncSession, *, menu_item, quantity: int, order_id: UUID) -> None:
    """Deduct stock for a single order line, if (and only if) the menu item is
    linked to an inventory item — mirrors
    restaurant.services.dine_in_order_service._consume_inventory_for_item()
    exactly, with performed_by_staff_id omitted (the order was placed by a
    customer, not a staff member — inventory_service.adjust_stock() already
    treats performed_by_staff_id as optional for exactly this kind of
    system/customer-triggered movement).
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
        reason=f"Delivery order item: {menu_item.name} x{quantity}",
        reference_type="delivery_order",
        reference_id=order_id,
        performed_by_staff_id=None,
    )


async def place_order(
    db: AsyncSession,
    *,
    customer_id: UUID,
    restaurant_id: UUID,
    delivery_address_id: UUID,
    items: List[dict],
    delivery_notes: Optional[str] = None,
) -> DeliveryOrder:
    """Create a delivery order with its line items in one call — no separate
    "cart" concept, matching dine_in_order_service.place_order()'s precedent.

    Raises:
        ValidationError: `items` is empty, or a menu_item_id doesn't belong to
            restaurant_id.
        NotFoundError: restaurant, delivery_address_id, or any menu_item_id
            doesn't exist.
        PermissionDeniedError: delivery_address_id belongs to a different customer.
        ValidationError (bubbled from inventory_service.adjust_stock): an
            inventory-linked item doesn't have enough stock on hand.
    """
    if not items:
        raise ValidationError("An order must contain at least one item.")

    from app.domains.restaurant.services import menu_service, restaurant_service

    await restaurant_service.get_restaurant(db, restaurant_id)
    await _verify_delivery_address(db, customer_id=customer_id, address_id=delivery_address_id)

    currency = get_company_config().currency
    order = await delivery_order_repository.create(
        db,
        customer_id=customer_id,
        restaurant_id=restaurant_id,
        delivery_address_id=delivery_address_id,
        delivery_notes=delivery_notes,
        status="placed",
        subtotal=0,
        delivery_fee=0,
        tax_amount=0,
        total_amount=0,
        currency=currency,
    )

    subtotal = 0.0
    for line in items:
        menu_item = await menu_service.get_item(db, line["menu_item_id"])
        if menu_item.restaurant_id != restaurant_id:
            raise ValidationError("menu_item_id does not belong to the given restaurant_id.")
        quantity = int(line["quantity"])
        # Snapshots the item's EFFECTIVE price (post-discount) — mirrors
        # dine_in_order_service.place_order()'s identical fix, so a
        # discount applies consistently to both dine-in and delivery
        # orders, not just one of the two places a customer can order
        # from.
        unit_price = menu_service.get_effective_price(menu_item)
        line_total = unit_price * quantity
        subtotal += line_total
        await delivery_order_repository.add_item(
            db,
            order_id=order.id,
            menu_item_id=menu_item.id,
            item_name=menu_item.name,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
            special_instructions=line.get("special_instructions"),
        )
        await _consume_inventory_for_item(db, menu_item=menu_item, quantity=quantity, order_id=order.id)

    # TODO: wire to a configurable delivery-fee rule once system_settings
    # exposes one — flat 0 for now, same open TODO shape as
    # dine_in_order_service.generate_bill()'s tax_amount.
    order.subtotal = subtotal
    order.total_amount = subtotal
    return await delivery_order_repository.save(db, order)


async def get_order(db: AsyncSession, order_id: UUID) -> DeliveryOrder:
    order = await delivery_order_repository.get_by_id(db, order_id)
    if order is None:
        raise NotFoundError("Delivery order not found.")
    return order


async def get_order_for_customer(db: AsyncSession, *, customer_id: UUID, order_id: UUID) -> DeliveryOrder:
    """Fetch an order and verify it belongs to `customer_id` — mirrors
    customers.services.address_service._get_owned_address()'s ownership-check
    pattern exactly.

    Raises:
        NotFoundError: order does not exist.
        PermissionDeniedError: order belongs to a different customer.
    """
    order = await get_order(db, order_id)
    if order.customer_id != customer_id:
        raise PermissionDeniedError("Cannot access another customer's order.")
    return order


async def get_order_items(db: AsyncSession, order_id: UUID):
    await get_order(db, order_id)
    return await delivery_order_repository.list_items(db, order_id)


async def list_orders(
    db: AsyncSession,
    *,
    customer_id: Optional[UUID] = None,
    restaurant_id: Optional[UUID] = None,
    status: Optional[str] = None,
) -> List[DeliveryOrder]:
    return await delivery_order_repository.list_all(
        db, customer_id=customer_id, restaurant_id=restaurant_id, status=status
    )


def is_customer_cancellable(order: DeliveryOrder) -> bool:
    """Whether a customer (as opposed to staff) may still cancel this order themselves."""
    return order.status in _CUSTOMER_CANCELLABLE_STATUSES


async def cancel_order(db: AsyncSession, order_id: UUID, *, reason: Optional[str] = None) -> DeliveryOrder:
    """Cancel an order. Callable by staff at any pre-terminal status, or by
    the owning customer only while still "placed"/"confirmed" — the API layer
    enforces which (see delivery_orders.py's two cancel endpoints; the
    customer-facing one additionally checks is_customer_cancellable() first).

    NOTE: does NOT reverse any inventory already consumed for this order —
    same real, open gap flagged in dine_in_order_service.cancel_order()'s
    docstring; no domain in this codebase currently supports a stock "return".

    Raises:
        ConflictError: order is already "delivered" or "cancelled".
    """
    order = await get_order(db, order_id)
    if order.status in _TERMINAL_STATUSES:
        raise ConflictError(f"Cannot cancel an order in '{order.status}' status.")
    order.status = "cancelled"
    order.cancelled_reason = reason
    order.cancelled_at = datetime.now(timezone.utc)
    return await delivery_order_repository.save(db, order)