"""Business logic for menu categories and menu items, incl. image upload via
shared_kernel.services.upload_service.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.domains.restaurant.models.menu_category import MenuCategory
from app.domains.restaurant.models.menu_item import MenuItem
from app.domains.restaurant.repositories import menu_repository
from app.domains.restaurant.services import restaurant_service
from app.domains.restaurant.services.discount_utils import compute_effective_price
from app.shared_kernel.services import upload_service

# --- Categories ----------------------------------------------------------------------


async def create_category(db: AsyncSession, *, restaurant_id: UUID, **kwargs) -> MenuCategory:
    await restaurant_service.get_restaurant(db, restaurant_id)
    return await menu_repository.create_category(db, restaurant_id=restaurant_id, **kwargs)


async def list_categories(db: AsyncSession, restaurant_id: UUID) -> List[MenuCategory]:
    await restaurant_service.get_restaurant(db, restaurant_id)
    return await menu_repository.list_categories(db, restaurant_id)


async def get_category(db: AsyncSession, category_id: UUID) -> MenuCategory:
    category = await menu_repository.get_category_by_id(db, category_id)
    if category is None:
        raise NotFoundError("Menu category not found.")
    return category


async def update_category(db: AsyncSession, category_id: UUID, **fields) -> MenuCategory:
    category = await get_category(db, category_id)
    for key, value in fields.items():
        if value is not None:
            setattr(category, key, value)
    return await menu_repository.save_category(db, category)


async def delete_category(db: AsyncSession, category_id: UUID, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a menu category.

    Raises:
        NotFoundError: no category with that id exists (via get_category).
        ConflictError: any active (non-soft-deleted) menu item still
            belongs to this category — MenuItem.category_id is NOT NULL,
            so those items must be moved to a different category first.
    """
    category = await get_category(db, category_id)
    in_use_count = await menu_repository.count_items_by_category_id(db, category_id)
    if in_use_count > 0:
        raise ConflictError(
            f"This category still has {in_use_count} menu item(s) in it. "
            "Move them to a different category before deleting it."
        )
    await menu_repository.soft_delete_category(db, category, deleted_by_staff_id=deleted_by_staff_id)


# --- Items -----------------------------------------------------------------------------


async def _verify_inventory_item_exists(db: AsyncSession, inventory_item_id: UUID) -> None:
    """Cross-domain existence check via inventory's own service layer — restaurant
    never imports inventory.models or inventory.repositories directly
    (architecture rule 3/4), mirroring hotel.services.booking_service's
    _verify_guest_exists() precedent for the customers domain.
    """
    from app.domains.inventory.services import inventory_service

    await inventory_service.get_item(db, inventory_item_id)


def _validate_discount_fields(fields: dict, *, base_price: Optional[float] = None) -> None:
    """Validates discount_type/discount_value/discount_starts_at/
    discount_ends_at BEFORE they're applied to a MenuItem — called from
    both create_item() and update_item(). Only inspects keys actually
    PRESENT in `fields`, so a create/update that doesn't touch discounts
    at all is a no-op here.

    Raises ValidationError for:
      - discount_type set without discount_value, or vice versa — they
        must be supplied together. update_item()'s generic "skip None"
        semantics (used throughout this codebase) make a half-set
        discount a silent data-integrity risk otherwise.
      - discount_value <= 0, or a "percentage" discount_value > 100.
      - a "fixed_amount" discount_value >= the item's price (would make
        the item free or negative) — only checked when base_price is
        known (always known on create; on update, the caller passes
        either the item's current price or the update's own new price).
      - discount_ends_at <= discount_starts_at, when both are given.
    """
    has_type = "discount_type" in fields and fields["discount_type"] is not None
    has_value = "discount_value" in fields and fields["discount_value"] is not None

    if has_type != has_value:
        raise ValidationError("discount_type and discount_value must be set together.")

    if has_type:
        value = float(fields["discount_value"])
        if value <= 0:
            raise ValidationError("discount_value must be greater than 0.")
        if fields["discount_type"] == "percentage" and value > 100:
            raise ValidationError("A percentage discount cannot exceed 100.")
        if fields["discount_type"] == "fixed_amount" and base_price is not None and value >= base_price:
            raise ValidationError("A fixed-amount discount must be less than the item's price.")

    starts_at = fields.get("discount_starts_at")
    ends_at = fields.get("discount_ends_at")
    if starts_at is not None and ends_at is not None and ends_at <= starts_at:
        raise ValidationError("discount_ends_at must be after discount_starts_at.")


def get_effective_price(menu_item: MenuItem) -> float:
    """The price actually charged for this item right now. The single
    function every place that charges for a menu item must call instead
    of reading menu_item.price directly — see
    dine_in_order_service.place_order() and
    delivery_order_service.place_order()."""
    return compute_effective_price(
        price=menu_item.price,
        discount_type=menu_item.discount_type,
        discount_value=menu_item.discount_value,
        discount_starts_at=menu_item.discount_starts_at,
        discount_ends_at=menu_item.discount_ends_at,
    )


async def create_item(
    db: AsyncSession,
    *,
    restaurant_id: UUID,
    category_id: UUID,
    inventory_item_id: Optional[UUID] = None,
    **kwargs,
) -> MenuItem:
    """Create a new menu item.

    Raises:
        NotFoundError: restaurant, category_id, or (if provided) inventory_item_id
            doesn't exist.
        ValidationError: category_id does not belong to the given restaurant_id,
            or the discount fields are invalid/incomplete (see
            _validate_discount_fields).
    """
    await restaurant_service.get_restaurant(db, restaurant_id)
    category = await get_category(db, category_id)
    if category.restaurant_id != restaurant_id:
        raise ValidationError("category_id does not belong to the given restaurant_id.")
    if inventory_item_id is not None:
        await _verify_inventory_item_exists(db, inventory_item_id)
    _validate_discount_fields(kwargs, base_price=kwargs.get("price"))
    return await menu_repository.create_item(
        db,
        restaurant_id=restaurant_id,
        category_id=category_id,
        inventory_item_id=inventory_item_id,
        **kwargs,
    )


async def list_items(
    db: AsyncSession,
    *,
    restaurant_id: Optional[UUID] = None,
    category_id: Optional[UUID] = None,
    is_available: Optional[bool] = None,
) -> List[MenuItem]:
    return await menu_repository.list_items(
        db, restaurant_id=restaurant_id, category_id=category_id, is_available=is_available
    )


async def get_item(db: AsyncSession, item_id: UUID) -> MenuItem:
    item = await menu_repository.get_item_by_id(db, item_id)
    if item is None:
        raise NotFoundError("Menu item not found.")
    return item


async def update_item(db: AsyncSession, item_id: UUID, **fields) -> MenuItem:
    item = await get_item(db, item_id)
    inventory_item_id = fields.get("inventory_item_id")
    if inventory_item_id is not None:
        await _verify_inventory_item_exists(db, inventory_item_id)
    _validate_discount_fields(fields, base_price=fields.get("price", item.price))
    for key, value in fields.items():
        if value is not None:
            setattr(item, key, value)
    return await menu_repository.save_item(db, item)


async def clear_discount(db: AsyncSession, item_id: UUID) -> MenuItem:
    """Explicitly remove an item's discount — a dedicated action rather
    than expressible via update_item()'s generic "skip None" semantics
    (there's no way to NULL a field through that pattern). Matches how
    this codebase handles every other "need to explicitly clear/
    transition a field" situation with a named action instead of
    overloading plain write — e.g. inventory:alert:resolve,
    delivery:order:update_status."""
    item = await get_item(db, item_id)
    item.discount_type = None
    item.discount_value = None
    item.discount_starts_at = None
    item.discount_ends_at = None
    return await menu_repository.save_item(db, item)


async def upload_item_image(db: AsyncSession, item_id: UUID, file: UploadFile) -> MenuItem:
    """Save an uploaded image via shared_kernel.upload_service and store its URL
    directly on MenuItem.image_url — no separate Attachment row, matching how
    config/company.yaml's logo_url is a plain string field, not a tracked
    attachment (upload_service.save_upload's own docstring: callers that DO
    want a persisted Attachment record must call attachment_repository.create()
    themselves; not needed here).
    """
    item = await get_item(db, item_id)
    result = await upload_service.save_upload(file, subfolder="menu_items")
    item.image_url = result.url
    return await menu_repository.save_item(db, item)


async def delete_item(db: AsyncSession, item_id: UUID, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a menu item. No blocking condition, unlike category
    delete above: DineInOrderItem snapshots item_name/unit_price at order
    creation time and only ever references menu_item_id via a row that,
    even once soft-deleted, still physically exists — so deleting an item
    (even one referenced by past or currently-open orders) never corrupts
    order history.
    """
    item = await get_item(db, item_id)
    await menu_repository.soft_delete_item(db, item, deleted_by_staff_id=deleted_by_staff_id)