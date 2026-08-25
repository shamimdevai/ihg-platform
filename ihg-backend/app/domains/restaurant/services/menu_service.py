"""Business logic for menu categories and menu items, incl. image upload via
shared_kernel.services.upload_service.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.domains.restaurant.models.menu_category import MenuCategory
from app.domains.restaurant.models.menu_item import MenuItem
from app.domains.restaurant.repositories import menu_repository
from app.domains.restaurant.services import restaurant_service
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


# --- Items -----------------------------------------------------------------------------


async def _verify_inventory_item_exists(db: AsyncSession, inventory_item_id: UUID) -> None:
    """Cross-domain existence check via inventory's own service layer — restaurant
    never imports inventory.models or inventory.repositories directly
    (architecture rule 3/4), mirroring hotel.services.booking_service's
    _verify_guest_exists() precedent for the customers domain.
    """
    from app.domains.inventory.services import inventory_service

    await inventory_service.get_item(db, inventory_item_id)


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
        ValidationError: category_id does not belong to the given restaurant_id.
    """
    await restaurant_service.get_restaurant(db, restaurant_id)
    category = await get_category(db, category_id)
    if category.restaurant_id != restaurant_id:
        raise ValidationError("category_id does not belong to the given restaurant_id.")
    if inventory_item_id is not None:
        await _verify_inventory_item_exists(db, inventory_item_id)
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
    for key, value in fields.items():
        if value is not None:
            setattr(item, key, value)
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