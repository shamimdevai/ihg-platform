"""Business logic for inventory items and stock. `adjust_stock()` is THE single entry
point for changing stock levels — hotel, restaurant, and delivery services will all
call this in later phases via inventory_service (never inventory's repositories or
models directly, per the cross-domain service-only rule).
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.domains.inventory.models.inventory_item import InventoryItem
from app.domains.inventory.models.stock import Stock
from app.domains.inventory.models.stock_transaction import StockTransaction
from app.domains.inventory.repositories import (
    inventory_item_repository,
    stock_repository,
    stock_transaction_repository,
)
from app.domains.inventory.services import stock_alert_service

# --- Inventory item CRUD ----------------------------------------------------------


async def create_item(
    db: AsyncSession,
    *,
    name: str,
    unit: str,
    sku: Optional[str] = None,
    description: Optional[str] = None,
    category: Optional[str] = None,
    reorder_threshold: Optional[float] = None,
    default_supplier_id: Optional[UUID] = None,
    is_active: bool = True,
) -> InventoryItem:
    """Create a new inventory item catalog entry.

    Raises:
        ValidationError: `sku` is provided but already in use by another item.
    """
    if sku is not None:
        existing = await inventory_item_repository.get_by_sku(db, sku)
        if existing is not None:
            raise ValidationError(f"An inventory item with SKU '{sku}' already exists.")
    return await inventory_item_repository.create(
        db,
        name=name,
        unit=unit,
        sku=sku,
        description=description,
        category=category,
        reorder_threshold=reorder_threshold,
        default_supplier_id=default_supplier_id,
        is_active=is_active,
    )


async def list_items(db: AsyncSession) -> List[InventoryItem]:
    """List every inventory item."""
    return await inventory_item_repository.list_all(db)


async def get_item(db: AsyncSession, item_id: UUID) -> InventoryItem:
    """Fetch a single inventory item by id.

    Raises:
        NotFoundError: no item with that id exists.
    """
    item = await inventory_item_repository.get_by_id(db, item_id)
    if item is None:
        raise NotFoundError("Inventory item not found.")
    return item


async def update_item(
    db: AsyncSession,
    item_id: UUID,
    *,
    name: Optional[str] = None,
    unit: Optional[str] = None,
    sku: Optional[str] = None,
    description: Optional[str] = None,
    category: Optional[str] = None,
    reorder_threshold: Optional[float] = None,
    default_supplier_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
) -> InventoryItem:
    """Update an inventory item's editable fields."""
    item = await get_item(db, item_id)
    if name is not None:
        item.name = name
    if unit is not None:
        item.unit = unit
    if sku is not None:
        item.sku = sku
    if description is not None:
        item.description = description
    if category is not None:
        item.category = category
    if reorder_threshold is not None:
        item.reorder_threshold = reorder_threshold
    if default_supplier_id is not None:
        item.default_supplier_id = default_supplier_id
    if is_active is not None:
        item.is_active = is_active
    return await inventory_item_repository.save(db, item)


async def delete_item(db: AsyncSession, item_id: UUID, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete an inventory item."""
    item = await get_item(db, item_id)
    await inventory_item_repository.soft_delete(db, item, deleted_by_staff_id=deleted_by_staff_id)


# --- Stock read access -------------------------------------------------------------


async def get_stock(db: AsyncSession, item_id: UUID) -> Stock:
    """Fetch the current stock row for an item, lazily creating one at zero if this
    item has never had a stock movement yet.

    Raises:
        NotFoundError: no inventory item with that id exists.
    """
    await get_item(db, item_id)  # ensures the item exists first
    stock = await stock_repository.get_by_item_id(db, item_id)
    if stock is None:
        stock = await stock_repository.create(db, inventory_item_id=item_id, quantity_on_hand=0)
    return stock


async def list_stock(db: AsyncSession) -> List[Stock]:
    """List current stock levels for every item that has a stock row."""
    return await stock_repository.list_all(db)


async def list_transactions(db: AsyncSession, item_id: UUID) -> List[StockTransaction]:
    """List the full audit trail of stock movements for an item, most recent first."""
    await get_item(db, item_id)  # ensures the item exists first
    return await stock_transaction_repository.list_by_item(db, item_id)


# --- The single stock-mutation entry point -----------------------------------------


async def adjust_stock(
    db: AsyncSession,
    *,
    inventory_item_id: UUID,
    quantity_delta: float,
    transaction_type: str,
    reason: Optional[str] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[UUID] = None,
    performed_by_staff_id: Optional[UUID] = None,
) -> StockTransaction:
    """Apply a single audited stock movement and return the resulting transaction.

    THE single entry point for changing stock levels — every domain that consumes or
    replenishes stock (manual admin adjustment today; hotel/restaurant/delivery
    consumption in later phases) MUST call this rather than touching
    inventory.repositories or inventory.models directly, per the cross-domain
    service-only rule (PROJECT_STATE.md §3 rule 4 / Global Context Rule 3).

    `quantity_delta` is positive to increment (e.g. a supplier delivery/receipt) or
    negative to decrement (e.g. a manual correction or, in later phases, consumption
    by an order). `transaction_type` is a free-form string (e.g.
    "manual_adjustment", "receipt", "consumption", "return") so future domains can
    introduce their own values without a migration here. `reference_type` /
    `reference_id` loosely link this movement back to the record that caused it
    (e.g. a future dine_in_order), mirroring the payments domain's
    reference_type/reference_id pattern — never a hard FK across domains.

    If the resulting quantity is at or below the item's `reorder_threshold` (and the
    threshold is set), a low-stock alert is triggered via stock_alert_service — a
    real, notification-backed side effect, not a stub. Duplicate alerts are
    suppressed while one is already open for the item.

    Args:
        db: active async session.
        inventory_item_id: the item whose stock is being adjusted.
        quantity_delta: signed change to apply to the current on-hand quantity.
        transaction_type: free-form movement classification (see above).
        reason: optional human-readable context for this specific movement.
        reference_type: optional loose reference to the causing record's domain/kind.
        reference_id: optional loose reference to the causing record's id.
        performed_by_staff_id: optional id of the staff member who triggered this
            (omitted for movements triggered by a background/system process).

    Returns:
        The newly created StockTransaction row.

    Raises:
        NotFoundError: no inventory item with that id exists.
        ValidationError: applying quantity_delta would take the stock level negative.
    """
    item = await get_item(db, inventory_item_id)

    stock = await stock_repository.get_by_item_id(db, inventory_item_id)
    if stock is None:
        stock = await stock_repository.create(db, inventory_item_id=inventory_item_id, quantity_on_hand=0)

    new_quantity = stock.quantity_on_hand + quantity_delta
    if new_quantity < 0:
        raise ValidationError(
            f"Cannot apply this movement: resulting quantity ({new_quantity}) would be negative. "
            f"Current on-hand quantity is {stock.quantity_on_hand}."
        )

    stock.quantity_on_hand = new_quantity
    await stock_repository.save(db, stock)

    transaction = await stock_transaction_repository.create(
        db,
        inventory_item_id=inventory_item_id,
        quantity_delta=quantity_delta,
        balance_after=new_quantity,
        transaction_type=transaction_type,
        reason=reason,
        reference_type=reference_type,
        reference_id=reference_id,
        performed_by_staff_id=performed_by_staff_id,
    )

    if item.reorder_threshold is not None and new_quantity <= item.reorder_threshold:
        await stock_alert_service.trigger_low_stock_alert(db, item=item, current_quantity=new_quantity)

    return transaction