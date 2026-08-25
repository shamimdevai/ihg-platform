"""Raw database queries for the menu_categories and menu_items tables — combined
per task instructions, since a menu item is always accessed in the context of
its category/restaurant menu.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
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