"""Raw database queries for the menu_categories and menu_items tables — combined
per task instructions, since a menu item is always accessed in the context of
its category/restaurant menu.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.restaurant.models.menu_category import MenuCategory
from app.domains.restaurant.models.menu_item import MenuItem

# --- Categories ----------------------------------------------------------------------


async def get_category_by_id(db: AsyncSession, category_id: UUID) -> Optional[MenuCategory]:
    result = await db.execute(
        select(MenuCategory).where(MenuCategory.id == category_id, MenuCategory.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_categories(db: AsyncSession, restaurant_id: UUID) -> List[MenuCategory]:
    result = await db.execute(
        select(MenuCategory)
        .where(MenuCategory.restaurant_id == restaurant_id, MenuCategory.is_deleted.is_(False))
        .order_by(MenuCategory.display_order, MenuCategory.name)
    )
    return list(result.scalars().all())


async def create_category(db: AsyncSession, **kwargs) -> MenuCategory:
    category = MenuCategory(**kwargs)
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


async def save_category(db: AsyncSession, category: MenuCategory) -> MenuCategory:
    await db.flush()
    await db.refresh(category)
    return category


# --- Items -----------------------------------------------------------------------------


async def get_item_by_id(db: AsyncSession, item_id: UUID) -> Optional[MenuItem]:
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id, MenuItem.is_deleted.is_(False)))
    return result.scalar_one_or_none()


async def list_items(
    db: AsyncSession,
    *,
    restaurant_id: Optional[UUID] = None,
    category_id: Optional[UUID] = None,
    is_available: Optional[bool] = None,
) -> List[MenuItem]:
    stmt = select(MenuItem).where(MenuItem.is_deleted.is_(False))
    if restaurant_id is not None:
        stmt = stmt.where(MenuItem.restaurant_id == restaurant_id)
    if category_id is not None:
        stmt = stmt.where(MenuItem.category_id == category_id)
    if is_available is not None:
        stmt = stmt.where(MenuItem.is_available == is_available)
    stmt = stmt.order_by(MenuItem.name)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_item(db: AsyncSession, **kwargs) -> MenuItem:
    item = MenuItem(**kwargs)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def save_item(db: AsyncSession, item: MenuItem) -> MenuItem:
    await db.flush()
    await db.refresh(item)
    return item


async def soft_delete_category(db: AsyncSession, category: MenuCategory, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a menu category. Never hard-delete business records."""
    from datetime import datetime, timezone

    category.is_deleted = True
    category.deleted_at = datetime.now(timezone.utc)
    category.deleted_by_staff_id = deleted_by_staff_id
    await db.flush()


async def soft_delete_item(db: AsyncSession, item: MenuItem, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a menu item. Never hard-delete business records."""
    from datetime import datetime, timezone

    item.is_deleted = True
    item.deleted_at = datetime.now(timezone.utc)
    item.deleted_by_staff_id = deleted_by_staff_id
    await db.flush()


async def count_items_by_category_id(db: AsyncSession, category_id: UUID) -> int:
    """Count active (non-soft-deleted) menu items currently in a category.

    Used by DELETE /restaurant/menu/categories/{category_id} to block
    deleting a category still in use — MenuItem.category_id is NOT NULL,
    so those items must be moved to a different category first.
    """
    result = await db.execute(
        select(func.count())
        .select_from(MenuItem)
        .where(MenuItem.category_id == category_id, MenuItem.is_deleted.is_(False))
    )
    return result.scalar_one()